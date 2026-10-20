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

/**
 * Returns a copy of value with every JS Date replaced by its ISO 8601 string, so callers
 * can pass Date objects for DateTime fields. Concerto only accepts DateTime values as
 * strings, and template logic is generated with DateTime typed as string, so inputs are
 * normalized before validation and the normalized copy is what the logic receives.
 * Recurses into arrays and plain objects only; the caller's object is not modified.
 * @param {any} value - the input data (contract data, request or state)
 * @param {string} [path] - the path of value from the root, used in error messages
 * @returns {any} the normalized copy
 * @throws {Error} if a Date is invalid
 */
export function normalizeDates(value: any, path = '$'): any {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new Error(`Invalid Date at \`${path}\`: expected a valid date for a DateTime value.`);
        }
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((item, i) => normalizeDates(item, `${path}[${i}]`));
    }
    if (value !== null && typeof value === 'object') {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
            return value;
        }
        const result: any = {};
        for (const [key, item] of Object.entries(value)) {
            // defineProperty rather than assignment: assigning an own '__proto__' key (from
            // JSON.parse) would set the copy's prototype instead of copying the key
            Object.defineProperty(result, key, {
                value: normalizeDates(item, `${path}.${key}`),
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        return result;
    }
    return value;
}

export function ensureDirSync(path:string) {
    if(!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

export function removeSync(path:string) {
    rmSync(path, { recursive: true, force: true });
}

/**
 * Writes user code (a formula or condition) as a TypeScript function.
 * @param {ClassDeclaration} templateClass - the template model class
 * @param {string} functionName - the name of the generated function
 * @param {string} returnType - the TypeScript return type of the generated function
 * @param {string} code - the user code
 * @param {any} [tsModule] - the typescript module. When supplied, a bare trailing
 * expression is wrapped with `return` (see wrapExpressionWithReturn). It is passed in,
 * rather than imported here, so that loading utils does not load the TypeScript compiler.
 * @returns {string} the TypeScript source of the function
 */
export function writeFunctionToString(templateClass:ClassDeclaration, functionName: string, returnType: string, code: string, tsModule?: any): string {
    let result = '';
    result += '/// ---cut---\n';
    result += `export function ${functionName}(data:TemplateModel.I${templateClass.getName()}, library:any, options:GenerationOptions) : ${returnType} {\n`;
    result += '   const now = dayjs(options?.now);\n';
    result += '   const locale = options?.locale;\n';
    templateClass.getProperties().forEach((p: Property) => {
        result += `   const ${p.getName()} = data.${p.getName()};\n`;
    });
    result += '   ' + (tsModule ? wrapExpressionWithReturn(tsModule, code) : code) + '\n';
    result += '}\n';
    result += '\n';

    return result;
}

/**
 * Wraps user-supplied formula/condition code with `return` when the user did
 * not write an explicit `return`, so that an inline expression like
 * `{{% amount / 2.0 %}}` produces a value rather than an undefined result that
 * fails downstream validation.
 *
 * Uses the TypeScript AST to inspect only top-level statements, so a nested
 * function/arrow that contains its own `return` does not confuse the outer
 * detection (e.g. `[1,2,3].map(x => { return x*2 })[0]`).
 *
 * Code with syntax errors is returned unchanged, so that the compiler reports
 * those errors against the user's original code.
 *
 * The typescript module is passed in so that it is only loaded on the
 * compilation path (see TypeScriptToJavaScriptCompiler).
 */
export function wrapExpressionWithReturn(ts: any, code: string): string {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }
    const sourceFile = ts.createSourceFile('formula.ts', trimmed, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    // parseDiagnostics is internal to the TypeScript API, but is the only way to
    // get syntax errors from createSourceFile without creating a Program
    const parseDiagnostics = (sourceFile as any).parseDiagnostics;
    if (parseDiagnostics && parseDiagnostics.length > 0) {
        return trimmed;
    }
    const statements = sourceFile.statements;
    if (statements.length === 0) {
        return trimmed;
    }
    for (const stmt of statements) {
        if (ts.isReturnStatement(stmt)) {
            return trimmed;
        }
    }
    const last = statements[statements.length - 1];
    if (!ts.isExpressionStatement(last)) {
        return trimmed;
    }
    const prefix = statements
        .slice(0, -1)
        .map((s: any) => s.getText(sourceFile))
        .join('\n');
    const expr = last.expression.getText(sourceFile);
    return prefix.length > 0 ? `${prefix}\nreturn ${expr};` : `return ${expr};`;
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
