"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfView = exports.ClauseView = exports.InstanceView = exports.Session = exports.Transaction = exports.relationship = exports.STATE_DATA_FQN = exports.TEMPLATE_DATA_FQN = exports.RESPONSE_FQN = exports.REQUEST_FQN = exports.AGREEMENT_STATE_FQN = exports.CLAUSE_FQN = exports.AGREEMENT_REFERENCE_FQN = exports.AGREEMENT_DOCUMENT_FQN = exports.AGREEMENT_FQN = void 0;
exports.initialise = initialise;
exports.execute = execute;
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
const concerto_core_1 = require("@accordproject/concerto-core");
exports.AGREEMENT_FQN = 'org.accordproject.agreement@1.0.0.Agreement';
exports.AGREEMENT_DOCUMENT_FQN = 'org.accordproject.agreement@1.0.0.AgreementDocument';
exports.AGREEMENT_REFERENCE_FQN = 'org.accordproject.agreement@1.0.0.AgreementReference';
exports.CLAUSE_FQN = 'org.accordproject.agreement@1.0.0.Clause';
exports.AGREEMENT_STATE_FQN = 'org.accordproject.runtime@1.0.0.AgreementState';
exports.REQUEST_FQN = 'org.accordproject.runtime@1.0.0.Request';
exports.RESPONSE_FQN = 'org.accordproject.runtime@1.0.0.Response';
exports.TEMPLATE_DATA_FQN = 'org.accordproject.templatedata@1.0.0.TemplateData';
exports.STATE_DATA_FQN = 'org.accordproject.templatedata@1.0.0.StateData';
/** A relationship to an identified instance, as JSON. */
const relationship = (fqn, id) => `resource:${fqn}#${id}`;
exports.relationship = relationship;
/**
 * Initialises every instance in the agreement, as revision 0.
 * @param {AgreementJson} agreement - the agreement
 * @param {DocumentJson[]} documents - its documents
 * @param {string} effectiveAt - when the agreement takes effect
 * @param {LogicRegistry} logic - each template's logic, by templateId
 * @param {Options} [options] - validation options
 * @returns {Promise<Initialised>} the initial state, and the events init emitted
 */
async function initialise(agreement, documents, effectiveAt, logic, options = {}) {
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
async function execute(snapshot, documentId, request, logic, options = {}) {
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
/** Buffered writes, read through to `base`. */
class Transaction {
    constructor(base) {
        this.base = base;
        this.writes = new Map();
        this.events = [];
    }
    read(id) {
        return this.writes.has(id) ? this.writes.get(id) : this.base.read(id);
    }
    write(id, state) {
        this.writes.set(id, structuredClone(state));
    }
    emit(event) {
        this.events.push(structuredClone(event));
    }
    nest() {
        return new Transaction(this);
    }
    mergeInto(parent) {
        for (const [id, state] of this.writes) {
            parent.writes.set(id, state);
        }
        parent.events.push(...this.events);
    }
}
exports.Transaction = Transaction;
const idOf = (reference) => reference.slice(reference.lastIndexOf('#') + 1);
const join = (...paths) => paths.filter(Boolean).join('/');
function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}
const frozenCopy = (value) => deepFreeze(structuredClone(value));
function buildTree(agreement, documents) {
    const byId = new Map(documents.map(d => [d.documentId, d]));
    const ids = new Set();
    const tree = { agreementId: agreement.agreementId, parties: frozenCopy(agreement.parties ?? []), documents: new Map() };
    const node = (id, path, template, data, clauses, document, parent) => {
        if (!id || !template || !data) {
            throw new Error(`Instance '${path || document.id}' in document '${document.id}' needs an id, a template and data.`);
        }
        if (ids.has(id)) {
            throw new Error(`Instance id '${id}' is not unique in agreement '${agreement.agreementId}'.`);
        }
        ids.add(id);
        const result = { id, path, template: frozenCopy(template), data: frozenCopy(data), parent, clauses: new Map(), document };
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
        const document = { id: json.documentId, parties: frozenCopy(json.parties ?? []) };
        document.root = node(json.documentId, '', json.template, json.data, json.clauses, document);
        tree.documents.set(document.id, document);
    }
    return tree;
}
/** Everything one initialise() or execute() call shares. */
class Session {
    constructor(agreement, documents, revision, logic, options) {
        this.revision = revision;
        this.logic = logic;
        this.options = options;
        this.views = new WeakMap();
        this.tree = buildTree(agreement, documents);
        const { models } = options;
        if (models) {
            this.serializer = new concerto_core_1.Serializer(new concerto_core_1.Factory(models), models);
            for (const node of this.nodes()) {
                for (const type of this.logicFor(node)?.requestTypes ?? []) {
                    if (type !== exports.REQUEST_FQN && !this.supertypes(type).includes(exports.REQUEST_FQN)) {
                        throw new Error(`Logic for '${node.template.templateId}' handles ${type}, which is not a ${exports.REQUEST_FQN} in the models.`);
                    }
                }
            }
        }
    }
    *nodes() {
        function* walk(node) {
            yield node;
            for (const child of node.clauses.values()) {
                yield* walk(child);
            }
        }
        for (const document of this.tree.documents.values()) {
            yield* walk(document.root);
        }
    }
    logicFor(node) {
        return this.logic[node.template.templateId];
    }
    /**
     * Runs `node`'s logic for `request`, writing into `tx`.
     * @param {Node} node - the instance
     * @param {Transaction} tx - the transaction to write into
     * @param {IRequest} request - the request
     * @returns {Promise<IResponse>} the response
     */
    async run(node, tx, request) {
        const logic = this.logicFor(node);
        if (!logic) {
            throw new Error(`Instance '${node.id}' has no logic to trigger.`);
        }
        if (logic.hasInit && tx.read(node.id) === undefined) {
            throw new Error(`Instance '${node.id}' has not been initialised.`);
        }
        this.validate(request, exports.REQUEST_FQN, 'request');
        const response = await logic.handle(structuredClone(request), new SelfView(this, node, tx), type => this.supertypes(type));
        this.validate(response, exports.RESPONSE_FQN, 'response');
        return structuredClone(response);
    }
    view(node, tx) {
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
    validate(value, base, role) {
        if (!this.serializer) {
            return;
        }
        this.serializer.fromJSON(structuredClone(value));
        if (base && value.$class !== base && !this.supertypes(value.$class).includes(base)) {
            throw new Error(`Invalid ${role}: '${value.$class}' must be, or extend, ${base}.`);
        }
    }
    /**
     * Validates an AgreementState, when the models include runtime@1.0.0.
     * @param {StateJson} state - the state
     */
    validateEnvelope(state) {
        if (this.options.models?.getModelFile('org.accordproject.runtime@1.0.0')) {
            this.validate(state);
        }
    }
    envelope(revision, effectiveAt, states) {
        return {
            $class: exports.AGREEMENT_STATE_FQN,
            stateId: `${this.tree.agreementId}-state`,
            agreement: (0, exports.relationship)(exports.AGREEMENT_FQN, this.tree.agreementId),
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
    supertypes(type) {
        const models = this.options.models;
        const supertypes = [];
        try {
            for (let s = models?.getType(type).getSuperType(); s; s = models.getType(s).getSuperType()) {
                supertypes.push(s);
            }
        }
        catch {
            // Unknown types fail validation instead.
        }
        return supertypes;
    }
}
exports.Session = Session;
/** A read-only view of an instance, reading state through `tx`. */
class InstanceView {
    constructor(session, node, tx) {
        this.session = session;
        this.node = node;
        this.tx = tx;
    }
    get id() { return this.node.id; }
    get path() { return this.node.path; }
    get template() { return this.node.template; }
    get data() { return this.node.data; }
    get state() {
        const state = this.tx.read(this.node.id);
        return state && frozenCopy(state);
    }
    get parent() {
        return this.node.parent && this.session.view(this.node.parent, this.tx);
    }
    get clauses() {
        return new Map([...this.node.clauses].map(([key, child]) => [key, this.session.view(child, this.tx)]));
    }
    get document() {
        return documentView(this.session, this.node.document, this.tx);
    }
    reference(inlinePath) {
        const clausePath = join(this.node.path, inlinePath);
        return {
            $class: exports.AGREEMENT_REFERENCE_FQN,
            agreementId: this.session.tree.agreementId,
            documentId: this.node.document.id,
            ...(clausePath ? { clausePath } : {}),
        };
    }
}
exports.InstanceView = InstanceView;
/** A composed clause with logic: readable, and triggerable in a nested transaction. */
class ClauseView extends InstanceView {
    constructor() {
        super(...arguments);
        this.trigger = async (request) => {
            const nested = this.tx.nest();
            const response = await this.session.run(this.node, nested, request);
            nested.mergeInto(this.tx);
            return response;
        };
    }
}
exports.ClauseView = ClauseView;
/** The instance whose logic is running. */
class SelfView extends InstanceView {
    constructor(session, node, tx, clauseOverrides) {
        super(session, node, tx);
        this.clauseOverrides = clauseOverrides;
    }
    // A record by path, so logic can type the clauses it uses.
    // @ts-expect-error -- narrows Instance's ReadonlyMap to a record, as Self declares.
    get clauses() {
        // Only an instance's own composed clauses can be triggered, and only by it:
        // everywhere else in the tree is read-only.
        return this.clauseOverrides ?? Object.fromEntries([...this.node.clauses].map(([key, child]) => [
            key,
            this.session.logicFor(child) ? new ClauseView(this.session, child, this.tx) : this.session.view(child, this.tx),
        ]));
    }
    setState(next) {
        this.session.validate(next, exports.STATE_DATA_FQN, 'state');
        this.tx.write(this.node.id, next);
    }
    emit(event) {
        this.session.validate(event);
        this.tx.emit(event);
    }
}
exports.SelfView = SelfView;
function documentView(session, document, tx) {
    return {
        id: document.id,
        parties: document.parties,
        get root() { return session.view(document.root, tx); },
        get agreement() { return agreementView(session, tx); },
    };
}
function agreementView(session, tx) {
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
        resolve(reference) {
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
//# sourceMappingURL=execute.js.map