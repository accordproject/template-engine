import { Template } from '@accordproject/cicero-core';
import { LLMExecutorConfig } from './LLMConfig';
import type { TriggerResponse, InitResponse } from '../TemplateArchiveProcessor';
/**
 * Executes an Accord Project template's `init` / `trigger` operations using an
 * LLM, deriving the request/response/state/event schemas from the template's own
 * ModelManager. Used as a fallback when a template carries no executable logic,
 * or when LLM execution is explicitly forced.
 */
export declare class LLMExecutor {
    /** The template being executed. */
    private readonly template;
    private readonly config;
    private readonly reasoner;
    private readonly fullSchema;
    /**
     * True when the schema defines no custom State type (only the base runtime
     * State).  Stateless templates return `{}` from init and omit `state` from
     * trigger responses entirely.
     */
    private readonly stateless;
    /** Schema instances are per-executor so the object reference is stable for
     *  Anthropic's 24-hour grammar cache (same object = cache hit).
     *  For full-schema providers the defs are derived from the template's own
     *  ModelManager via tree-shaking — no external schema.json required. */
    private readonly initSchema;
    private readonly triggerSchema;
    private readonly roots;
    private readonly promptSchema;
    /**
     * Creates an executor for a template.
     * @param template - template to execute
     * @param config - LLM configuration
     */
    constructor(template: Template, config: LLMExecutorConfig);
    /**
     * Builds the shared prompt context.
     * @returns prompt context
     */
    private buildSharedContext;
    /**
     * Sends a request to the active reasoner with retries.
     * @param messages - the chat messages to send
     * @param schema - the JSON Schema the response must satisfy
     * @returns the model response content
     * @throws the last error if every attempt fails
     */
    private ask;
    /**
     * Computes the initial contract state.
     * @param data - the data for the template
     * @param currentTime - the current time, defaults to now
     * @param utcOffset - the UTC offset, defaults to zero
     * @returns the new state
     */
    init(data: any, currentTime?: string, utcOffset?: number): Promise<InitResponse>;
    /**
     * Evaluates a trigger request.
     *
     * Stateful templates (`!this.stateless`) must always be evaluated against
     * `priorState` — the state produced by a prior call to {@link init} (or by
     * a prior call to `trigger`) — since there is no implicit "empty" state for
     * a template that declares custom State fields. Stateless templates ignore
     * `priorState` entirely.
     * @param data - the data for the template
     * @param request - the request to send to the contract logic
     * @param priorState - the state to evaluate the request against. Required
     * for stateful templates (must originate from init() or a previous
     * trigger()); ignored for stateless templates.
     * @param currentTime - the current time. Only used when the request carries
     * no `$timestamp`, which always takes precedence; defaults to now
     * @param utcOffset - the UTC offset, defaults to zero
     * @returns the response, updated state, and any events
     * @throws {Error} if the template is stateful and no priorState is supplied
     */
    trigger(data: any, request: any, priorState?: any, currentTime?: string, utcOffset?: number): Promise<TriggerResponse>;
}
