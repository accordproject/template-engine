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

import traverse from 'traverse';
import { TemplateMarkModel } from '@accordproject/markdown-common';
import { ClassDeclaration, ModelManager } from '@accordproject/concerto-core';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
import { TwoSlashReturn } from '@typescript/twoslash';
import { getTemplateClassDeclaration } from './Common';
import { TemplateMarkToTypeScriptCompiler } from './TemplateMarkToTypeScriptCompiler';

const CODE_NODES = [
    `${TemplateMarkModel.NAMESPACE}.FormulaDefinition`,
    `${TemplateMarkModel.NAMESPACE}.ConditionDefinition`,
    `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
];

export type CompilerError = {
    nodeId: string;
    code: string;
    errors:TwoSlashReturn['errors'];
};

/**
 * Compiles all the Typescript nodes in a TemplateMark JSON
 * to ES_2020 and returns a modified TemplateMark JSON.
 */
export class TemplateMarkToJavaScriptCompiler {
    modelManager:ModelManager;
    compiler: TypeScriptToJavaScriptCompiler;
    templateClass: ClassDeclaration;

    constructor(modelManager: ModelManager) {
        this.modelManager = modelManager;
        this.compiler = new TypeScriptToJavaScriptCompiler(modelManager);
        this.templateClass = getTemplateClassDeclaration(modelManager);
    }

    compile(templateJson: any) : any {
        const namedTemplateMark = TemplateMarkToTypeScriptCompiler.nameUserCode(templateJson);
        const functionCompiler = new TemplateMarkToTypeScriptCompiler(this.modelManager);

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;
        const errors = Array<CompilerError>();
        const compiled = traverse(namedTemplateMark).map(function (x) {
            if (x && CODE_NODES.includes(x.$class)) {
                if (x.code) {  // formula
                    const result = that.compiler.compile(functionCompiler.writeFunctionToString(x.name, 'any', x.code.contents));
                    if(result.errors.length === 0) {
                        x.code.contents = result.code;
                        x.code.type = 'ES_2020';
                        this.update(x);
                    }
                    else {
                        errors.push({
                            nodeId: x.name,
                            code: x.code.contents,
                            errors: result.errors
                        });
                    }
                }
                else if (x.condition) {  // condition or clause (boolean condition)
                    const result = that.compiler.compile(functionCompiler.writeFunctionToString(x.functionName, 'boolean', x.condition.contents));
                    if(result.errors.length === 0) {
                        x.condition.contents = result.code;
                        x.condition.type = 'ES_2020';
                        this.update(x);
                    }
                    else {
                        errors.push({
                            nodeId: x.functionName,
                            code: x.condition.contents,
                            errors: result.errors
                        });
                    }
                }
            }
        });

        if(errors.length === 0) {
            return compiled;
        }
        else {
            throw errors;
        }
    }
}