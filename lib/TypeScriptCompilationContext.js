"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptCompilationContext = void 0;
const concerto_codegen_1 = require("@accordproject/concerto-codegen");
const concerto_util_1 = require("@accordproject/concerto-util");
const utils_1 = require("./utils");
const types_1 = require("./agreement/types");
/**
 * This class creates the typescript types
 * required to compile Typescript expressions (used in
 * formulae, conditions and clauses) to JavaScript. It uses
 * these to create a compilation context for '@typescript/twoslash'
 * which is used to compile the typescript code.
 */
class TypeScriptCompilationContext {
    constructor(modelManager, templateConceptFqn, options = {}) {
        this.modelManager = modelManager;
        this.templateClass = (0, utils_1.getTemplateClassDeclaration)(this.modelManager, templateConceptFqn);
        this.options = options;
    }
    getTypeScriptFiles() {
        const result = {};
        const visitor = new concerto_codegen_1.CodeGen.TypescriptVisitor();
        const writer = new concerto_util_1.InMemoryWriter();
        const params = {
            fileWriter: writer
        };
        this.modelManager.accept(visitor, params);
        writer.getFilesInMemory().forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    /**
     * Builds a TypeScript union type over the concrete types assignable to a runtime
     * base type (the base itself, when concrete, plus its subclasses), along with the
     * imports required to reference them. Because the base is included, using the bare
     * base type or any subclass type-checks. A plain concept that does not extend the
     * base is still rejected structurally where the base carries a distinguishing member
     * (Response/Event require `$timestamp`); State carries only `$identifier`, so a
     * concept-shaped state is admitted here and instead enforced nominally at runtime
     * (see TemplateArchiveProcessor.assertRuntimeHierarchy). When the base type is absent
     * the union is `never`.
     * @param {string} baseFqn the fully-qualified name of the runtime base type
     * @param {string} aliasPrefix a unique prefix for the imported type aliases
     * @returns {{imports: string, union: string}} the import statements and union type
     */
    buildRuntimeUnion(baseFqn, aliasPrefix) {
        const types = (0, utils_1.getAssignableConcreteTypes)(this.modelManager, baseFqn);
        if (types.length === 0) {
            return { imports: '', union: 'never' };
        }
        const imports = [];
        const members = [];
        types.forEach((decl, index) => {
            const alias = `${aliasPrefix}${index}`;
            imports.push(`import type { I${decl.getName()} as ${alias} } from './generated/${decl.getNamespace()}';`);
            members.push(alias);
        });
        return { imports: imports.join('\n'), union: members.join(' | ') };
    }
    /**
     * Emits the runtime SmartLegalContract declarations (IConcept, TemplateLogic, etc.)
     * with the State / Request / Response / Event type positions bound to the model-derived
     * Runtime* unions (the concrete base type plus its subclasses; see buildRuntimeUnion).
     * Because the concrete base is included, using the bare base type or a subclass
     * type-checks. Types that are structurally incompatible with the base still fail here
     * (Response/Event require `$timestamp`); State carries only `$identifier`, so a
     * concept-shaped state type-checks and is instead enforced nominally at runtime (see
     * TemplateArchiveProcessor.assertRuntimeHierarchy).
     * @returns {string} the runtime declarations, as a TypeScript source string
     */
    getRuntimeDeclarations() {
        const state = this.buildRuntimeUnion(utils_1.RUNTIME_STATE_FQN, '__RtState');
        const request = this.buildRuntimeUnion(utils_1.RUNTIME_REQUEST_FQN, '__RtRequest');
        const response = this.buildRuntimeUnion(utils_1.RUNTIME_RESPONSE_FQN, '__RtResponse');
        const event = this.buildRuntimeUnion(utils_1.BASE_EVENT_FQN, '__RtEvent');
        return `
${state.imports}
${request.imports}
${response.imports}
${event.imports}

/* eslint-disable @typescript-eslint/no-empty-object-type */
// Runtime declarations injected by the template engine. The Runtime* unions are
// derived from the template's Concerto model so that the type checker enforces the
// runtime State / Request / Response / Event class hierarchies.
interface IConcept {
    $class: string;
}
interface ITransaction extends IConcept {
    $timestamp: string;
}
interface IEvent extends IConcept {
    $timestamp: string;
}
interface IState {
    $identifier: string;
}
interface IRequest extends ITransaction {
}
interface IResponse extends ITransaction {
}
interface IAsset extends IConcept {
    $identifier: string;
}
interface IContract extends IAsset {
    contractId: string;
}
interface IClause extends IAsset {
    clauseId: string;
}

// The concrete types assignable to each runtime base (the base itself, when concrete,
// plus its subclasses; never when the base is absent). Used as the state type-parameter
// bound, the request parameter, the result type and the emitted event type: a type that is
// structurally incompatible with the base (e.g. a plain concept lacking $timestamp used as
// a response/event) fails to compile. State is enforced nominally at runtime instead.
type RuntimeState = ${state.union};
type RuntimeRequest = ${request.union};
type RuntimeResponse = ${response.union};
type RuntimeEvent = ${event.union};

interface EngineResponse<S extends RuntimeState> {
    state?: S;
    events?: Array<RuntimeEvent>
}
interface TriggerResponse<S extends RuntimeState = RuntimeState> extends EngineResponse<S> {
    result: RuntimeResponse;
}
interface InitResponse<S extends RuntimeState> extends EngineResponse<S> {}

type TemplateData = IContract|IClause;

abstract class TemplateLogic<T extends TemplateData, S extends RuntimeState = RuntimeState> {
    abstract trigger(data: T, request: RuntimeRequest, state:S) : Promise<TriggerResponse<S>>;
    // A concrete (stub) implementation so the class emits runtime JS (user logic does
    // \`extends TemplateLogic\`) and does not raise TS2391 for a missing body.
    init(data: T) : Promise<InitResponse<S>|undefined> { return Promise.resolve(undefined); }
}
`;
    }
    getCompilationContext() {
        const files = this.getTypeScriptFiles();
        let result = '';
        // Emit the generated model files under a `generated/` folder so that the
        // template logic's own `./generated/<namespace>` imports resolve inside the
        // twoslash virtual filesystem. Without this the model types resolve to `any`
        // and no type checking (including the State/Obligation hierarchy) can occur.
        Object.keys(files).forEach(key => {
            const content = files[key];
            result += `
// @filename: generated/${key}
${content}
`;
        });
        if (this.options.logicApi) {
            result += `
// @filename: generated/types.ts
${(0, types_1.typesSource)(this.modelManager)}
`;
        }
        result += `
// @filename: code.ts
import * as TemplateModel from './generated/${this.templateClass.getNamespace()}';
import dayjs from 'dayjs';
import jp from 'jsonpath';
${this.getRuntimeDeclarations()}
type GenerationOptions = {
    now?:string,
    locale?:string
}
`;
        return result;
    }
}
exports.TypeScriptCompilationContext = TypeScriptCompilationContext;
//# sourceMappingURL=TypeScriptCompilationContext.js.map