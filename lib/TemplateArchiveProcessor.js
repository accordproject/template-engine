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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateArchiveProcessor = exports.INSTANCE_DOCUMENT_ID = exports.INSTANCE_AGREEMENT_ID = void 0;
const concerto_core_1 = require("@accordproject/concerto-core");
const TemplateMarkInterpreter_1 = require("./TemplateMarkInterpreter");
const markdown_template_1 = require("@accordproject/markdown-template");
const markdown_transform_1 = require("@accordproject/markdown-transform");
const TypeScriptToJavaScriptCompiler_1 = require("./TypeScriptToJavaScriptCompiler");
const JavaScriptEvaluator_1 = require("./JavaScriptEvaluator");
const LLMExecutor_1 = require("./llm/LLMExecutor");
const utils_1 = require("./utils");
const loader_1 = require("./agreement/loader");
const execute_1 = require("./agreement/execute");
/**
 * The agreement and document a template instance runs in when its logic, written with
 * the logic API, is triggered through a TemplateArchiveProcessor: one document, holding
 * the instance, with no clauses composed into it. See AgreementProcessor for more.
 */
exports.INSTANCE_AGREEMENT_ID = 'agreement';
exports.INSTANCE_DOCUMENT_ID = 'document';
/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive
 */
class TemplateArchiveProcessor {
    /**
     * Creates a template archive processor
     * @param {Template} template - the template to be used by the processor
     * @param {LLMExecutorConfig} [llmConfig] - optional LLM fallback configuration
     */
    constructor(template, llmConfig) {
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
    async draft(data, format, options, currentTime) {
        // Setup
        const metadata = this.template.getMetadata();
        const templateKind = metadata.getTemplateType() !== 0 ? 'clause' : 'contract';
        // Get the data
        const modelManager = this.template.getModelManager();
        // The template model is named explicitly: a template whose models include several
        // TemplateData types (such as those of the clauses composed into it) has no
        // single @template type to find.
        const templateModelFqn = this.template.getTemplateModel().getFullyQualifiedName();
        const engine = new TemplateMarkInterpreter_1.TemplateMarkInterpreter(modelManager, {}, templateModelFqn);
        const templateMarkTransformer = new markdown_template_1.TemplateMarkTransformer();
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: this.template.getTemplate() }, modelManager, templateKind, {}, templateModelFqn);
        const now = currentTime ? currentTime : new Date().toISOString();
        const ciceroMark = await engine.generate(templateMarkDom, data, { now });
        const result = (0, markdown_transform_1.transform)(ciceroMark.toJSON(), 'ciceromark', ['ciceromark_unquoted', format], null, options);
        return result;
    }
    /**
     * Compile the logic of a template
     * @param {boolean} [enableCompiledLogicCache] - whether to cache the compiled logic for future use
     * @returns {Promise<Record<string, TwoSlashReturn>>} the compiled code for each typescript file
     */
    async compileLogic(enableCompiledLogicCache = false) {
        if (enableCompiledLogicCache && this.compiledLogicCache) {
            return this.compiledLogicCache;
        }
        const logicManager = this.template.getLogicManager();
        if (logicManager.getLanguage() === 'typescript') {
            const compiledCode = {};
            const tsFiles = logicManager.getScriptManager().getScriptsForTarget('typescript');
            const logicScript = tsFiles.find((tsFile) => tsFile.getIdentifier() === 'logic/logic.ts');
            if (logicScript && (0, loader_1.usesLogicApi)(logicScript.getContents())) {
                // Logic written with the logic API is one module: its types come from the
                // models, and its values from the engine (see agreement/loader.ts).
                const compiler = new TypeScriptToJavaScriptCompiler_1.TypeScriptToJavaScriptCompiler(this.template.getModelManager(), this.template.getTemplateModel().getFullyQualifiedName(), { logicApi: true });
                await compiler.initialize();
                compiledCode[logicScript.getIdentifier()] = compiler.compile(logicScript.getContents());
                if (enableCompiledLogicCache) {
                    this.compiledLogicCache = compiledCode;
                }
                return compiledCode;
            }
            await this.assertTemplateLogicSubclass(logicScript);
            for (let n = 0; n < tsFiles.length; n++) {
                const tsFile = tsFiles[n];
                const compiler = new TypeScriptToJavaScriptCompiler_1.TypeScriptToJavaScriptCompiler(this.template.getModelManager(), this.template.getTemplateModel().getFullyQualifiedName());
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
                        throw new Error('Invalid template: State, Request, Response and Event declarations must ' +
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
        }
        else {
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
    assertRuntimeHierarchy(payload, baseFqn, role) {
        if (!payload || !payload.$class) {
            return;
        }
        const bases = Array.isArray(baseFqn) ? baseFqn : [baseFqn];
        if (!bases.some(base => (0, utils_1.isAssignableTo)(this.template.getModelManager(), payload.$class, base))) {
            throw new Error(`Invalid ${role}: '${payload.$class}' must be, or extend, the runtime ` +
                `${role} type (${bases.join(' or ')}).`);
        }
    }
    /**
     * Whether this template's logic is written with the logic API
     * ('@accordproject/template-engine/logic'), rather than as a TemplateLogic class.
     * @returns {boolean} true for logic written with the logic API
     */
    usesLogicApi() {
        if (!this.template.hasLogic()) {
            return false;
        }
        const logicScript = this.template.getLogicManager().getScriptManager().getScriptsForTarget('typescript')
            .find((tsFile) => tsFile.getIdentifier() === 'logic/logic.ts');
        return !!logicScript && (0, loader_1.usesLogicApi)(logicScript.getContents());
    }
    /**
     * Compiles and loads this template's logic, written with the logic API, once.
     * @returns {Promise<Logic>} the logic
     */
    loadLogic() {
        if (!this.logicApiLogic) {
            this.logicApiLogic = this.compileLogic(true)
                .then(compiled => (0, loader_1.loadLogic)(compiled['logic/logic.ts'].code, (0, loader_1.runtimeModules)(this.template.getModelManager())));
            this.logicApiLogic.catch(() => { this.logicApiLogic = undefined; });
        }
        return this.logicApiLogic;
    }
    /**
     * This template instance as the one document of an agreement.
     * @param {any} data - the instance's data
     * @returns {object} the agreement and document
     */
    instanceAgreement(data) {
        const metadata = this.template.getMetadata();
        const document = {
            $class: execute_1.AGREEMENT_DOCUMENT_FQN,
            documentId: exports.INSTANCE_DOCUMENT_ID,
            template: {
                $class: 'org.accordproject.template@1.0.0.TemplateReference',
                templateId: metadata.getName(),
                version: metadata.getVersion(),
            },
            data,
        };
        const agreement = {
            $class: execute_1.AGREEMENT_FQN,
            agreementId: exports.INSTANCE_AGREEMENT_ID,
            documents: [(0, execute_1.relationship)(execute_1.AGREEMENT_DOCUMENT_FQN, exports.INSTANCE_DOCUMENT_ID)],
            parties: [],
        };
        return { agreement, document };
    }
    /**
     * Initialises logic written with the logic API, for one instance.
     * @param {any} data - the instance's data
     * @param {string} effectiveAt - when the instance takes effect
     * @returns {Promise<InitResponse>} its state ({} if stateless) and the events init emitted
     */
    async initLogicApi(data, effectiveAt) {
        const logic = await this.loadLogic();
        const { agreement, document } = this.instanceAgreement(data);
        const { state, events } = await (0, execute_1.initialise)(agreement, [document], effectiveAt, { [document.template.templateId]: logic }, { models: this.template.getModelManager() });
        return { state: state.states?.[exports.INSTANCE_DOCUMENT_ID] ?? {}, events };
    }
    /**
     * Triggers logic written with the logic API, for one instance. Its state is that
     * instance's state, as init() and trigger() return it.
     * @param {any} data - the instance's data
     * @param {any} request - the request
     * @param {any} [priorState] - the instance's state
     * @returns {Promise<TriggerResponse>} the response, the instance's next state, and events
     */
    async triggerLogicApi(data, request, priorState) {
        const logic = await this.loadLogic();
        const stateful = logic.hasInit;
        if (stateful && (!priorState || Object.keys(priorState).length === 0)) {
            throw new Error('Stateful templates require priorState: call init() first and pass its ' +
                'returned state (or the state returned by a previous trigger()) as priorState.');
        }
        const { agreement, document } = this.instanceAgreement(data);
        const state = {
            $class: execute_1.AGREEMENT_STATE_FQN,
            stateId: `${exports.INSTANCE_AGREEMENT_ID}-state`,
            agreement: (0, execute_1.relationship)(execute_1.AGREEMENT_FQN, exports.INSTANCE_AGREEMENT_ID),
            revision: 0,
            effectiveAt: request.$timestamp,
            states: stateful ? { [exports.INSTANCE_DOCUMENT_ID]: priorState } : undefined,
        };
        const outcome = await (0, execute_1.execute)({ agreement, documents: [document], state }, exports.INSTANCE_DOCUMENT_ID, request, { [document.template.templateId]: logic }, { models: this.template.getModelManager() });
        return {
            result: outcome.result,
            state: outcome.state.states?.[exports.INSTANCE_DOCUMENT_ID] ?? {},
            events: outcome.events,
        };
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
    populateObligationBackReferences(events, data) {
        const modelManager = this.template.getModelManager();
        events.forEach((event) => {
            if (!event || !event.$class || event.contract) {
                return;
            }
            if (!(0, utils_1.isAssignableTo)(modelManager, event.$class, utils_1.RUNTIME_OBLIGATION_FQN)) {
                return;
            }
            if (data && data.$class && (0, utils_1.isAssignableTo)(modelManager, data.$class, utils_1.RUNTIME_CONTRACT_FQN)) {
                // Relationship fields must be a "<fq-class>#<id>" string, not the full resource.
                // Assigning `data` directly (as before) satisfies acceptResourcesForRelationships
                // during population, but validate() then rejects it: that flag only relaxes what
                // the populator will accept as *input*, it doesn't change what a relationship field
                // is allowed to *hold* afterward - it still must be a Relationship, not a Resource.
                const classDecl = modelManager.getType(data.$class);
                const idField = classDecl.getIdentifierFieldName();
                const idValue = idField ? data[idField] : undefined;
                if (!idField || idValue === undefined) {
                    throw new Error(`Cannot populate the required 'contract' back-reference on event '${event.$class}': ` +
                        `the data model '${data.$class}' has no resolvable identifier value for field '${idField}'.`);
                }
                event.contract = `${idValue}`;
                return;
            }
            throw new Error(`Cannot populate the required 'contract' back-reference on event '${event.$class}': ` +
                `it extends ${utils_1.RUNTIME_OBLIGATION_FQN}, but this template's data model ` +
                `('${data?.$class ?? 'undefined'}') does not extend ${utils_1.RUNTIME_CONTRACT_FQN}. Either ` +
                "change the template model to extend Contract, or have the template logic set " +
                "'contract' explicitly on the event before returning it.");
        });
    }
    async assertTemplateLogicSubclass(tsFile) {
        if (!tsFile) {
            throw new Error('Template logic compilation requires a logic/logic.ts file.');
        }
        const tsImport = await Promise.resolve().then(() => __importStar(require('typescript')));
        const tsModule = ('default' in tsImport && tsImport.default ? tsImport.default : tsImport);
        const sourceFile = tsModule.createSourceFile(tsFile.getIdentifier(), tsFile.getContents(), tsModule.ScriptTarget.Latest, true, tsModule.ScriptKind.TS);
        const hasTemplateLogicSubclass = sourceFile.statements.some((statement) => {
            if (!tsModule.isClassDeclaration(statement) || !statement.heritageClauses) {
                return false;
            }
            return statement.heritageClauses.some((clause) => clause.token === tsModule.SyntaxKind.ExtendsKeyword &&
                clause.types.some((heritageType) => {
                    const expression = heritageType.expression;
                    return (tsModule.isIdentifier(expression) && expression.text === 'TemplateLogic') ||
                        (tsModule.isPropertyAccessExpression(expression) && expression.name.text === 'TemplateLogic');
                }));
        });
        if (!hasTemplateLogicSubclass) {
            throw new Error(`Template logic compilation requires ${tsFile.getIdentifier()} to define a class extending TemplateLogic.`);
        }
    }
    /**
     * Determines whether LLM fallback is enabled.
     * @returns {boolean} true if an LLM config is present and not disabled
     */
    shouldUseLLM() {
        return !!this.llmConfig && this.llmConfig.mode !== 'disabled';
    }
    /**
     * Constructs an LLM executor for this template.
     * @returns {LLMExecutor} the LLM executor
     * @throws {Error} if no LLM config is present
     */
    makeLLMExecutor() {
        if (!this.llmConfig) {
            throw new Error('LLM fallback requested but llmConfig is missing');
        }
        if (!this.llmExecutor) {
            this.llmExecutor = new LLMExecutor_1.LLMExecutor(this.template, this.llmConfig);
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
    async executeTypeScriptTrigger(data, request, priorState, currentTime, utcOffset) {
        const compiledCode = await this.compileLogic();
        const resolvedTime = currentTime ?? new Date().toISOString();
        const resolvedOffset = utcOffset ?? 0;
        const evaluator = new JavaScriptEvaluator_1.JavaScriptEvaluator();
        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName: 'trigger',
            code: compiledCode['logic/logic.ts'].code, // TODO DCS - how to find the code to run?
            argumentNames: ['data', 'request', 'state'],
            arguments: [data, request, priorState, resolvedTime, resolvedOffset]
        });
        if (evalResponse.result) {
            return evalResponse.result;
        }
        else {
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
    async executeTypeScriptInit(data, currentTime, utcOffset) {
        const compiledCode = await this.compileLogic();
        const logicCode = compiledCode['logic/logic.ts']?.code;
        // Check if the compiled code even contains an `init` method before calling it
        if (!logicCode || (!logicCode.includes('init(') && !logicCode.includes('init ('))) {
            // Stateless template — no init method defined, return empty state
            return { state: {} };
        }
        const resolvedTime = currentTime ?? new Date().toISOString();
        const resolvedOffset = utcOffset ?? 0;
        const evaluator = new JavaScriptEvaluator_1.JavaScriptEvaluator();
        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName: 'init',
            code: logicCode, // TODO DCS - how to find the code to run?
            argumentNames: ['data'],
            arguments: [data, resolvedTime, resolvedOffset]
        });
        if (evalResponse.result) {
            return evalResponse.result;
        }
        else {
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
    async trigger(data, request, priorState, currentTime, utcOffset, enableCompiledLogicCache) {
        const factory = new concerto_core_1.Factory(this.template.getModelManager());
        const serializer = new concerto_core_1.Serializer(factory, this.template.getModelManager(), { validate: true });
        // Logic written with the logic API validates everything as it runs, and takes the
        // time from the request rather than the clock.
        if (this.llmConfig?.mode !== 'force' && this.usesLogicApi()) {
            if (data)
                serializer.fromJSON(data);
            return this.triggerLogicApi(data, request, priorState);
        }
        // Stateful templates must always be triggered against the state produced by
        // init() (or a previous trigger()) — there is no implicit "empty" state for
        // a template that declares custom State fields. Stateless templates have no
        // persistent state, so priorState is not required for them.
        if (this.template.isStateful() && (!priorState || Object.keys(priorState).length === 0)) {
            throw new Error('Stateful templates require priorState: call init() first and pass its ' +
                'returned state (or the state returned by a previous trigger()) as priorState.');
        }
        // validate inputs before execution. A stateless template's init returns an empty
        // placeholder state ({}); skip only that. Any other state - including a non-empty
        // object with no $class - is validated normally (and fails if malformed).
        if (data)
            serializer.fromJSON(data);
        if (request)
            serializer.fromJSON(request);
        if (priorState && Object.keys(priorState).length > 0)
            serializer.fromJSON(priorState);
        // enforce the runtime class hierarchy on the inputs
        this.assertRuntimeHierarchy(request, [utils_1.RUNTIME_REQUEST_FQN, utils_1.RUNTIME_1_REQUEST_FQN], 'request');
        this.assertRuntimeHierarchy(priorState, [utils_1.RUNTIME_STATE_FQN, utils_1.STATE_DATA_FQN], 'state');
        let triggerResponse;
        const forceLLM = this.llmConfig?.mode === 'force';
        // Run the template's TypeScript logic unless the caller forces the LLM path.
        if (!forceLLM && this.template.hasLogic()) {
            if (enableCompiledLogicCache) {
                await this.compileLogic(true);
            }
            triggerResponse = await this.executeTypeScriptTrigger(data, request, priorState, currentTime, utcOffset);
        }
        else if (forceLLM || this.shouldUseLLM()) {
            // Otherwise use the LLM executor
            triggerResponse = await this.makeLLMExecutor().trigger(data, request, priorState, currentTime, utcOffset);
        }
        else {
            throw new Error('No executable logic found and LLM fallback is disabled');
        }
        // validate outputs after execution (skip only the empty {} placeholder state)
        if (triggerResponse.state && Object.keys(triggerResponse.state).length > 0)
            serializer.fromJSON(triggerResponse.state);
        if (triggerResponse.result)
            serializer.fromJSON(triggerResponse.result);
        if (triggerResponse.events && Array.isArray(triggerResponse.events)) {
            this.populateObligationBackReferences(triggerResponse.events, data);
            triggerResponse.events.forEach(e => serializer.fromJSON(e));
        }
        // enforce the runtime class hierarchy on the outputs
        this.assertRuntimeHierarchy(triggerResponse.state, [utils_1.RUNTIME_STATE_FQN, utils_1.STATE_DATA_FQN], 'state');
        this.assertRuntimeHierarchy(triggerResponse.result, [utils_1.RUNTIME_RESPONSE_FQN, utils_1.RUNTIME_1_RESPONSE_FQN], 'response');
        if (triggerResponse.events && Array.isArray(triggerResponse.events)) {
            triggerResponse.events.forEach(e => this.assertRuntimeHierarchy(e, utils_1.BASE_EVENT_FQN, 'event'));
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
    async init(data, currentTime, utcOffset, enableCompiledLogicCache) {
        const factory = new concerto_core_1.Factory(this.template.getModelManager());
        const serializer = new concerto_core_1.Serializer(factory, this.template.getModelManager(), { validate: true });
        // validate inputs before execution
        if (data)
            serializer.fromJSON(data);
        if (this.llmConfig?.mode !== 'force' && this.usesLogicApi()) {
            return this.initLogicApi(data, currentTime ?? new Date().toISOString());
        }
        let initResponse;
        const forceLLM = this.llmConfig?.mode === 'force';
        // Run the template's TypeScript logic unless the caller forces the LLM path.
        if (!forceLLM && this.template.hasLogic()) {
            if (enableCompiledLogicCache) {
                await this.compileLogic(true);
            }
            initResponse = await this.executeTypeScriptInit(data, currentTime, utcOffset);
        }
        else if (forceLLM || this.shouldUseLLM()) {
            // Otherwise use the LLM executor
            initResponse = await this.makeLLMExecutor().init(data, currentTime, utcOffset);
        }
        else {
            throw new Error('No executable logic found and LLM fallback is disabled');
        }
        // validate outputs after execution. A stateless template returns an empty
        // placeholder state ({}); skip only that - any other state is validated normally.
        if (initResponse.state && Object.keys(initResponse.state).length > 0)
            serializer.fromJSON(initResponse.state);
        // enforce the runtime class hierarchy on the output state (skipped for the empty
        // state of a stateless template, which has no $class)
        this.assertRuntimeHierarchy(initResponse.state, [utils_1.RUNTIME_STATE_FQN, utils_1.STATE_DATA_FQN], 'state');
        return initResponse;
    }
}
exports.TemplateArchiveProcessor = TemplateArchiveProcessor;
//# sourceMappingURL=TemplateArchiveProcessor.js.map