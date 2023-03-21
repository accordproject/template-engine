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
import ts from 'typescript';
import { createDefaultMapFromNodeModules } from '@typescript/vfs';
import { twoslasher, TwoSlashOptions, TwoSlashReturn } from '@typescript/twoslash';
import { ModelManager } from '@accordproject/concerto-core';
import { TypeScriptCompilationContext } from './TypeScriptCompilationContext';
import { DAYJS_BASE64, JSONPATH_BASE64 } from './runtime/declarations';

/**
 * Compiles user Typescript code to JavaScript, This uses the '@typescript/twoslash'
 * project which is maintained by the Typescript team and powers their web playground.
 * It uses the TypeScriptCompilationContext class to construct a payload for twoslash
 * that is composed of multiple TS files to compile, along with their 3rd-party module
 * dependencies.
 */
export class TypeScriptToJavaScriptCompiler {
    context: string;

    constructor(modelManager: ModelManager) {
        this.context = new TypeScriptCompilationContext(modelManager).getCompilationContext();
    }

    compile(typescript: string): TwoSlashReturn {
        const fsMap = createDefaultMapFromNodeModules({
            target: ts.ScriptTarget.ES2020,
        });

        fsMap.set('/node_modules/@types/dayjs/index.d.ts', Buffer.from(DAYJS_BASE64, 'base64').toString());
        fsMap.set('/node_modules/@types/jsonpath/index.d.ts', Buffer.from(JSONPATH_BASE64, 'base64').toString());

        const twoSlashCode =`
${this.context}
${typescript}
`;

        const options: TwoSlashOptions = {
            fsMap,
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