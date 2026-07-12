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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Template } from '@accordproject/cicero-core';
import { Factory, Serializer } from '@accordproject/concerto-core';
import { TemplateMarkInterpreter } from './TemplateMarkInterpreter';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { transform } from '@accordproject/markdown-transform';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
// @ts-expect-error - this type export is missing in recent cicero-core versions but is still required for TypeScript AST
import Script from '@accordproject/cicero-core/types/src/script';
import { TwoSlashReturn } from '@typescript/twoslash';
import { JavaScriptEvaluator } from './JavaScriptEvaluator';
import { LLMExecutor } from './llm/LLMExecutor';
import { LLMExecutorConfig } from './llm/LLMConfig';

// The runtime Request base type. Note it is a *concrete* (non-abstract) transaction in
// org.accordproject.runtime@0.2.0, so it is always an assignable class of itself: a
// base-inclusive query (getRequestTypes) can never be empty. We therefore query with the
// base excluded, matching how the compilation context derives the RuntimeRequest union.
const RUNTIME_REQUEST_FQN = 'org.accordproject.runtime@0.2.0.Request';

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
}

/** The result of initializing a template: the initial state. */
export type InitResponse = {
    state: State;
}

/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive
 */
export class TemplateArchiveProcessor {
    /** The template used by the processor. */
    template: Template;

    /** Cache of compiled logic, keyed by script identifier. */
    private compiledLogicCache?: Record<string, TwoSlashReturn>;

    /** Optional LLM fallback configuration. */
    llmConfig?: LLMExecutorConfig;

    /** Lazily-created LLM executor reused across debug/init/trigger calls. */
    private llmExecutor?: LLMExecutor;

    /**
     * Creates a template archive processor
     * @param {Template} template - the template to be used by the processor
     * @param {LLMExecutorConfig} [llmConfig] - optional LLM fallback configuration
     */
    constructor(template: Template, llmConfig?: LLMExecutorConfig) {
        this.template = template;
        this.llmConfig = llmConfig;
    }

    /**
     * Drafts a template by merging it with data
     * @param {any} data the data to merge with the template
     * @param {string} format the output format
     * @param {any} options merge options
     * @param {[string]} currentTime the current value for 'now'
     * @returns {Promise} the drafted content
     */
    async draft(data: any, format: string, options: any, currentTime?: string): Promise<any> {
        // Setup
        const metadata = this.template.getMetadata();
        const templateKind = metadata.getTemplateType() !== 0 ? 'clause' : 'contract';

        // Get the data
        const modelManager = this.template.getModelManager();
        const engine = new TemplateMarkInterpreter(modelManager, {});
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
            { content: this.template.getTemplate() }, modelManager, templateKind);
        const now = currentTime ? currentTime : new Date().toISOString();
        const ciceroMark = await engine.generate(templateMarkDom, data, { now });
        const result = transform(ciceroMark.toJSON(), 'ciceromark', ['ciceromark_unquoted', format], null, options);
        return result;
    }

    /**
     * Compile the logic of a template
     * @param {boolean} [enableCompiledLogicCache] - whether to cache the compiled logic for future use
     * @returns {Promise<Record<string, TwoSlashReturn>>} the compiled code for each typescript file
     */
    async compileLogic(enableCompiledLogicCache: boolean = false): Promise<Record<string, TwoSlashReturn>> {
        if (enableCompiledLogicCache && this.compiledLogicCache) {
            return this.compiledLogicCache;
        }

        const logicManager = this.template.getLogicManager();
        if (logicManager.getLanguage() === 'typescript') {
            const compiledCode: Record<string, TwoSlashReturn> = {};
            const tsFiles: Array<Script> = logicManager.getScriptManager().getScriptsForTarget('typescript');
            for (let n = 0; n < tsFiles.length; n++) {
                const tsFile = tsFiles[n];

                const compiler = new TypeScriptToJavaScriptCompiler(this.template.getModelManager(),
                    this.template.getTemplateModel().getFullyQualifiedName());

                await compiler.initialize();

                // The runtime type declarations (IConcept, TemplateLogic, etc.) are
                // provided by the compilation context, with the State / Obligation type
                // parameters bound to the concrete subclasses declared by the model.
                const result = compiler.compile(tsFile.getContents());

                // Enforce the runtime model hierarchy at compile time. When a template's
                // "state" is a plain concept (rather than an asset extending the runtime
                // State), the RuntimeState union is `never` and using that type as the
                // logic's state raises TS2344 ("Type '...' does not satisfy the constraint
                // 'never'"). The same applies to Obligation events. We only enforce this
                // for the logic entry point and only for the constraint-violation code, so
                // that unrelated diagnostics (and non-logic scripts such as README.md) do
                // not turn into hard failures.
                const isLogicEntry = tsFile.getIdentifier().endsWith('logic.ts');
                if (isLogicEntry) {
                    const hierarchyErrors = (result.errors || [])
                        .filter(e => e.category === 1 && e.code === 2344);
                    if (hierarchyErrors.length > 0) {
                        const message = hierarchyErrors.map(e => e.renderedMessage).join('\n');
                        throw new Error(
                            'Invalid template: State and Obligation declarations must extend the ' +
                            `runtime State / Obligation types.\n${message}`);
                    }

                    // Enforce the runtime Request hierarchy at the model level. Unlike State,
                    // Response and Event, the request type cannot be enforced at compile time:
                    // it appears only as the `request` parameter of `trigger`, and TypeScript
                    // method parameters are bivariant, so the model-derived `never` bound accepts
                    // any type. We therefore assert the invariant against the model:
                    // getRequestTypes() returns only concrete subclasses of the runtime Request,
                    // so a "request" declared as a plain concept (that does not extend Request)
                    // yields an empty list. We require this only when the logic defines a trigger.
                    this.assertTriggerRequestType(tsFile.getContents());
                }

                compiledCode[tsFile.getIdentifier()] = result;
            }
            if (enableCompiledLogicCache) {
                this.compiledLogicCache = compiledCode;
            }
            return compiledCode;
        } else {
            throw new Error('Only TypeScript is supported at this time');
        }
    }

    /**
     * Asserts that a template whose logic defines a `trigger` declares a request type
     * that extends the runtime Request. See the note in compileLogic for why this is a
     * model-level check rather than a compile-time one.
     *
     * The base Request is concrete, so it is always assignable to itself; we must query
     * with the base excluded (as `isStateful` and the RuntimeRequest union do) or the
     * check could never fail. An empty result means no transaction actually extends
     * Request — e.g. the "request" was declared as a plain concept.
     * @param {string} logicSource - the source of the logic entry file
     * @throws {Error} if the logic triggers but no valid request subtype is declared
     */
    private assertTriggerRequestType(logicSource: string): void {
        const definesTrigger = /\btrigger\s*\(/.test(logicSource);
        const requestSubtypes = this.template.findConcreteSubclassNames(RUNTIME_REQUEST_FQN, true);
        if (definesTrigger && requestSubtypes.length === 0) {
            throw new Error(
                'Invalid template: the trigger logic requires a request that extends the ' +
                `runtime Request type (${RUNTIME_REQUEST_FQN}), but the model declares none. ` +
                'Declare the request as a transaction that extends Request.');
        }
    }

    /**
     * Determines whether LLM fallback is enabled.
     * @returns {boolean} true if an LLM config is present and not disabled
     */
    private shouldUseLLM(): boolean {
        return !!this.llmConfig && this.llmConfig.mode !== 'disabled';
    }

    /**
     * Constructs an LLM executor for this template.
     * @returns {LLMExecutor} the LLM executor
     * @throws {Error} if no LLM config is present
     */
    private makeLLMExecutor(): LLMExecutor {
        if (!this.llmConfig) {
            throw new Error('LLM fallback requested but llmConfig is missing');
        }
        if (!this.llmExecutor) {
            this.llmExecutor = new LLMExecutor(this.template, this.llmConfig);
        }
        return this.llmExecutor;
    }

    /**
     * Executes the template's compiled TypeScript trigger logic.
     * @param {any} data - the data for the template
     * @param {any} request - the request to send to the template logic
     * @param {any} [state] - the current state of the template
     * @param {string} [currentTime] - the current time, defaults to now
     * @param {number} [utcOffset] - the UTC offset, defaults to zero
     * @returns {Promise<TriggerResponse>} the response and any events
     */
    private async executeTypeScriptTrigger(data: any, request: any, state?: any, currentTime?: string, utcOffset?: number): Promise<TriggerResponse> {
        const compiledCode = await this.compileLogic();
        const resolvedTime = currentTime ?? new Date().toISOString();
        const resolvedOffset = utcOffset ?? 0;
        const evaluator = new JavaScriptEvaluator();
        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName: 'trigger',
            code: compiledCode['logic/logic.ts'].code, // TODO DCS - how to find the code to run?
            argumentNames: ['data', 'request', 'state'],
            arguments: [data, request, state, resolvedTime, resolvedOffset]
        });
        if (evalResponse.result) {
            return evalResponse.result as TriggerResponse;
        } else {
            throw new Error('Trigger failed with message: ' + evalResponse.message);
        }
    }

    /**
     * Executes the template's compiled TypeScript init logic. Returns an empty
     * state when the compiled logic defines no `init` method (stateless template).
     * @param {any} data - the data for the template
     * @param {string} [currentTime] - the current time, defaults to now
     * @param {number} [utcOffset] - the UTC offset, defaults to zero
     * @returns {Promise<InitResponse>} the new state
     */
    private async executeTypeScriptInit(data: any, currentTime?: string, utcOffset?: number): Promise<InitResponse> {
        const compiledCode = await this.compileLogic();
        const logicCode = compiledCode['logic/logic.ts']?.code;

        // Check if the compiled code even contains an `init` method before calling it
        if (!logicCode || (!logicCode.includes('init(') && !logicCode.includes('init ('))) {
            // Stateless template — no init method defined, return empty state
            return { state: {} };
        }

        const resolvedTime = currentTime ?? new Date().toISOString();
        const resolvedOffset = utcOffset ?? 0;
        const evaluator = new JavaScriptEvaluator();
        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName: 'init',
            code: logicCode, // TODO DCS - how to find the code to run?
            argumentNames: ['data'],
            arguments: [data, resolvedTime, resolvedOffset]
        });
        if (evalResponse.result) {
            return evalResponse.result as InitResponse;
        } else {
            throw new Error('Init failed with message: ' + evalResponse.message);
        }
    }

    /**
     * Trigger the logic of a template.
     * @param {object} data - the data for the template
     * @param {object} request - the request to send to the template logic
     * @param {object} state - the current state of the template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @param {boolean} [enableCompiledLogicCache] - whether to use the compiled logic cache
     * @returns {Promise<TriggerResponse>} the response and any events
     */
    async trigger(data: any, request: any, state?: any, currentTime?: string, utcOffset?: number, enableCompiledLogicCache?: boolean): Promise<TriggerResponse> {
        const factory = new Factory(this.template.getModelManager());
        const serializer = new Serializer(factory, this.template.getModelManager(), { validate: true, acceptResourcesForRelationships: true });
        
        // validate inputs before execution
        if (data) serializer.fromJSON(data);
        if (request) serializer.fromJSON(request);
        if (state) serializer.fromJSON(state);

        let triggerResponse: TriggerResponse;
        const forceLLM = this.llmConfig?.mode === 'force';

        // Run the template's TypeScript logic unless the caller forces the LLM path.
        if (!forceLLM && this.template.hasLogic()) {
            if (enableCompiledLogicCache) {
                await this.compileLogic(true);
            }
            triggerResponse = await this.executeTypeScriptTrigger(data, request, state, currentTime, utcOffset);
        } else if (forceLLM || this.shouldUseLLM()) {
            // Otherwise use the LLM executor
            triggerResponse = await this.makeLLMExecutor().trigger(data, request, state, currentTime, utcOffset);
        } else {
            throw new Error('No executable logic found and LLM fallback is disabled');
        }

        // validate outputs after execution
        if (triggerResponse.state) serializer.fromJSON(triggerResponse.state);
        if (triggerResponse.result) serializer.fromJSON(triggerResponse.result);
        if (triggerResponse.events && Array.isArray(triggerResponse.events)) {
            triggerResponse.events.forEach(e => serializer.fromJSON(e));
        }

        return triggerResponse;
    }

    /**
     * Init the logic of a template.
     * @param {object} data - the data for the template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @param {boolean} [enableCompiledLogicCache] - whether to use the compiled logic cache
     * @returns {Promise<InitResponse>} the new state
     */
    async init(data: any, currentTime?: string, utcOffset?: number, enableCompiledLogicCache?: boolean): Promise<InitResponse> {
        const factory = new Factory(this.template.getModelManager());
        const serializer = new Serializer(factory, this.template.getModelManager(), { validate: true, acceptResourcesForRelationships: true });
        
        // validate inputs before execution
        if (data) serializer.fromJSON(data);

        let initResponse: InitResponse;
        const forceLLM = this.llmConfig?.mode === 'force';

        // Run the template's TypeScript logic unless the caller forces the LLM path.
        if (!forceLLM && this.template.hasLogic()) {
            if (enableCompiledLogicCache) {
                await this.compileLogic(true);
            }
            initResponse = await this.executeTypeScriptInit(data, currentTime, utcOffset);
        } else if (forceLLM || this.shouldUseLLM()) {
            // Otherwise use the LLM executor
            initResponse = await this.makeLLMExecutor().init(data, currentTime, utcOffset);
        } else {
            throw new Error('No executable logic found and LLM fallback is disabled');
        }

        // validate outputs after execution
        if (initResponse.state) serializer.fromJSON(initResponse.state);

        return initResponse;
    }
}
