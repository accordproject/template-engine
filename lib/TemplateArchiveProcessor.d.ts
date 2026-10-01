import { Template } from '@accordproject/cicero-core';
import { TwoSlashReturn } from '@typescript/twoslash';
import { LLMExecutorConfig } from './llm/LLMConfig';
import type { Logic } from './agreement/logic';
/**
 * The agreement and document a template instance runs in when its logic, written with
 * the logic API, is triggered through a TemplateArchiveProcessor: one document, holding
 * the instance, with no clauses composed into it. See AgreementProcessor for more.
 */
export declare const INSTANCE_AGREEMENT_ID = "agreement";
export declare const INSTANCE_DOCUMENT_ID = "document";
/** The contract state. */
export type State = object;
/** A response/result returned by the contract logic. */
export type Response = object;
/** An event emitted by the contract logic. */
export type Event = object;
/** The result of triggering a template: the response, updated state, and events. */
export type TriggerResponse = {
    result: Response;
    state: State;
    events: Event[];
};
/** The result of initializing a template: the initial state. */
export type InitResponse = {
    state: State;
    /** Events emitted by init, for logic written with the logic API. */
    events?: Event[];
};
/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive
 */
export declare class TemplateArchiveProcessor {
    /** The template used by the processor. */
    template: Template;
    /** Cache of compiled logic, keyed by script identifier. */
    private compiledLogicCache?;
    /** Loaded logic, for logic written with the logic API. */
    private logicApiLogic?;
    /** Optional LLM fallback configuration. */
    llmConfig?: LLMExecutorConfig;
    /** Lazily-created LLM executor reused across debug/init/trigger calls. */
    private llmExecutor?;
    /**
     * Creates a template archive processor
     * @param {Template} template - the template to be used by the processor
     * @param {LLMExecutorConfig} [llmConfig] - optional LLM fallback configuration
     */
    constructor(template: Template, llmConfig?: LLMExecutorConfig);
    /**
     * Drafts a template by merging it with data
     * @param {any} data the data to merge with the template
     * @param {string} format the output format
     * @param {any} options merge options
     * @param {[string]} currentTime the current value for 'now'
     * @returns {Promise} the drafted content
     */
    draft(data: any, format: string, options: any, currentTime?: string): Promise<any>;
    /**
     * Compile the logic of a template
     * @param {boolean} [enableCompiledLogicCache] - whether to cache the compiled logic for future use
     * @returns {Promise<Record<string, TwoSlashReturn>>} the compiled code for each typescript file
     */
    compileLogic(enableCompiledLogicCache?: boolean): Promise<Record<string, TwoSlashReturn>>;
    /**
     * Asserts that a runtime payload's declared type is, or extends, the given runtime
     * base type. This enforces the runtime class hierarchy nominally (by `$class`), which
     * the type system cannot: request is a bivariant `trigger` parameter, and State's
     * generated interface is structurally satisfied by any identified concept. Using the
     * model's own assignability, the bare base type and any subclass are accepted while a
     * plain concept that does not extend the base is rejected.
     * @param {any} payload - a serialized Concerto object (has a `$class`), or undefined
     * @param {string} baseFqn - the fully-qualified name of the runtime base type
     * @param {string} role - the payload's role, used in the error message
     * @throws {Error} if the payload's type is not the base type or a subclass of it
     */
    private assertRuntimeHierarchy;
    /**
     * Whether this template's logic is written with the logic API
     * ('@accordproject/template-engine/logic'), rather than as a TemplateLogic class.
     * @returns {boolean} true for logic written with the logic API
     */
    usesLogicApi(): boolean;
    /**
     * Compiles and loads this template's logic, written with the logic API, once.
     * @returns {Promise<Logic>} the logic
     */
    loadLogic(): Promise<Logic<any, any>>;
    /**
     * This template instance as the one document of an agreement.
     * @param {any} data - the instance's data
     * @returns {object} the agreement and document
     */
    private instanceAgreement;
    /**
     * Initialises logic written with the logic API, for one instance.
     * @param {any} data - the instance's data
     * @param {string} effectiveAt - when the instance takes effect
     * @returns {Promise<InitResponse>} its state ({} if stateless) and the events init emitted
     */
    private initLogicApi;
    /**
     * Triggers logic written with the logic API, for one instance. Its state is that
     * instance's state, as init() and trigger() return it.
     * @param {any} data - the instance's data
     * @param {any} request - the request
     * @param {any} [priorState] - the instance's state
     * @returns {Promise<TriggerResponse>} the response, the instance's next state, and events
     */
    private triggerLogicApi;
    /**
     * Populates the `contract` back-reference that `org.accordproject.runtime.Obligation`
     * (and therefore any event that extends it, e.g. a template's `PaymentObligationEvent`)
     * requires, so that template logic never has to set it explicitly.
     *
     * Only events whose `contract` field is not already set are touched, so template logic
     * that deliberately points an obligation at a different contract is left alone. Filling
     * the field in is only meaningful when the template's own data model is itself a
     * `Contract` (or a subtype of it) - that's the only instance in scope at `trigger()` time
     * that the relationship is allowed to point to. The `Serializer` this class uses is
     * constructed with `acceptResourcesForRelationships: true`, so handing it the full `data`
     * resource is enough for it to resolve the relationship from that resource's own
     * `$class`/identifier.
     * @param {Event[]} events - the events returned by the template logic, mutated in place
     * @param {any} data - the contract/clause data instance passed into trigger()
     * @throws {Error} if an Obligation-derived event is missing `contract` and the template's
     * data model does not extend Contract, so there is nothing valid to auto-populate with
     */
    private populateObligationBackReferences;
    private assertTemplateLogicSubclass;
    /**
     * Determines whether LLM fallback is enabled.
     * @returns {boolean} true if an LLM config is present and not disabled
     */
    private shouldUseLLM;
    /**
     * Constructs an LLM executor for this template.
     * @returns {LLMExecutor} the LLM executor
     * @throws {Error} if no LLM config is present
     */
    private makeLLMExecutor;
    /**
     * Executes the template's compiled TypeScript trigger logic.
     * @param {any} data - the data for the template
     * @param {any} request - the request to send to the template logic
     * @param {any} [priorState] - the state produced by init() (or a previous
     * trigger()); required for stateful templates, ignored for stateless ones
     * @param {string} [currentTime] - the current time, defaults to now
     * @param {number} [utcOffset] - the UTC offset, defaults to zero
     * @returns {Promise<TriggerResponse>} the response and any events
     */
    private executeTypeScriptTrigger;
    /**
     * Executes the template's compiled TypeScript init logic. Returns an empty
     * state when the compiled logic defines no `init` method (stateless template).
     * @param {any} data - the data for the template
     * @param {string} [currentTime] - the current time, defaults to now
     * @param {number} [utcOffset] - the UTC offset, defaults to zero
     * @returns {Promise<InitResponse>} the new state
     */
    private executeTypeScriptInit;
    /**
     * Trigger the logic of a template.
     *
     * Stateful templates (`this.template.isStateful()`) carry state across
     * executions, so they must always be seeded with `priorState` — the state
     * returned by a prior call to {@link init} (or by a prior call to
     * `trigger`) — before a request can be evaluated. There is no implicit
     * "empty" state for a template that declares custom State fields; calling
     * `trigger` without `priorState` for such a template throws. Stateless
     * templates ignore `priorState` entirely.
     * @param {object} data - the data for the template
     * @param {object} request - the request to send to the template logic
     * @param {object} priorState - the state to evaluate the request against.
     * For stateful templates this is required and must be the state produced
     * by init() or a previous trigger(); for stateless templates it is ignored.
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @param {boolean} [enableCompiledLogicCache] - whether to use the compiled logic cache
     * @returns {Promise<TriggerResponse>} the response and any events
     * @throws {Error} if the template is stateful and no priorState is supplied, or if an
     * emitted event extends `org.accordproject.runtime.Obligation` and its `contract`
     * back-reference can't be auto-populated (see {@link populateObligationBackReferences})
     */
    trigger(data: any, request: any, priorState?: any, currentTime?: string, utcOffset?: number, enableCompiledLogicCache?: boolean): Promise<TriggerResponse>;
    /**
     * Init the logic of a template.
     * @param {object} data - the data for the template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @param {boolean} [enableCompiledLogicCache] - whether to use the compiled logic cache
     * @returns {Promise<InitResponse>} the new state
     */
    init(data: any, currentTime?: string, utcOffset?: number, enableCompiledLogicCache?: boolean): Promise<InitResponse>;
}
