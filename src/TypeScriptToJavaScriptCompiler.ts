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
import { DAYJS_BASE64, JSONPATH_BASE64, DECIMAL_JS_BASE64 } from './runtime/declarations';
import * as lzstring from 'lz-string';
import memfs from 'memfs';
import webpack from 'webpack';
import * as fs from 'fs';
import { ufs } from 'unionfs';
import * as ts from "typescript";
import { link } from 'linkfs';
import path from 'path';

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

export type CompilerResult = {
    code?: string;
    errors: Array<string>;
}

export type TranspileOptions = {
    verbose?: boolean;
}

function changeExtension(file: string, extension: string): string {
    const basename = path.basename(file, path.extname(file))
    return path.join(path.dirname(file), basename + extension)
}

export class TypeScriptToJavaScriptCompiler {
    context: TypeScriptCompilationContext;
    fsMap: Map<string, string> | undefined;

    ts: any;
    typescriptUrl: string;

    constructor(modelManager: ModelManager, templateConceptFqn?: string) {
        this.context = new TypeScriptCompilationContext(modelManager, templateConceptFqn);
        this.typescriptUrl = TYPESCRIPT_URL;
    }

    async initialize(typescriptUrl?: string) {
        if (typescriptUrl) {
            this.typescriptUrl = typescriptUrl;
        }
        if (typeof window === 'undefined') {
            // node does not (yet) support http(s) imports
            // see: https://nodejs.org/api/esm.html#https-and-http-imports
            this.ts = (await import('typescript')).default;
            if (!this.ts) {
                throw new Error('Failed to load typescript module');
            }
            this.fsMap = createDefaultMapFromNodeModules({
                target: SCRIPT_TARGET,
            });
        }
        else {
            this.ts = (await import(this.typescriptUrl)).default;
            if (!this.ts) {
                throw new Error('Failed to dynamically load typescript');
            }
            this.fsMap = await createDefaultMapFromCDN({ target: SCRIPT_TARGET }, this.ts.version, false, this.ts);
        }
        this.fsMap.set('/node_modules/@types/dayjs/index.d.ts', Buffer.from(DAYJS_BASE64, 'base64').toString());
        this.fsMap.set('/node_modules/@types/jsonpath/index.d.ts', Buffer.from(JSONPATH_BASE64, 'base64').toString());
        this.fsMap.set('/node_modules/@types/decimal.js/index.d.ts', Buffer.from(DECIMAL_JS_BASE64, 'base64').toString());
    }

    /**
     * This performs JIT compilation of simple TS expressions to JS. It is used for the code
     * blocks and condition nodes in TemplateMark
     * @param typescript the TS expression to compile
     * @returns compilation result
     */
    compile(typescript: string): TwoSlashReturn {
        if (!this.fsMap) {
            throw new Error('initialize must be awaited before compile is called.');
        }
        const twoSlashCode = `
        ${this.context.getCompilationContext()}
        ${typescript}
        `;

        const options: TwoSlashOptions = {
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
        const result = twoslasher(twoSlashCode, 'ts', options);
        return result;
    }

    /**
     * Transpiles the TS logic for a template to JS, along with
     * its dependencies and webpacks into an ESM module. Note that
     * transpilation will NOT catch type checking errors!
     * WARNING: this method currently requires file system access
     * and will fail in the browser.
     * @param typescript the typescript logic to transpile to JS
     * @returns a compiler result
     */
    async transpileLogic(typescript: string, options?: TranspileOptions): Promise<CompilerResult> {
        const compiler = webpack({
            entry: '/logic/logic.js',
            mode: 'production',
            experiments: {
                outputModule: true
            },
            output: {
                filename: 'logic.js',
                path: '/logic',
                library: {
                    type: 'module',
                },
            },
        });

        const vol = new memfs.Volume();
        const myfs = memfs.createFsFromVolume(vol);

        myfs.mkdirSync('/logic');
        myfs.mkdirSync('/logic/generated');
        myfs.mkdirSync('/src');
        myfs.mkdirSync('/src/slc');

        // WARNING - this will fail in the browser!
        const slcTs = fs.readFileSync(path.resolve('./src/slc/SmartLegalContract.ts'), 'utf-8');
        const slcJs = ts.transpileModule(slcTs, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
        myfs.writeFileSync(`/src/slc/SmartLegalContract.js`, slcJs.outputText);

        const records = this.context.getTypeScriptFiles();
        const fileNames = Object.keys(records);

        fileNames.forEach((fileName) => {
            const tsCode = records[fileName];
            const jsCode = ts.transpileModule(tsCode, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
            if (jsCode.diagnostics && options?.verbose) {
                console.log(jsCode.diagnostics.join());
            }
            const newfile = changeExtension(fileName, '.js');
            myfs.writeFileSync(`/logic/generated/${newfile}`, jsCode.outputText);
        });

        const jsCode = ts.transpileModule(typescript, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
        if (jsCode.diagnostics && options?.verbose) {
            console.log(jsCode.diagnostics.join());
        }
        myfs.writeFileSync('/logic/logic.js', jsCode.outputText);
        myfs.writeFileSync('/package.json', JSON.stringify({
            "name": "template",
            "version": "0.0.1"
        }));

        // /node_modules -> should be read from local fs, so we can
        // read things like dayjs and decimal.js npm modules
        // everything else is stored in memory
        const lfs = link(fs, ['/node_modules', path.resolve('./node_modules')]);
        // @ts-expect-error types have diverged?
        const mergedFs = ufs.use(myfs).use(lfs);

        // @ts-expect-error types have diverged?
        compiler.outputFileSystem = mergedFs;
        // @ts-expect-error types have diverged?
        compiler.inputFileSystem = mergedFs;

        const runPromise = new Promise<CompilerResult>((resolve, reject) => {
            compiler.run((err, stats) => {
                if (err) {
                    console.log(err);
                    reject({ error: err });
                }
                else {
                    if(options?.verbose) {
                        console.log(stats?.toString());
                    }
                    const content = mergedFs.readFileSync('/logic/logic.js');
                    resolve({ code: content.toString(), errors: [] });
                }
                compiler.close((closeErr) => {
                    console.log(closeErr?.message);
                    reject({ error: closeErr });
                });
            });
        });

        const result = await runPromise;
        return result;
    }
}
