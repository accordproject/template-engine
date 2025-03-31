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

import { createDefaultMapFromNodeModules, createDefaultMapFromCDN } from '@typescript/vfs';
import { twoslasher, TwoSlashOptions, TwoSlashReturn } from '@typescript/twoslash';
import { ModelManager } from '@accordproject/concerto-core';
import { TypeScriptCompilationContext } from './TypeScriptCompilationContext';
import { DAYJS_BASE64, JSONPATH_BASE64 } from './runtime/declarations';
import * as lzstring from 'lz-string';

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

const SCRIPT_TARGET = 9

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

export class TypeScriptToJavaScriptCompiler {
    context: string;
    fsMap: Map<string,string>|undefined;

    ts: any;
    typescriptUrl: string;

    constructor(modelManager: ModelManager, templateConceptFqn?: string) {
        this.context = new TypeScriptCompilationContext(modelManager, templateConceptFqn).getCompilationContext();
        this.typescriptUrl = TYPESCRIPT_URL;
    }

    async initialize(typescriptUrl?: string) {
        if(typescriptUrl) {
            this.typescriptUrl = typescriptUrl;
        }
        if(typeof window === 'undefined') {
            // node does not (yet) support http(s) imports
            // see: https://nodejs.org/api/esm.html#https-and-http-imports
            this.ts = (await import ('typescript')).default;
            if(!this.ts) {
                throw new Error('Failed to load typescript module');
            }
            this.fsMap = createDefaultMapFromNodeModules({
                target: SCRIPT_TARGET,
            });
        }
        else {
            this.ts = (await import(this.typescriptUrl)).default;
            if(!this.ts) {
                throw new Error('Failed to dynamically load typescript');
            }
            this.fsMap = await createDefaultMapFromCDN({ target: SCRIPT_TARGET }, this.ts.version, false, this.ts);
        }
        this.fsMap.set('/node_modules/@types/dayjs/index.d.ts', Buffer.from(DAYJS_BASE64, 'base64').toString());
        this.fsMap.set('/node_modules/@types/jsonpath/index.d.ts', Buffer.from(JSONPATH_BASE64, 'base64').toString());
    }

    compile(typescript: string): TwoSlashReturn {
        if(!this.fsMap) {
            throw new Error('initialize must be awaited before compile is called.');
        }
        const twoSlashCode =`
${this.context}
${typescript}
`;

        const options: TwoSlashOptions = {
            fsMap: this.fsMap,
            tsModule: this.ts,
            defaultCompilerOptions: {
                target: SCRIPT_TARGET,
                module: MODULE_KIND,
            },
            lzstringModule:lzstring,
            defaultOptions: {
                showEmit: true,
                noErrorValidation: true,
                showEmittedFile: 'code.js'
            }
        };
        const result = twoslasher(twoSlashCode, 'ts', options);
        return result;
    }
}
