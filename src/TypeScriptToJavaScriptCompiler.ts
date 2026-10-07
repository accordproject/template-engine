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

import { createDefaultMapFromNodeModules } from '@typescript/vfs';
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
 * Note that the 'typescript' module is loaded from node_modules (Node.js) or from the
 * bundle (browser). This module is used by twoslash. Its lib.*.d.ts files are read from
 * node_modules (Node.js) or from the bundle (browser), so no network requests are made.
 *
 * The 'updateRuntimeDependencies' script it used to package type declarations for 3rd-party
 * modules that we need to expose to user TS code: dayjs and jsonpath, these also need to be
 * added to the twoslash compilation context. It also packages the TypeScript lib files
 * for the browser.
 */

// https://microsoft.github.io/monaco-editor/typedoc/enums/languages.typescript.ScriptTarget.html#ES2022
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

const SCRIPT_TARGET = 9 // ES2022

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

export const MODULE_KIND_COMMONJS = 1;
const MODULE_KIND = 99; // ESNext modules

/**
 * User code is compiled against the ES2022 lib only, which is what the browser bundle
 * contains (see the 'updateRuntimeDependencies' script), so the DOM and web worker globals
 * are not available. console is declared separately because its declaration lives in
 * the DOM lib.
 */
const CONSOLE_LIB = 'lib.console.d.ts';
const CONSOLE_DECLARATION = `
interface Console {
    assert(condition?: boolean, ...data: any[]): void;
    clear(): void;
    count(label?: string): void;
    countReset(label?: string): void;
    debug(...data: any[]): void;
    dir(item?: any, options?: any): void;
    error(...data: any[]): void;
    group(...data: any[]): void;
    groupCollapsed(...data: any[]): void;
    groupEnd(): void;
    info(...data: any[]): void;
    log(...data: any[]): void;
    table(tabularData?: any, properties?: string[]): void;
    time(label?: string): void;
    timeEnd(label?: string): void;
    timeLog(label?: string, ...data: any[]): void;
    trace(...data: any[]): void;
    warn(...data: any[]): void;
}
declare var console: Console;
`;
const LIBS = ['lib.es2022.d.ts', CONSOLE_LIB];

type TypeScriptLibrary = {
    ts: any;
    fsMap: Map<string,string>;
};

/**
 * Loading the typescript module and its lib.*.d.ts files is expensive, so it is done
 * once per module and shared by every compiler instance. Callers must copy fsMap before
 * handing it to twoslash, because twoslash writes the files it compiles into the map
 * it is given.
 */
let typeScriptLibrary: Promise<TypeScriptLibrary> | undefined;

async function loadTypeScriptLibrary(): Promise<TypeScriptLibrary> {
    let ts: any;
    let fsMap: Map<string,string>;
    if(typeof window === 'undefined') {
        // node does not (yet) support http(s) imports
        // see: https://nodejs.org/api/esm.html#https-and-http-imports
        ts = (await import ('typescript')).default;
        if(!ts) {
            throw new Error('Failed to load typescript module');
        }
        fsMap = createDefaultMapFromNodeModules({
            target: SCRIPT_TARGET,
        });
    }
    else {
        // Use the bundled typescript in the browser rather than a dynamic CDN module
        // import: webpack cannot resolve the runtime CDN URL ('Cannot find module
        // https://...'), and twoslash already pulls typescript into the browser bundle.
        ts = (await import('typescript')).default;
        if(!ts) {
            throw new Error('Failed to load typescript module');
        }
        // the lib files are bundled too, rather than fetched from the TypeScript CDN
        const { TYPESCRIPT_LIBS } = await import('./runtime/typescriptLibs');
        fsMap = new Map(Object.entries(TYPESCRIPT_LIBS));
    }
    fsMap.set(`/${CONSOLE_LIB}`, CONSOLE_DECLARATION);
    fsMap.set('/node_modules/@types/dayjs/index.d.ts', Buffer.from(DAYJS_BASE64, 'base64').toString());
    fsMap.set('/node_modules/@types/jsonpath/index.d.ts', Buffer.from(JSONPATH_BASE64, 'base64').toString());
    return { ts, fsMap };
}

function getTypeScriptLibrary(): Promise<TypeScriptLibrary> {
    if(!typeScriptLibrary) {
        typeScriptLibrary = loadTypeScriptLibrary().catch((err) => {
            // don't cache a failed load, so that a later call can retry
            typeScriptLibrary = undefined;
            throw err;
        });
    }
    return typeScriptLibrary;
}

export class TypeScriptToJavaScriptCompiler {
    context: string;
    fsMap: Map<string,string>|undefined;

    ts: any;
    /** @deprecated unused: the typescript module and its lib files are bundled */
    typescriptUrl?: string;

    constructor(modelManager: ModelManager, templateConceptFqn?: string, userLogicSymbols: string[] = []) {
        this.context = new TypeScriptCompilationContext(modelManager, templateConceptFqn, userLogicSymbols).getCompilationContext();
    }

    /**
     * Loads the typescript module and its lib files. Must be awaited before compile.
     * @param {string} [typescriptUrl] deprecated and unused
     */
    async initialize(typescriptUrl?: string) {
        if(typescriptUrl) {
            this.typescriptUrl = typescriptUrl;
        }
        const library = await getTypeScriptLibrary();
        this.ts = library.ts;
        this.fsMap = new Map(library.fsMap);
    }

    compile(typescript: string, moduleKind?: number, filename?: string): TwoSlashReturn {
        if(!this.fsMap) {
            throw new Error('initialize must be awaited before compile is called.');
        }
        const filenameHeader = filename ? `// @filename: ${filename}\n` : '';
        const twoSlashCode =`
${this.context}
${filenameHeader}${typescript}
`;

        const emittedFilename = filename ? filename.replace(/\.ts$/, '.js') : 'code.js';
        const options: TwoSlashOptions = {
            // twoslash writes the compiled files into the map, so give it a fresh copy
            fsMap: new Map(this.fsMap),
            tsModule: this.ts,
            defaultCompilerOptions: {
                target: SCRIPT_TARGET,
                module: moduleKind ?? MODULE_KIND,
                lib: LIBS,
            },
            lzstringModule:lzstring,
            defaultOptions: {
                showEmit: true,
                noErrorValidation: true,
                showEmittedFile: emittedFilename
            }
        };
        // console.log(twoSlashCode);
        const result = twoslasher(twoSlashCode, 'ts', options);
        return result;
    }
}
