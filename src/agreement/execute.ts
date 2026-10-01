/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


// The engine side of ./logic.ts: how logic runs against an
// org.accordproject.agreement@1.0.0 Agreement and its org.accordproject.runtime@1.0.0
// AgreementState.
//
// One trigger is a deterministic function of its inputs:
//
//   execute(agreement + documents + state@N, request)
//     -> { result, events, state@N+1 }
//
// Inside it, logic writes through `self` into a Transaction. Triggering a composed clause
// runs the clause's logic in a nested Transaction, merged into its parent's when the
// clause returns and discarded if it throws, so a parent that catches a clause's error
// loses only that clause's writes. The outermost Transaction becomes the next state, or
// nothing at all if the logic throws. The JSON in and out is all a store holds, which is
// what lets this run as a stateless function.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Factory, ModelManager, Serializer } from '@accordproject/concerto-core';
import type {
    Agreement, Document, IAgreementParty, IAgreementReference, IEvent, Instance, IRequest, IResponse,
    IStateData, ITemplateData, ITemplateReference, Logic,
} from './logic';

export const AGREEMENT_FQN = 'org.accordproject.agreement@1.0.0.Agreement';
export const AGREEMENT_DOCUMENT_FQN = 'org.accordproject.agreement@1.0.0.AgreementDocument';
export const AGREEMENT_REFERENCE_FQN = 'org.accordproject.agreement@1.0.0.AgreementReference';
export const CLAUSE_FQN = 'org.accordproject.agreement@1.0.0.Clause';
export const AGREEMENT_STATE_FQN = 'org.accordproject.runtime@1.0.0.AgreementState';
export const REQUEST_FQN = 'org.accordproject.runtime@1.0.0.Request';
export const RESPONSE_FQN = 'org.accordproject.runtime@1.0.0.Response';
export const TEMPLATE_DATA_FQN = 'org.accordproject.templatedata@1.0.0.TemplateData';
export const STATE_DATA_FQN = 'org.accordproject.templatedata@1.0.0.StateData';

/** A relationship to an identified instance, as JSON. */
export const relationship = (fqn: string, id: string) => `resource:${fqn}#${id}`;

// The agreement@1.0.0 and runtime@1.0.0 types, as JSON. Relationships are
// "resource:<type>#<id>" strings, and maps are objects, as Concerto's serializer writes
// them. Fields the engine doesn't read, such as hashes, pass through untouched.
export interface ClauseJson {
    $class?: string;
    template: ITemplateReference;
    clauseId: string;
    data: ITemplateData;
    clauses?: Record<string, ClauseJson>;
    [field: string]: unknown;
}

export interface DocumentJson {
    $class?: string;
    documentId: string;
    template?: ITemplateReference;
    data?: ITemplateData;
    clauses?: Record<string, ClauseJson>;
    parties?: IAgreementParty[];
    [field: string]: unknown;
}

export interface AgreementJson {
    $class?: string;
    agreementId: string;
    documents: string[];
    parties: IAgreementParty[];
    [field: string]: unknown;
}

export interface StateJson {
    $class: string;
    stateId: string;
    agreement: string;
    revision: number;
    effectiveAt: string;
    states?: Record<string, IStateData>;
    [field: string]: unknown;
}

/** Logic by `TemplateReference.templateId`. A template with none is stateless and untriggerable. */
export type LogicRegistry = Readonly<Record<string, Logic<any, any>>>;

export interface Options {
    /**
     * Every template's models. When given, each logic's request types are checked against
     * them before anything runs; requests, responses, every state written and every event
     * emitted are validated, as is the AgreementState when runtime@1.0.0 is loaded; and a
     * request no handler is registered for falls back to the handler for its nearest
     * supertype.
     */
    models?: ModelManager;
}

export interface Outcome {
    result: IResponse;
    events: IEvent[];
    state: StateJson;
}

export interface Initialised {
    state: StateJson;
    events: IEvent[];
}

/**
 * Initialises every instance in the agreement, as revision 0.
 * @param {AgreementJson} agreement - the agreement
 * @param {DocumentJson[]} documents - its documents
 * @param {string} effectiveAt - when the agreement takes effect
 * @param {LogicRegistry} logic - each template's logic, by templateId
 * @param {Options} [options] - validation options
 * @returns {Promise<Initialised>} the initial state, and the events init emitted
 */
export async function initialise(
    agreement: AgreementJson,
    documents: DocumentJson[],
    effectiveAt: string,
    logic: LogicRegistry,
    options: Options = {},
): Promise<Initialised> {
    const session = new Session(agreement, documents, 0, logic, options);
    const tx = new Transaction({ read: () => undefined });
    for (const node of session.nodes()) {
        const nodeLogic = session.logicFor(node);
        if (nodeLogic?.hasInit) {
            await nodeLogic.start(new SelfView(session, node, tx));
        }
    }
    const state = session.envelope(0, effectiveAt, Object.fromEntries(tx.writes));
    session.validateEnvelope(state);
    return { state, events: tx.events };
}

/**
 * Runs `request` against a document's logic, from `state`.
 * @param {object} snapshot - the agreement, its documents, and its current state
 * @param {string} documentId - the document whose logic handles the request
 * @param {IRequest} request - the request
 * @param {LogicRegistry} logic - each template's logic, by templateId
 * @param {Options} [options] - validation options
 * @returns {Promise<Outcome>} the response, the events emitted, and the next state
 */
export async function execute(
    snapshot: { agreement: AgreementJson; documents: DocumentJson[]; state: StateJson },
    documentId: string,
    request: IRequest,
    logic: LogicRegistry,
    options: Options = {},
): Promise<Outcome> {
    const { agreement, documents, state } = snapshot;
    const session = new Session(agreement, documents, state.revision, logic, options);
    const document = session.tree.documents.get(documentId);
    if (!document) {
        throw new Error(`No document '${documentId}' in agreement '${agreement.agreementId}'.`);
    }
    const committed = state.states ?? {};
    const tx = new Transaction({ read: id => committed[id] });

    const result = await session.run(document.root, tx, request);

    const next = session.envelope(state.revision + 1, request.$timestamp, { ...committed, ...Object.fromEntries(tx.writes) });
    session.validateEnvelope(next);
    return { result, events: tx.events, state: next };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface StateSource {
    read(id: string): IStateData | undefined;
}

/** Buffered writes, read through to `base`. */
export class Transaction implements StateSource {
    readonly writes = new Map<string, IStateData>();
    readonly events: IEvent[] = [];

    constructor(private readonly base: StateSource) {}

    read(id: string): IStateData | undefined {
        return this.writes.has(id) ? this.writes.get(id) : this.base.read(id);
    }

    write(id: string, state: IStateData): void {
        this.writes.set(id, structuredClone(state));
    }

    emit(event: IEvent): void {
        this.events.push(structuredClone(event));
    }

    nest(): Transaction {
        return new Transaction(this);
    }

    mergeInto(parent: Transaction): void {
        for (const [id, state] of this.writes) {
            parent.writes.set(id, state);
        }
        parent.events.push(...this.events);
    }
}

// ---------------------------------------------------------------------------
// The tree, and views of it
// ---------------------------------------------------------------------------

export interface Node {
    id: string;
    path: string;
    template: ITemplateReference;
    data: ITemplateData;
    parent?: Node;
    clauses: Map<string, Node>;
    document: DocumentNode;
}

export interface DocumentNode {
    id: string;
    parties: IAgreementParty[];
    root: Node;
}

export interface Tree {
    agreementId: string;
    parties: IAgreementParty[];
    documents: Map<string, DocumentNode>;
}

const idOf = (reference: string) => reference.slice(reference.lastIndexOf('#') + 1);
const join = (...paths: (string | undefined)[]) => paths.filter(Boolean).join('/');

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}

const frozenCopy = <T>(value: T): T => deepFreeze(structuredClone(value));

function buildTree(agreement: AgreementJson, documents: DocumentJson[]): Tree {
    const byId = new Map(documents.map(d => [d.documentId, d]));
    const ids = new Set<string>();
    const tree: Tree = { agreementId: agreement.agreementId, parties: frozenCopy(agreement.parties ?? []), documents: new Map() };

    const node = (
        id: string | undefined, path: string, template: ITemplateReference | undefined, data: ITemplateData | undefined,
        clauses: Record<string, ClauseJson> | undefined, document: DocumentNode, parent?: Node,
    ): Node => {
        if (!id || !template || !data) {
            throw new Error(`Instance '${path || document.id}' in document '${document.id}' needs an id, a template and data.`);
        }
        if (ids.has(id)) {
            throw new Error(`Instance id '${id}' is not unique in agreement '${agreement.agreementId}'.`);
        }
        ids.add(id);
        const result: Node = { id, path, template: frozenCopy(template), data: frozenCopy(data), parent, clauses: new Map(), document };
        for (const [key, clause] of Object.entries(clauses ?? {})) {
            result.clauses.set(key, node(clause.clauseId, join(path, key), clause.template, clause.data, clause.clauses, document, result));
        }
        return result;
    };

    for (const reference of agreement.documents) {
        const json = byId.get(idOf(reference));
        if (!json) {
            throw new Error(`Agreement '${agreement.agreementId}' references document '${idOf(reference)}', which was not supplied.`);
        }
        const document = { id: json.documentId, parties: frozenCopy(json.parties ?? []) } as DocumentNode;
        document.root = node(json.documentId, '', json.template, json.data, json.clauses, document);
        tree.documents.set(document.id, document);
    }
    return tree;
}

/** Everything one initialise() or execute() call shares. */
export class Session {
    readonly tree: Tree;
    private readonly serializer?: Serializer;
    private readonly views = new WeakMap<Transaction, Map<Node, InstanceView>>();

    constructor(
        agreement: AgreementJson,
        documents: DocumentJson[],
        readonly revision: number,
        private readonly logic: LogicRegistry,
        private readonly options: Options,
    ) {
        this.tree = buildTree(agreement, documents);
        const { models } = options;
        if (models) {
            this.serializer = new Serializer(new Factory(models), models);
            for (const node of this.nodes()) {
                for (const type of this.logicFor(node)?.requestTypes ?? []) {
                    if (type !== REQUEST_FQN && !this.supertypes(type).includes(REQUEST_FQN)) {
                        throw new Error(`Logic for '${node.template.templateId}' handles ${type}, which is not a ${REQUEST_FQN} in the models.`);
                    }
                }
            }
        }
    }

    *nodes(): Generator<Node> {
        function* walk(node: Node): Generator<Node> {
            yield node;
            for (const child of node.clauses.values()) {
                yield* walk(child);
            }
        }
        for (const document of this.tree.documents.values()) {
            yield* walk(document.root);
        }
    }

    logicFor(node: Node): Logic<any, any> | undefined {
        return this.logic[node.template.templateId];
    }

    /**
     * Runs `node`'s logic for `request`, writing into `tx`.
     * @param {Node} node - the instance
     * @param {Transaction} tx - the transaction to write into
     * @param {IRequest} request - the request
     * @returns {Promise<IResponse>} the response
     */
    async run(node: Node, tx: Transaction, request: IRequest): Promise<IResponse> {
        const logic = this.logicFor(node);
        if (!logic) {
            throw new Error(`Instance '${node.id}' has no logic to trigger.`);
        }
        if (logic.hasInit && tx.read(node.id) === undefined) {
            throw new Error(`Instance '${node.id}' has not been initialised.`);
        }
        this.validate(request, REQUEST_FQN, 'request');
        const response = await logic.handle(structuredClone(request), new SelfView(this, node, tx), type => this.supertypes(type));
        this.validate(response, RESPONSE_FQN, 'response');
        return structuredClone(response);
    }

    view(node: Node, tx: Transaction): InstanceView {
        let views = this.views.get(tx);
        if (!views) {
            this.views.set(tx, views = new Map());
        }
        let view = views.get(node);
        if (!view) {
            views.set(node, view = new InstanceView(this, node, tx));
        }
        return view;
    }

    /**
     * Validates `value` against the models, if any, and that it is, or extends, `base`.
     * @param {object} value - a Concerto value as JSON
     * @param {string} [base] - the fully-qualified name of the type it must be or extend
     * @param {string} [role] - what the value is, for the error message
     */
    validate(value: { $class?: string }, base?: string, role?: string): void {
        if (!this.serializer) {
            return;
        }
        this.serializer.fromJSON(structuredClone(value));
        if (base && value.$class !== base && !this.supertypes(value.$class!).includes(base)) {
            throw new Error(`Invalid ${role}: '${value.$class}' must be, or extend, ${base}.`);
        }
    }

    /**
     * Validates an AgreementState, when the models include runtime@1.0.0.
     * @param {StateJson} state - the state
     */
    validateEnvelope(state: StateJson): void {
        if (this.options.models?.getModelFile('org.accordproject.runtime@1.0.0')) {
            this.validate(state);
        }
    }

    envelope(revision: number, effectiveAt: string, states: Record<string, IStateData>): StateJson {
        return {
            $class: AGREEMENT_STATE_FQN,
            stateId: `${this.tree.agreementId}-state`,
            agreement: relationship(AGREEMENT_FQN, this.tree.agreementId),
            revision,
            effectiveAt,
            states,
        };
    }

    /**
     * `type`'s supertypes, nearest first; none without models, or for an unknown type.
     * @param {string} type - a fully-qualified type name
     * @returns {string[]} its supertypes
     */
    supertypes(type: string): string[] {
        const models = this.options.models;
        const supertypes: string[] = [];
        try {
            for (let s = models?.getType(type).getSuperType(); s; s = models!.getType(s).getSuperType()) {
                supertypes.push(s);
            }
        } catch {
            // Unknown types fail validation instead.
        }
        return supertypes;
    }
}

/** A read-only view of an instance, reading state through `tx`. */
export class InstanceView implements Instance {
    constructor(protected readonly session: Session, protected readonly node: Node, protected readonly tx: Transaction) {}

    get id() { return this.node.id; }
    get path() { return this.node.path; }
    get template() { return this.node.template; }
    get data() { return this.node.data; }
    get state() {
        const state = this.tx.read(this.node.id);
        return state && frozenCopy(state);
    }
    get parent(): Instance | undefined {
        return this.node.parent && this.session.view(this.node.parent, this.tx);
    }
    get clauses(): ReadonlyMap<string, Instance> {
        return new Map([...this.node.clauses].map(([key, child]) => [key, this.session.view(child, this.tx)]));
    }
    get document(): Document {
        return documentView(this.session, this.node.document, this.tx);
    }

    reference(inlinePath?: string): IAgreementReference {
        const clausePath = join(this.node.path, inlinePath);
        return {
            $class: AGREEMENT_REFERENCE_FQN,
            agreementId: this.session.tree.agreementId,
            documentId: this.node.document.id,
            ...(clausePath ? { clausePath } : {}),
        };
    }
}

/** A composed clause with logic: readable, and triggerable in a nested transaction. */
export class ClauseView extends InstanceView {
    readonly trigger = async (request: IRequest): Promise<IResponse> => {
        const nested = this.tx.nest();
        const response = await this.session.run(this.node, nested, request);
        nested.mergeInto(this.tx);
        return response;
    };
}

/** The instance whose logic is running. */
export class SelfView extends InstanceView {
    constructor(session: Session, node: Node, tx: Transaction, private readonly clauseOverrides?: Record<string, unknown>) {
        super(session, node, tx);
    }

    // A record by path, so logic can type the clauses it uses.
    // @ts-expect-error -- narrows Instance's ReadonlyMap to a record, as Self declares.
    override get clauses(): Record<string, unknown> {
        // Only an instance's own composed clauses can be triggered, and only by it:
        // everywhere else in the tree is read-only.
        return this.clauseOverrides ?? Object.fromEntries([...this.node.clauses].map(([key, child]) => [
            key,
            this.session.logicFor(child) ? new ClauseView(this.session, child, this.tx) : this.session.view(child, this.tx),
        ]));
    }

    setState(next: IStateData): void {
        this.session.validate(next, STATE_DATA_FQN, 'state');
        this.tx.write(this.node.id, next);
    }

    emit(event: IEvent): void {
        this.session.validate(event);
        this.tx.emit(event);
    }
}

function documentView(session: Session, document: DocumentNode, tx: Transaction): Document {
    return {
        id: document.id,
        parties: document.parties,
        get root() { return session.view(document.root, tx); },
        get agreement() { return agreementView(session, tx); },
    };
}

function agreementView(session: Session, tx: Transaction): Agreement {
    const { tree } = session;
    return {
        id: tree.agreementId,
        revision: session.revision,
        parties: tree.parties,
        get documents() {
            return new Map([...tree.documents].map(([id, document]) => [id, documentView(session, document, tx)]));
        },
        // The instance the reference points into: the composed clause at `clausePath`,
        // or, for a path into an inline clause, the instance whose data holds it.
        resolve(reference: IAgreementReference): Instance | undefined {
            const document = reference.agreementId === tree.agreementId && reference.documentId
                ? tree.documents.get(reference.documentId) : undefined;
            let node = document?.root;
            for (const key of reference.clausePath?.split('/') ?? []) {
                const child = node?.clauses.get(key);
                if (!child) {
                    break;
                }
                node = child;
            }
            return node && session.view(node, tx);
        },
    };
}
