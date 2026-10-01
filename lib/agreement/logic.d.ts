/** Any Concerto value. */
export interface IConcept {
    $class: string;
}
/** A Concerto transaction or event: org.accordproject.runtime@1.0.0 Request and Response, or an emitted event. */
export interface ITimestamped extends IConcept {
    $timestamp: string;
}
export type IRequest = ITimestamped;
export type IResponse = ITimestamped;
export type IEvent = ITimestamped;
/** org.accordproject.templatedata@1.0.0.TemplateData, or a subtype: a template's data. */
export type ITemplateData = IConcept;
/** org.accordproject.templatedata@1.0.0.StateData, or a subtype: a template instance's state. */
export type IStateData = IConcept;
/** The parts of an org.accordproject.template@1.0.0.TemplateReference logic can rely on. */
export interface ITemplateReference extends IConcept {
    templateId: string;
    version: string;
}
/** The parts of an org.accordproject.agreement@1.0.0.AgreementParty logic can rely on. */
export interface IAgreementParty extends IConcept {
    party: unknown;
    role: string;
}
/**
 * An org.accordproject.agreement@1.0.0.AgreementReference to an instance, or to an inline
 * clause in its data, assignable to the generated interface.
 */
export interface IAgreementReference extends IConcept {
    agreementId: string;
    documentId?: string;
    clausePath?: string;
}
export type DeepReadonly<T> = T extends (infer U)[] ? readonly DeepReadonly<U>[] : T extends Map<infer K, infer V> ? ReadonlyMap<K, DeepReadonly<V>> : T extends object ? {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
} : T;
/** A template instance: a document, or a clause composed into one. Read-only. */
export interface Instance<Data extends ITemplateData = ITemplateData, State extends IStateData = IStateData> {
    /** Stable instance id: the document's `documentId`, or the clause's `clauseId`. */
    readonly id: string;
    /** Path from the document root, '/'-separated: '' for the document itself. */
    readonly path: string;
    readonly template: DeepReadonly<ITemplateReference>;
    readonly data: DeepReadonly<Data>;
    /** Absent for a stateless instance. */
    readonly state: DeepReadonly<State> | undefined;
    /** The instance this one is composed into; absent for a document. */
    readonly parent: Instance | undefined;
    /** Composed clauses, by path within this instance. */
    readonly clauses: ReadonlyMap<string, Instance>;
    readonly document: Document;
    /**
     * A reference to this instance, or to an inline clause within it (a path into its
     * data), for records that travel without the agreement, such as obligations.
     */
    reference(inlinePath?: string): IAgreementReference;
}
export interface Document {
    readonly id: string;
    readonly parties: readonly DeepReadonly<IAgreementParty>[];
    readonly root: Instance;
    readonly agreement: Agreement;
}
export interface Agreement {
    readonly id: string;
    /** The revision this request was triggered against. */
    readonly revision: number;
    readonly parties: readonly DeepReadonly<IAgreementParty>[];
    /** In reading order. */
    readonly documents: ReadonlyMap<string, Document>;
    resolve(reference: IAgreementReference): Instance | undefined;
}
/**
 * The instance whose logic is running. Unlike every other node, it can be written: its
 * own state, the events it emits, and, by triggering them, the clauses composed into it.
 * Writes are buffered and visible to it straight away; nothing is visible elsewhere until
 * the engine commits.
 *
 * `Clauses` types the composed clauses the logic uses, by path (see `Clause`); a composed
 * clause with no logic is a plain `Instance`.
 */
export interface Self<Data extends ITemplateData, State extends IStateData | undefined = undefined, Clauses = {}> extends Omit<Instance<Data>, 'state' | 'clauses'> {
    /** Typed as present: handlers run only after init() has set it. */
    readonly state: State extends IStateData ? DeepReadonly<State> : undefined;
    readonly clauses: Clauses;
    setState(next: State): void;
    emit(event: IEvent): void;
}
/** A Concerto value with its `$class` narrowed to one literal type. */
export type Typed<T extends IConcept, C extends string> = T & {
    readonly $class: C;
};
/** A type's fields, without the system fields its factory fills in. */
export type Fields<T> = Omit<T, '$class' | '$identifier'>;
/**
 * A concrete Concerto type as a runtime value: a factory for values of that type, a type
 * guard, and, for a request type, the key logic registers a handler under. Generated from
 * the model alongside its interfaces (logic/generated/types.ts), and supplied by the
 * engine when logic runs.
 */
export interface ConceptType<T extends IConcept, C extends string = string> {
    readonly $class: C;
    /** A value of this type: `fields`, plus its `$class` (and `$identifier`, for an identified type). */
    create(fields: Fields<T>): Typed<T, C>;
    /** Whether `value` is exactly this type. */
    is<V extends {
        readonly $class: string;
    }>(value: V): value is V & Typed<T, C>;
}
/** An identified Concerto type (an asset or participant). */
export interface IdentifiedType<T extends IConcept, C extends string = string> extends ConceptType<T, C> {
    /** A relationship to the instance identified by `id`, typed as generated interfaces type relationships. */
    ref(id: string): T;
}
/** A request type: what logic registers a handler for. */
export type RequestType<R extends IRequest, C extends string = string> = ConceptType<R, C>;
export declare function conceptType<T extends IConcept>(): <C extends string>($class: C) => ConceptType<T, C>;
export declare function identifiedType<T extends IConcept>(): <C extends string>($class: C, identifiedBy: keyof Fields<T> & string) => IdentifiedType<T, C>;
/** One request a template handles, and the response it returns. */
export interface Handles {
    $class: string;
    request: IRequest;
    response: IResponse;
}
type Overloads<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
/** One `trigger` overload per request type the clause's logic handles. */
export type TriggerOf<A extends Handles> = Overloads<A extends Handles ? (request: Typed<A['request'], A['$class']>) => Promise<A['response']> : never>;
/**
 * A composed clause, as the instance it's composed into sees it: readable like any
 * instance, and triggerable with the requests its logic handles. `A` is the clause
 * logic's API (`ApiOf<typeof itsLogic>`), so the parent depends only on the clause's
 * request and response types.
 */
export interface Clause<A extends Handles> extends Instance {
    readonly trigger: TriggerOf<A>;
}
export interface Logic<S, A extends Handles = never> {
    /** Registers the instance's initialisation: typically setState and emit. */
    init(handler: (self: S) => void | Promise<void>): Logic<S, A>;
    /** Registers the handler for one request type. */
    on<R extends IRequest, C extends string, Res extends IResponse>(type: RequestType<R, C>, handler: (request: R, self: S) => Promise<Res>): Logic<S, A | {
        $class: C;
        request: R;
        response: Res;
    }>;
    /** The request types handlers are registered for. */
    readonly requestTypes: readonly string[];
    readonly hasInit: boolean;
    /** Runs the init handler, if any. */
    start(self: S): Promise<void>;
    /**
     * Runs the handler for `request`: the one registered for its type, or else for its
     * nearest supertype (`supertypes` lists them, nearest first). A request nothing
     * handles is rejected before any logic runs.
     */
    handle(request: IRequest, self: S, supertypes?: (type: string) => string[]): Promise<IResponse>;
}
/** The requests and responses a logic handles: what a `Clause` of it accepts. */
export type ApiOf<L> = L extends Logic<any, infer A> ? A : never;
/** Starts a template's logic; `S` is its `Self` type. */
export declare function defineLogic<S>(): Logic<S>;
/** Whether `value` is a template's logic, as `defineLogic` makes it. */
export declare function isLogic(value: unknown): value is Logic<unknown, any>;
export {};
