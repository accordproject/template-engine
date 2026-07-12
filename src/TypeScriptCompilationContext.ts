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
import { ClassDeclaration, ModelManager } from '@accordproject/concerto-core';
import { CodeGen } from '@accordproject/concerto-codegen';
import { InMemoryWriter } from '@accordproject/concerto-util';
import { getTemplateClassDeclaration } from './utils';

// Fully-qualified names of the runtime base types that stateful/obligation-emitting
// templates must extend. These mirror the checks in cicero-core's Template
// (getStateTypes / getEmitTypes / isStateful).
const RUNTIME_STATE_FQN = 'org.accordproject.runtime@0.2.0.State';
const RUNTIME_REQUEST_FQN = 'org.accordproject.runtime@0.2.0.Request';
const RUNTIME_RESPONSE_FQN = 'org.accordproject.runtime@0.2.0.Response';
// The base Concerto event type. Any emitted event (a plain Event or a specialized
// Obligation) must extend this, so we bind against it rather than Obligation.
const BASE_EVENT_FQN = 'concerto@1.0.0.Event';

/**
 * This class creates the typescript types
 * required to compile Typescript expressions (used in
 * formulae, conditions and clauses) to JavaScript. It uses
 * these to create a compilation context for '@typescript/twoslash'
 * which is used to compile the typescript code.
 */
export class TypeScriptCompilationContext {

    modelManager:ModelManager;
    templateClass:ClassDeclaration;

    constructor(modelManager:ModelManager,templateConceptFqn?: string) {
        this.modelManager = modelManager;
        this.templateClass = getTemplateClassDeclaration(this.modelManager, templateConceptFqn);
    }

    getTypeScriptFiles() : Record<string,string> {
        const result:Record<string,string> = {};

        const visitor = new CodeGen.TypescriptVisitor();
        const writer = new InMemoryWriter();

        const params = {
            fileWriter: writer
        };
        this.modelManager.accept(visitor, params);
        writer.getFilesInMemory().forEach( (value: string, key: string) => {
            result[key] = value;
        });
        return result;
    }

    /**
     * Returns the concrete (non-abstract) types assignable to the supplied base type,
     * *including the base type itself* when it is concrete. The runtime Request /
     * Response / State bases are concrete, so a template may legitimately use the bare
     * base type; only abstract bases (e.g. Obligation) are excluded. Returns an empty
     * array if the base type is not present in the model.
     * @param {string} baseFqn the fully-qualified name of the runtime base type
     * @returns {ClassDeclaration[]} the concrete assignable declarations (base + subclasses)
     */
    private getConcreteRuntimeTypes(baseFqn: string) : ClassDeclaration[] {
        let baseType;
        try {
            baseType = this.modelManager.getType(baseFqn);
        }
        catch {
            // The runtime type is not loaded in this model (e.g. a text-only template
            // with no logic). Nothing to constrain.
            return [];
        }
        return baseType
            .getAssignableClassDeclarations()
            .filter((decl: ClassDeclaration) => !decl.isAbstract());
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
    private buildRuntimeUnion(baseFqn: string, aliasPrefix: string) : {imports: string, union: string} {
        const types = this.getConcreteRuntimeTypes(baseFqn);
        if (types.length === 0) {
            return { imports: '', union: 'never' };
        }
        const imports:string[] = [];
        const members:string[] = [];
        types.forEach((decl, index) => {
            const alias = `${aliasPrefix}${index}`;
            imports.push(`import type { I${decl.getName()} as ${alias} } from './generated/${decl.getNamespace()}';`);
            members.push(alias);
        });
        return { imports: imports.join('\n'), union: members.join(' | ') };
    }

    /**
     * Emits the runtime SmartLegalContract declarations (IConcept, TemplateLogic, etc.)
     * with the state type parameter bound to the concrete State subclasses declared by
     * the template's model. This enforces — at compile time — that any type used as the
     * logic's state actually extends the runtime State type (and likewise for emitted
     * Obligations). A template whose "state" is a plain concept that does not extend
     * State produces an empty union (`never`), so the logic fails to compile.
     * @returns {string} the runtime declarations, as a TypeScript source string
     */
    private getRuntimeDeclarations() : string {
        const state = this.buildRuntimeUnion(RUNTIME_STATE_FQN, '__RtState');
        const request = this.buildRuntimeUnion(RUNTIME_REQUEST_FQN, '__RtRequest');
        const response = this.buildRuntimeUnion(RUNTIME_RESPONSE_FQN, '__RtResponse');
        const event = this.buildRuntimeUnion(BASE_EVENT_FQN, '__RtEvent');

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
    $timestamp: Date;
}
interface IEvent extends IConcept {
    $timestamp: Date;
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

// The concrete subclasses declared by the model for each runtime type (never if the
// template declares no valid subtype). Using these as the state type-parameter bound,
// the request parameter, the result type and the emitted event type is what makes a
// plain concept (that does not extend the corresponding runtime base) fail to compile.
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

    getCompilationContext() : string {
        const files = this.getTypeScriptFiles();

        let result = '';

        // Emit the generated model files under a `generated/` folder so that the
        // template logic's own `./generated/<namespace>` imports resolve inside the
        // twoslash virtual filesystem. Without this the model types resolve to `any`
        // and no type checking (including the State/Obligation hierarchy) can occur.
        Object.keys(files).forEach( key => {
            const content = files[key];
            result += `
// @filename: generated/${key}
${content}
`;
        });

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
