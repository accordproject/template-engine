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
import {
    getTemplateClassDeclaration,
    getAssignableConcreteTypes,
    RUNTIME_STATE_FQN,
    RUNTIME_REQUEST_FQN,
    RUNTIME_RESPONSE_FQN,
    BASE_EVENT_FQN,
} from './utils';

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
        const types = getAssignableConcreteTypes(this.modelManager, baseFqn);
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
     * with the State / Request / Response / Event type positions bound to the model-derived
     * Runtime* unions (the concrete base type plus its subclasses; see buildRuntimeUnion).
     * Because the concrete base is included, using the bare base type or a subclass
     * type-checks. Types that are structurally incompatible with the base still fail here
     * (Response/Event require `$timestamp`); State carries only `$identifier`, so a
     * concept-shaped state type-checks and is instead enforced nominally at runtime (see
     * TemplateArchiveProcessor.assertRuntimeHierarchy).
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
