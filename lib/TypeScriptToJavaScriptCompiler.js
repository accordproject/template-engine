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
exports.TypeScriptToJavaScriptCompiler = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const vfs_1 = require("@typescript/vfs");
const twoslash_1 = require("@typescript/twoslash");
const TypeScriptCompilationContext_1 = require("./TypeScriptCompilationContext");
const declarations_1 = require("./runtime/declarations");
const logicDeclarations_1 = require("./runtime/logicDeclarations");
const lzstring = __importStar(require("lz-string"));
/**
 * Compiles user Typescript code to JavaScript. This uses the '@typescript/twoslash'
 * project which is maintained by the Typescript team and powers their web playground.
 * It uses the TypeScriptCompilationContext class to construct a payload for twoslash
 * that is composed of multiple TS files to compile, along with their 3rd-party module
 * dependencies.
 *
 * Note that the 'typescript' module is either dynamically loaded from node_modules (Node.js)
 * or from the CDN (browser). This module is used by twoslash.
 *
 * The 'updateRuntimeDependencies' script it used to package type declarations for 3rd-party
 * modules that we need to expose to user TS code: dayjs and jsonpath, these also need to be
 * added to the twoslash compilation context.
 */
const TYPESCRIPT_URL = process.env.TYPESCRIPT_URL ? process.env.TYPESCRIPT_URL : 'https://cdn.jsdelivr.net/npm/typescript@4.9.4/+esm';
// https://microsoft.github.io/monaco-editor/typedoc/enums/languages.typescript.ScriptTarget.html#ES2020
// enum ScriptTarget {
//     /** @deprecated */
//     ES3 = 0,
//     ES5 = 1,
//     ES2015 = 2,
//     ES2016 = 3,
//     ES2017 = 4,
//     ES2018 = 5,
//     ES2019 = 6,
//     ES2020 = 7,
//     ES2021 = 8,
//     ES2022 = 9,
//     ES2023 = 10,
//     ES2024 = 11,
//     ESNext = 99,
//     JSON = 100,
//     Latest = 99,
// }
const SCRIPT_TARGET = 9;
// enum ModuleKind {
//     None = 0,
//     CommonJS = 1,
//     AMD = 2,
//     UMD = 3,
//     System = 4,
//     ES2015 = 5,
//     ES2020 = 6,
//     ES2022 = 7,
//     ESNext = 99,
//     Node16 = 100,
//     Node18 = 101,
//     NodeNext = 199,
//     Preserve = 200,
// }
const MODULE_KIND = 6;
class TypeScriptToJavaScriptCompiler {
    constructor(modelManager, templateConceptFqn, options = {}) {
        this.context = new TypeScriptCompilationContext_1.TypeScriptCompilationContext(modelManager, templateConceptFqn, options).getCompilationContext();
        this.typescriptUrl = TYPESCRIPT_URL;
    }
    async initialize(typescriptUrl) {
        if (typescriptUrl) {
            this.typescriptUrl = typescriptUrl;
        }
        if (typeof window === 'undefined') {
            // node does not (yet) support http(s) imports
            // see: https://nodejs.org/api/esm.html#https-and-http-imports
            this.ts = (await Promise.resolve().then(() => __importStar(require('typescript')))).default;
            if (!this.ts) {
                throw new Error('Failed to load typescript module');
            }
            this.fsMap = (0, vfs_1.createDefaultMapFromNodeModules)({
                target: SCRIPT_TARGET,
            });
        }
        else {
            // Use the bundled typescript in the browser rather than a dynamic CDN module
            // import: webpack cannot resolve the runtime CDN URL ('Cannot find module
            // https://...'), and twoslash already pulls typescript into the browser bundle.
            this.ts = (await Promise.resolve().then(() => __importStar(require('typescript')))).default;
            if (!this.ts) {
                throw new Error('Failed to load typescript module');
            }
            // lib.d.ts files are still fetched from the CDN at runtime (a browser fetch).
            this.fsMap = await (0, vfs_1.createDefaultMapFromCDN)({ target: SCRIPT_TARGET }, this.ts.version, false, this.ts);
        }
        this.fsMap.set('/node_modules/@types/dayjs/index.d.ts', Buffer.from(declarations_1.DAYJS_BASE64, 'base64').toString());
        this.fsMap.set('/node_modules/@types/jsonpath/index.d.ts', Buffer.from(declarations_1.JSONPATH_BASE64, 'base64').toString());
        // The logic API, for logic that imports '@accordproject/template-engine/logic'.
        this.fsMap.set('/node_modules/@accordproject/template-engine/logic.d.ts', logicDeclarations_1.LOGIC_DECLARATIONS);
    }
    compile(typescript) {
        if (!this.fsMap) {
            throw new Error('initialize must be awaited before compile is called.');
        }
        const twoSlashCode = `
${this.context}
${typescript}
`;
        const options = {
            fsMap: this.fsMap,
            tsModule: this.ts,
            defaultCompilerOptions: {
                target: SCRIPT_TARGET,
                module: MODULE_KIND,
            },
            lzstringModule: lzstring,
            defaultOptions: {
                showEmit: true,
                noErrorValidation: true,
                showEmittedFile: 'code.js'
            }
        };
        // console.log(twoSlashCode);
        const result = (0, twoslash_1.twoslasher)(twoSlashCode, 'ts', options);
        return result;
    }
}
exports.TypeScriptToJavaScriptCompiler = TypeScriptToJavaScriptCompiler;
//# sourceMappingURL=TypeScriptToJavaScriptCompiler.js.map