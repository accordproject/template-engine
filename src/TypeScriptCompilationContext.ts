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
import { getTemplateClassDeclaration } from './utils';

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
    userLogicSymbols: string[];

    constructor(modelManager:ModelManager,templateConceptFqn?: string, userLogicSymbols: string[] = []) {
        this.modelManager = modelManager;
        this.templateClass = getTemplateClassDeclaration(this.modelManager, templateConceptFqn);
        this.userLogicSymbols = userLogicSymbols;
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

    getCompilationContext() : string {
        const files = this.getTypeScriptFiles();

        let result = '';

        Object.keys(files).forEach( key => {
            const content = files[key];
            result += `
// @filename: ${key}
${content}
`;
        });

        result += `
// @filename: code.ts
import * as TemplateModel from './${this.templateClass.getNamespace()}';
import dayjs from 'dayjs';
import jp from 'jsonpath';

type GenerationOptions = {
    now?:string,
    locale?:string
}
`;
        // Ambient declarations for top-level symbols in the template's
        // logic/logic.ts so formula expressions like {{% helperFn(...) %}}
        // type-check. At runtime the formula evaluator prepends the
        // compiled logic JS, so the same symbols resolve to real values.
        if (this.userLogicSymbols.length > 0) {
            result += '\n';
            this.userLogicSymbols.forEach(name => {
                result += `declare const ${name}: any;\n`;
            });
        }
        return result;
    }
}
