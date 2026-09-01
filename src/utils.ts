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

import { ClassDeclaration, Introspector, ModelManager, Property } from '@accordproject/concerto-core';
import { TemplateMarkModel } from '@accordproject/markdown-common';
import { templatemarkutil } from '@accordproject/markdown-template';

import { existsSync, mkdirSync, rmSync } from 'fs';
import traverse from 'traverse';

// Fully-qualified names of the runtime base types that logic types must be, or extend.
// Request / Response / State are concrete in org.accordproject.runtime@0.2.0, so a template
// may use the bare base type. Events bind to the base Concerto Event (a plain Event or a
// specialized Obligation both extend it); Obligation itself is abstract. Shared by the
// compilation context (compile-time unions) and the archive processor (runtime $class
// hierarchy checks).
export const RUNTIME_STATE_FQN = 'org.accordproject.runtime@0.2.0.State';
export const RUNTIME_REQUEST_FQN = 'org.accordproject.runtime@0.2.0.Request';
export const RUNTIME_RESPONSE_FQN = 'org.accordproject.runtime@0.2.0.Response';
export const BASE_EVENT_FQN = 'concerto@1.0.0.Event';
export const RUNTIME_OBLIGATION_FQN = 'org.accordproject.runtime@0.2.0.Obligation';
export const RUNTIME_CONTRACT_FQN = 'org.accordproject.contract@0.2.0.Contract';

/**
 * Returns the concrete (non-abstract) class declarations assignable to baseFqn: the base
 * type itself (when concrete) plus every subclass of it. Returns an empty array when
 * baseFqn is not present in the model. This is the single source of truth for the runtime
 * type hierarchy — used both to build the compile-time unions (TypeScriptCompilationContext)
 * and to check payloads at runtime (TemplateArchiveProcessor).
 *
 * TODO: migrate to a Concerto-provided helper once available — see
 * https://github.com/accordproject/concerto/issues/1281
 * @param {ModelManager} modelManager - the model manager to resolve types against
 * @param {string} baseFqn - the fully-qualified name of the runtime base type
 * @returns {ClassDeclaration[]} the concrete assignable declarations (base + subclasses)
 */
export function getAssignableConcreteTypes(modelManager: ModelManager, baseFqn: string): ClassDeclaration[] {
    let baseType;
    try {
        baseType = modelManager.getType(baseFqn);
    } catch {
        // The base type is not loaded in this model (e.g. a text-only template with no logic).
        return [];
    }
    return baseType.getAssignableClassDeclarations().filter((decl: ClassDeclaration) => !decl.isAbstract());
}

/**
 * Returns true when the type identified by fqn is, or extends, baseFqn (restricted to
 * concrete types). Used to enforce the runtime class hierarchy against a payload's $class.
 * @param {ModelManager} modelManager - the model manager to resolve types against
 * @param {string} fqn - the fully-qualified name of the candidate type
 * @param {string} baseFqn - the fully-qualified name of the runtime base type
 * @returns {boolean} true if fqn is, or extends, baseFqn
 */
export function isAssignableTo(modelManager: ModelManager, fqn: string, baseFqn: string): boolean {
    return getAssignableConcreteTypes(modelManager, baseFqn)
        .some((decl: ClassDeclaration) => decl.getFullyQualifiedName() === fqn);
}

export function ensureDirSync(path:string) {
    if(!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

export function removeSync(path:string) {
    rmSync(path, { recursive: true, force: true });
}

export function writeFunctionToString(templateClass:ClassDeclaration, functionName: string, returnType: string, code: string): string {
    let result = '';
    result += '/// ---cut---\n';
    result += `export function ${functionName}(data:TemplateModel.I${templateClass.getName()}, library:any, options:GenerationOptions) : ${returnType} {\n`;
    result += '   const now = dayjs(options?.now);\n';
    result += '   const locale = options?.locale;\n';
    templateClass.getProperties().forEach((p: Property) => {
        result += `   const ${p.getName()} = data.${p.getName()};\n`;
    });
    result += '   ' + code.trim() + '\n';
    result += '}\n';
    result += '\n';

    return result;
}

export function nameUserCode(templateMarkDom: any) {
    return traverse(templateMarkDom).map(function (x) {
        if (x && ((x.$class === `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition` && x.condition) ||
            (x.$class === `${TemplateMarkModel.NAMESPACE}.ClauseDefinition` && x.condition))) {
            x.functionName = `condition_${this.path.join('_')}`;
        }
        this.update(x);
    });
}

export function getTemplateClassDeclaration(modelManager: ModelManager, templateConceptFqn?: string) : ClassDeclaration {
    const introspector = new Introspector(modelManager);
    try {
        return templatemarkutil.findTemplateConcept(introspector, 'clause', templateConceptFqn);
    }
    catch(err) {
        console.log(err);
        throw err;
    }
}
