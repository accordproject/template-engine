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
import {
    isAssignableTo,
    RUNTIME_REQUEST_FQN,
    RUNTIME_RESPONSE_FQN,
    RUNTIME_STATE_FQN,
    BASE_EVENT_FQN,
    RUNTIME_OBLIGATION_FQN,
    RUNTIME_CONTRACT_FQN,
} from './utils';

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

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function validateTriggerResponse(result: unknown): asserts result is TriggerResponse {
    if (!isObject(result)) {
        throw new Error('Invalid trigger result: expected an object');
    }
    if (!isObject(result.result)) {
        throw new Error('Invalid trigger result: missing result object');
    }
    if (!isObject(result.state)) {
        throw new Error('Invalid trigger result: missing state object');
    }
    if (!Array.isArray(result.events)) {
        throw new Error('Invalid trigger result: events must be an array');
    }
}

function validateInitResponse(result: unknown): asserts result is InitResponse {
    if (!isObject(result) || !isObject(result.state)) {
        throw new Error('Invalid init result: missing state object');
    }
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
            const logicScript = tsFiles.find((tsFile) => tsFile.getIdentifier() === 'logic/logic.ts');
            await this.assertTemplateLogicSubclass(logicScript);
            for (let n = 0; n < tsFiles.length; n++) {
                const tsFile = tsFiles[n];

                const compiler = new TypeScriptToJavaScriptCompiler(this.template.getModelManager(),
                    this.template.getTemplateModel().getFullyQualifiedName());

                await compiler.initialize();

                // The runtime type declarations (IConcept, TemplateLogic, etc.) are
                // provided by the compilation context, with the State / Request / Response /
                // Event type positions bound to the model-derived Runtime* unions (the
                // concrete base plus its subclasses).
                const result = compiler.compile(tsFile.getContents());

                // Surface the runtime-hierarchy constraint violation (TS2344) as a hard
                // error. The state type argument must satisfy the RuntimeState union; a type
                // that is structurally incompatible with the base (e.g. a concept with no
                // $identifier used as state, or an emit that is not assignable to the base
                // Event) fails the constraint. Structural matches to the bare base are
                // allowed here and are instead checked nominally at runtime
                // (assertRuntimeHierarchy). Scoped to the logic entry point and to TS2344 so
                // that unrelated diagnostics (and non-logic scripts such as README.md) do
                // not turn into hard failures.
                const isLogicEntry = tsFile.getIdentifier().endsWith('logic.ts');
                if (isLogicEntry) {
                    const hierarchyErrors = (result.errors || [])
                        .filter(e => e.category === 1 && e.code === 2344);
                    if (hierarchyErrors.length > 0) {
                        const message = hierarchyErrors.map(e => e.renderedMessage).join('\n');
                        throw new Error(
                            'Invalid template: State, Request, Response and Event declarations must ' +
                            'be, or extend, their runtime base types (org.accordproject.runtime ' +
                            `State / Request / Response and the Concerto Event).\n${message}`);
                    }
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
    private assertRuntimeHierarchy(payload: any, baseFqn: string, role: string): void {
        if (!payload || !payload.$class) {
            return;
        }
        if (!isAssignableTo(this.template.getModelManager(), payload.$class, baseFqn)) {
            throw new Error(
                `Invalid ${role}: '${payload.$class}' must be, or extend, the runtime ` +
                `${role} type (${baseFqn}).`);
        }
    }

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
    private populateObligationBackReferences(events: Event[], data: any): void {
        const modelManager = this.template.getModelManager();
        events.forEach((event: any) => {
            if (!event || !event.$class || event.contract) {
                return;
            }
            if (!isAssignableTo(modelManager, event.$class, RUNTIME_OBLIGATION_FQN)) {
                return;
            }
            if (data && data.$class && isAssignableTo(modelManager, data.$class, RUNTIME_CONTRACT_FQN)) {
                // Relationship fields must be a "<fq-class>#<id>" string, not the full resource.
                // Assigning `data` directly (as before) satisfies acceptResourcesForRelationships
                // during population, but validate() then rejects it: that flag only relaxes what
                // the populator will accept as *input*, it doesn't change what a relationship field
                // is allowed to *hold* afterward - it still must be a Relationship, not a Resource.
                const classDecl = modelManager.getType(data.$class);
                const idField = classDecl.getIdentifierFieldName();
                const idValue = idField ? data[idField] : undefined;
                if (!idField || idValue === undefined) {
                    throw new Error(
                        `Cannot populate the required 'contract' back-reference on event '${event.$class}': ` +
                        `the data model '${data.$class}' has no resolvable identifier value for field '${idField}'.`
                    );
                }
                event.contract = `${idValue}`;
                return;
            }
            throw new Error(
                `Cannot populate the required 'contract' back-reference on event '${event.$class}': ` +
                `it extends ${RUNTIME_OBLIGATION_FQN}, but this template's data model ` +
                `('${data?.$class ?? 'undefined'}') does not extend ${RUNTIME_CONTRACT_FQN}. Either ` +
                "change the template model to extend Contract, or have the template logic set " +
                "'contract' explicitly on the event before returning it."
            );
        });
    }

    private async assertTemplateLogicSubclass(tsFile?: Script): Promise<void> {
        if (!tsFile) {
            throw new Error('Template logic compilation requires a logic/logic.ts file.');
        }

        const tsImport = await import('typescript');
        const tsModule = ('default' in tsImport && tsImport.default ? tsImport.default : tsImport);

        const sourceFile = tsModule.createSourceFile(
            tsFile.getIdentifier(),
            tsFile.getContents(),
            tsModule.ScriptTarget.Latest,
            true,
            tsModule.ScriptKind.TS
        );

        const hasTemplateLogicSubclass = sourceFile.statements.some((statement) => {
            if (!tsModule.isClassDeclaration(statement) || !statement.heritageClauses) {
                return false;
            }

            return statement.heritageClauses.some((clause) =>
                clause.token === tsModule.SyntaxKind.ExtendsKeyword &&
                clause.types.some((heritageType) => {
                    const expression = heritageType.expression;
                    return (tsModule.isIdentifier(expression) && expression.text === 'TemplateLogic') ||
                        (tsModule.isPropertyAccessExpression(expression) && expression.name.text === 'TemplateLogic');
                })
            );
        });

        if (!hasTemplateLogicSubclass) {
            throw new Error(`Template logic compilation requires ${tsFile.getIdentifier()} to define a class extending TemplateLogic.`);
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
     * @param {any} [priorState] - the state produced by init() (or a previous
     * trigger()); required for stateful templates, ignored for stateless ones
     * @param {string} [currentTime] - the current time, defaults to now
     * @param {number} [utcOffset] - the UTC offset, defaults to zero
     * @returns {Promise<TriggerResponse>} the response and any events
     */
    private async executeTypeScriptTrigger(data: any, request: any, priorState?: any, currentTime?: string, utcOffset?: number): Promise<TriggerResponse> {
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
            arguments: [data, request, priorState, resolvedTime, resolvedOffset]
        });
        if (evalResponse.result) {
            const executionResult = await evalResponse.result;
            validateTriggerResponse(executionResult);
            return executionResult;
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
            const executionResult = await evalResponse.result;
            validateInitResponse(executionResult);
            return executionResult;
        } else {
            throw new Error('Init failed with message: ' + evalResponse.message);
        }
    }

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
    async trigger(data: any, request: any, priorState?: any, currentTime?: string, utcOffset?: number, enableCompiledLogicCache?: boolean): Promise<TriggerResponse> {
        const factory = new Factory(this.template.getModelManager());
        const serializer = new Serializer(factory, this.template.getModelManager(), { validate: true});

        // Stateful templates must always be triggered against the state produced by
        // init() (or a previous trigger()) — there is no implicit "empty" state for
        // a template that declares custom State fields. Stateless templates have no
        // persistent state, so priorState is not required for them.
        if (this.template.isStateful() && (!priorState || Object.keys(priorState).length === 0)) {
            throw new Error(
                'Stateful templates require priorState: call init() first and pass its ' +
                'returned state (or the state returned by a previous trigger()) as priorState.'
            );
        }

        // validate inputs before execution. A stateless template's init returns an empty
        // placeholder state ({}); skip only that. Any other state - including a non-empty
        // object with no $class - is validated normally (and fails if malformed).
        if (data) serializer.fromJSON(data);
        if (request) serializer.fromJSON(request);
        if (priorState && Object.keys(priorState).length > 0) serializer.fromJSON(priorState);

        // enforce the runtime class hierarchy on the inputs
        this.assertRuntimeHierarchy(request, RUNTIME_REQUEST_FQN, 'request');
        this.assertRuntimeHierarchy(priorState, RUNTIME_STATE_FQN, 'state');

        let triggerResponse: TriggerResponse;
        const forceLLM = this.llmConfig?.mode === 'force';

        // Run the template's TypeScript logic unless the caller forces the LLM path.
        if (!forceLLM && this.template.hasLogic()) {
            if (enableCompiledLogicCache) {
                await this.compileLogic(true);
            }
            triggerResponse = await this.executeTypeScriptTrigger(data, request, priorState, currentTime, utcOffset);
        } else if (forceLLM || this.shouldUseLLM()) {
            // Otherwise use the LLM executor
            triggerResponse = await this.makeLLMExecutor().trigger(data, request, priorState, currentTime, utcOffset);
        } else {
            throw new Error('No executable logic found and LLM fallback is disabled');
        }

        // validate outputs after execution (skip only the empty {} placeholder state)
        if (triggerResponse.state && Object.keys(triggerResponse.state).length > 0) serializer.fromJSON(triggerResponse.state);
        if (triggerResponse.result) serializer.fromJSON(triggerResponse.result);
        if (triggerResponse.events && Array.isArray(triggerResponse.events)) {
            this.populateObligationBackReferences(triggerResponse.events, data);
            triggerResponse.events.forEach(e => serializer.fromJSON(e));
        }

        // enforce the runtime class hierarchy on the outputs
        this.assertRuntimeHierarchy(triggerResponse.state, RUNTIME_STATE_FQN, 'state');
        this.assertRuntimeHierarchy(triggerResponse.result, RUNTIME_RESPONSE_FQN, 'response');
        if (triggerResponse.events && Array.isArray(triggerResponse.events)) {
            triggerResponse.events.forEach(e => this.assertRuntimeHierarchy(e, BASE_EVENT_FQN, 'event'));
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
        const serializer = new Serializer(factory, this.template.getModelManager(), { validate: true});

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

        // validate outputs after execution. A stateless template returns an empty
        // placeholder state ({}); skip only that - any other state is validated normally.
        if (initResponse.state && Object.keys(initResponse.state).length > 0) serializer.fromJSON(initResponse.state);

        // enforce the runtime class hierarchy on the output state (skipped for the empty
        // state of a stateless template, which has no $class)
        this.assertRuntimeHierarchy(initResponse.state, RUNTIME_STATE_FQN, 'state');

        return initResponse;
    }
}
