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
import { FileWriter } from '@accordproject/concerto-util';
import { TemplateMarkModel } from '@accordproject/markdown-common';
import { IFormula } from '../model-gen/org.accordproject.ciceromark@0.6.0';
import { IFormulaDefinition } from '../model-gen/org.accordproject.templatemark@0.5.0';
import { AbstractComplexCompiler, getTypeScriptType, makeCiceroMark, writeCloseGenerateScope, writeOpenGenerateScope } from './Common';

export class Formula extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.FormulaDefinition`;
    constructor() {
        super(true);
    }
    generate(fw:FileWriter, level:number, templateMarkNode:IFormulaDefinition) {
        const clone = makeCiceroMark(templateMarkNode) as IFormula;
        writeOpenGenerateScope(fw,level);
        fw.writeLine(level, `const formulaResult = UserCode.${templateMarkNode.name}(data,library,now);`);
        fw.writeLine(level, 'const text = JSON.stringify(formulaResult);');
        fw.writeLine(level, `const formula:any = ${JSON.stringify(clone)};`);
        fw.writeLine(level, 'formula.value = text;');
        fw.writeLine(level, `formula.code = ${JSON.stringify(templateMarkNode.code.contents)};`); // HACK - update model
        fw.writeLine(level, `return formula as ${getTypeScriptType(clone.$class)};`);
        writeCloseGenerateScope(fw,level);
    }
}