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


// Loads a template's compiled logic (see TemplateArchiveProcessor.compileLogic) as an ES
// module. Logic is compiled on its own, so its imports can't be resolved from a data: URL;
// instead each import of a module the engine supplies is rewritten to read that module's
// exports from a registry, keyed per load:
//
//   '@accordproject/template-engine/logic'  the logic API (./logic.ts)
//   './generated/types'                      a factory per concrete model type (./types.ts)
//   './generated/<namespace>'                each namespace's enums
//   'dayjs', 'jsonpath'                      as for TemplateLogic
//
// Type-only imports are erased by the compiler, so a template may import types from
// anywhere, such as a composed clause's API from that clause's logic.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ModelManager } from '@accordproject/concerto-core';
import dayjs from 'dayjs';
import jp from 'jsonpath';
import * as logicApi from './logic';
import { isLogic, Logic } from './logic';
import { enumValues, LOGIC_MODULE, typeValues, TYPES_MODULE } from './types';
import { dynamicImport } from '../JavaScriptEvaluator';

const REGISTRY = Symbol.for('@accordproject/template-engine/modules');
let loads = 0;

/** The exports of each module the engine supplies to logic, by import specifier. */
export type Modules = Record<string, Record<string, unknown>>;

/**
 * The modules the engine supplies to logic compiled against `modelManager`.
 * @param {ModelManager} modelManager - the template's models
 * @returns {Modules} the modules, by import specifier
 */
export function runtimeModules(modelManager: ModelManager): Modules {
    const modules: Modules = {
        [LOGIC_MODULE]: { ...logicApi },
        [TYPES_MODULE]: typeValues(modelManager),
        dayjs: { default: dayjs },
        jsonpath: { default: jp },
    };
    for (const [namespace, enums] of Object.entries(enumValues(modelManager))) {
        modules[`./generated/${namespace}`] = enums;
    }
    return modules;
}

/**
 * Whether a template's logic is written against the logic API (./logic.ts), rather than
 * as a TemplateLogic class.
 * @param {string} source - the TypeScript source of logic/logic.ts
 * @returns {boolean} true if it imports '@accordproject/template-engine/logic'
 */
export function usesLogicApi(source: string): boolean {
    return /\bfrom\s*['"]@accordproject\/template-engine\/logic['"]/.test(source);
}

/**
 * Rewrites the imports of compiled logic to read from the module registry entry `key`.
 * @param {any} ts - the typescript module
 * @param {string} code - the compiled JavaScript
 * @param {string} key - the registry entry holding this load's modules
 * @param {Set<string>} specifiers - the modules the registry entry holds
 * @returns {string} the rewritten JavaScript
 */
export function rewriteImports(ts: any, code: string, key: string, specifiers: Set<string>): string {
    const source = ts.createSourceFile('logic.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const edits: { start: number; end: number; text: string }[] = [];
    for (const statement of source.statements) {
        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
            throw new Error(`Template logic may not re-export from '${statement.moduleSpecifier.text}'.`);
        }
        if (!ts.isImportDeclaration(statement)) {
            continue;
        }
        const specifier: string = statement.moduleSpecifier.text;
        if (!specifiers.has(specifier)) {
            throw new Error(`Template logic may import only types from '${specifier}'. ` +
                `Its values must come from ${[...specifiers].map(s => `'${s}'`).join(', ')}.`);
        }
        const from = JSON.stringify(specifier);
        const bindings: string[] = [];
        const clause = statement.importClause;
        if (clause && !clause.isTypeOnly) {
            if (clause.name) {
                bindings.push(`const ${clause.name.text} = __import(${from}, 'default');`);
            }
            const named = clause.namedBindings;
            if (named && ts.isNamespaceImport(named)) {
                bindings.push(`const ${named.name.text} = __modules[${from}];`);
            } else if (named) {
                for (const element of named.elements) {
                    if (!element.isTypeOnly) {
                        const imported = (element.propertyName ?? element.name).text;
                        bindings.push(`const ${element.name.text} = __import(${from}, ${JSON.stringify(imported)});`);
                    }
                }
            }
        }
        edits.push({ start: statement.getStart(source), end: statement.getEnd(), text: bindings.join(' ') });
    }
    let result = code;
    for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
        result = result.slice(0, start) + text + result.slice(end);
    }
    return [
        `const __modules = globalThis[Symbol.for(${JSON.stringify(REGISTRY.description)})].get(${JSON.stringify(key)});`,
        'const __import = (specifier, name) => {',
        '    if (!(name in __modules[specifier])) {',
        '        throw new Error(`\'${specifier}\' has no export \'${name}\'.`);',
        '    }',
        '    return __modules[specifier][name];',
        '};',
        result,
    ].join('\n');
}

/**
 * Loads compiled logic, returning its default export.
 * @param {string} code - the compiled JavaScript of logic/logic.ts
 * @param {Modules} modules - the modules the engine supplies to it
 * @returns {Promise<Logic>} the template's logic
 */
export async function loadLogic(code: string, modules: Modules): Promise<Logic<any, any>> {
    const tsImport = await import('typescript');
    const ts = ('default' in tsImport && tsImport.default ? tsImport.default : tsImport);
    const key = `logic-${++loads}`;
    const rewritten = rewriteImports(ts, code, key, new Set(Object.keys(modules)));
    const registry: Map<string, Modules> = ((globalThis as any)[REGISTRY] ??= new Map());
    registry.set(key, modules);
    let logic: unknown;
    try {
        logic = await dynamicImport(`data:text/javascript;charset=utf-8,${encodeURIComponent(rewritten)}`);
    } finally {
        registry.delete(key);
    }
    if (!isLogic(logic)) {
        throw new Error('Template logic must export, as its default, the logic defineLogic() returns.');
    }
    return logic;
}
