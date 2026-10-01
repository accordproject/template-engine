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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeModules = runtimeModules;
exports.usesLogicApi = usesLogicApi;
exports.rewriteImports = rewriteImports;
exports.loadLogic = loadLogic;
const dayjs_1 = __importDefault(require("dayjs"));
const jsonpath_1 = __importDefault(require("jsonpath"));
const logicApi = __importStar(require("./logic"));
const logic_1 = require("./logic");
const types_1 = require("./types");
const JavaScriptEvaluator_1 = require("../JavaScriptEvaluator");
const REGISTRY = Symbol.for('@accordproject/template-engine/modules');
let loads = 0;
/**
 * The modules the engine supplies to logic compiled against `modelManager`.
 * @param {ModelManager} modelManager - the template's models
 * @returns {Modules} the modules, by import specifier
 */
function runtimeModules(modelManager) {
    const modules = {
        [types_1.LOGIC_MODULE]: { ...logicApi },
        [types_1.TYPES_MODULE]: (0, types_1.typeValues)(modelManager),
        dayjs: { default: dayjs_1.default },
        jsonpath: { default: jsonpath_1.default },
    };
    for (const [namespace, enums] of Object.entries((0, types_1.enumValues)(modelManager))) {
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
function usesLogicApi(source) {
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
function rewriteImports(ts, code, key, specifiers) {
    const source = ts.createSourceFile('logic.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const edits = [];
    for (const statement of source.statements) {
        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
            throw new Error(`Template logic may not re-export from '${statement.moduleSpecifier.text}'.`);
        }
        if (!ts.isImportDeclaration(statement)) {
            continue;
        }
        const specifier = statement.moduleSpecifier.text;
        if (!specifiers.has(specifier)) {
            throw new Error(`Template logic may import only types from '${specifier}'. ` +
                `Its values must come from ${[...specifiers].map(s => `'${s}'`).join(', ')}.`);
        }
        const from = JSON.stringify(specifier);
        const bindings = [];
        const clause = statement.importClause;
        if (clause && !clause.isTypeOnly) {
            if (clause.name) {
                bindings.push(`const ${clause.name.text} = __import(${from}, 'default');`);
            }
            const named = clause.namedBindings;
            if (named && ts.isNamespaceImport(named)) {
                bindings.push(`const ${named.name.text} = __modules[${from}];`);
            }
            else if (named) {
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
async function loadLogic(code, modules) {
    const tsImport = await Promise.resolve().then(() => __importStar(require('typescript')));
    const ts = ('default' in tsImport && tsImport.default ? tsImport.default : tsImport);
    const key = `logic-${++loads}`;
    const rewritten = rewriteImports(ts, code, key, new Set(Object.keys(modules)));
    const registry = (globalThis[REGISTRY] ??= new Map());
    registry.set(key, modules);
    let logic;
    try {
        logic = await (0, JavaScriptEvaluator_1.dynamicImport)(`data:text/javascript;charset=utf-8,${encodeURIComponent(rewritten)}`);
    }
    finally {
        registry.delete(key);
    }
    if (!(0, logic_1.isLogic)(logic)) {
        throw new Error('Template logic must export, as its default, the logic defineLogic() returns.');
    }
    return logic;
}
//# sourceMappingURL=loader.js.map