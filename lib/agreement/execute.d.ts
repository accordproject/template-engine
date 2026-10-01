import { ModelManager } from '@accordproject/concerto-core';
import type { Document, IAgreementParty, IAgreementReference, IEvent, Instance, IRequest, IResponse, IStateData, ITemplateData, ITemplateReference, Logic } from './logic';
export declare const AGREEMENT_FQN = "org.accordproject.agreement@1.0.0.Agreement";
export declare const AGREEMENT_DOCUMENT_FQN = "org.accordproject.agreement@1.0.0.AgreementDocument";
export declare const AGREEMENT_REFERENCE_FQN = "org.accordproject.agreement@1.0.0.AgreementReference";
export declare const CLAUSE_FQN = "org.accordproject.agreement@1.0.0.Clause";
export declare const AGREEMENT_STATE_FQN = "org.accordproject.runtime@1.0.0.AgreementState";
export declare const REQUEST_FQN = "org.accordproject.runtime@1.0.0.Request";
export declare const RESPONSE_FQN = "org.accordproject.runtime@1.0.0.Response";
export declare const TEMPLATE_DATA_FQN = "org.accordproject.templatedata@1.0.0.TemplateData";
export declare const STATE_DATA_FQN = "org.accordproject.templatedata@1.0.0.StateData";
/** A relationship to an identified instance, as JSON. */
export declare const relationship: (fqn: string, id: string) => string;
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
export declare function initialise(agreement: AgreementJson, documents: DocumentJson[], effectiveAt: string, logic: LogicRegistry, options?: Options): Promise<Initialised>;
/**
 * Runs `request` against a document's logic, from `state`.
 * @param {object} snapshot - the agreement, its documents, and its current state
 * @param {string} documentId - the document whose logic handles the request
 * @param {IRequest} request - the request
 * @param {LogicRegistry} logic - each template's logic, by templateId
 * @param {Options} [options] - validation options
 * @returns {Promise<Outcome>} the response, the events emitted, and the next state
 */
export declare function execute(snapshot: {
    agreement: AgreementJson;
    documents: DocumentJson[];
    state: StateJson;
}, documentId: string, request: IRequest, logic: LogicRegistry, options?: Options): Promise<Outcome>;
export interface StateSource {
    read(id: string): IStateData | undefined;
}
/** Buffered writes, read through to `base`. */
export declare class Transaction implements StateSource {
    private readonly base;
    readonly writes: Map<string, import("./logic").IConcept>;
    readonly events: IEvent[];
    constructor(base: StateSource);
    read(id: string): IStateData | undefined;
    write(id: string, state: IStateData): void;
    emit(event: IEvent): void;
    nest(): Transaction;
    mergeInto(parent: Transaction): void;
}
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
/** Everything one initialise() or execute() call shares. */
export declare class Session {
    readonly revision: number;
    private readonly logic;
    private readonly options;
    readonly tree: Tree;
    private readonly serializer?;
    private readonly views;
    constructor(agreement: AgreementJson, documents: DocumentJson[], revision: number, logic: LogicRegistry, options: Options);
    nodes(): Generator<Node>;
    logicFor(node: Node): Logic<any, any> | undefined;
    /**
     * Runs `node`'s logic for `request`, writing into `tx`.
     * @param {Node} node - the instance
     * @param {Transaction} tx - the transaction to write into
     * @param {IRequest} request - the request
     * @returns {Promise<IResponse>} the response
     */
    run(node: Node, tx: Transaction, request: IRequest): Promise<IResponse>;
    view(node: Node, tx: Transaction): InstanceView;
    /**
     * Validates `value` against the models, if any, and that it is, or extends, `base`.
     * @param {object} value - a Concerto value as JSON
     * @param {string} [base] - the fully-qualified name of the type it must be or extend
     * @param {string} [role] - what the value is, for the error message
     */
    validate(value: {
        $class?: string;
    }, base?: string, role?: string): void;
    /**
     * Validates an AgreementState, when the models include runtime@1.0.0.
     * @param {StateJson} state - the state
     */
    validateEnvelope(state: StateJson): void;
    envelope(revision: number, effectiveAt: string, states: Record<string, IStateData>): StateJson;
    /**
     * `type`'s supertypes, nearest first; none without models, or for an unknown type.
     * @param {string} type - a fully-qualified type name
     * @returns {string[]} its supertypes
     */
    supertypes(type: string): string[];
}
/** A read-only view of an instance, reading state through `tx`. */
export declare class InstanceView implements Instance {
    protected readonly session: Session;
    protected readonly node: Node;
    protected readonly tx: Transaction;
    constructor(session: Session, node: Node, tx: Transaction);
    get id(): string;
    get path(): string;
    get template(): ITemplateReference;
    get data(): import("./logic").IConcept;
    get state(): import("./logic").IConcept | undefined;
    get parent(): Instance | undefined;
    get clauses(): ReadonlyMap<string, Instance>;
    get document(): Document;
    reference(inlinePath?: string): IAgreementReference;
}
/** A composed clause with logic: readable, and triggerable in a nested transaction. */
export declare class ClauseView extends InstanceView {
    readonly trigger: (request: IRequest) => Promise<IResponse>;
}
/** The instance whose logic is running. */
export declare class SelfView extends InstanceView {
    private readonly clauseOverrides?;
    constructor(session: Session, node: Node, tx: Transaction, clauseOverrides?: Record<string, unknown> | undefined);
    get clauses(): Record<string, unknown>;
    setState(next: IStateData): void;
    emit(event: IEvent): void;
}
