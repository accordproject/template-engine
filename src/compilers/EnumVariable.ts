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
import { IEnumVariable } from '../model-gen/org.accordproject.ciceromark@0.6.0';
import { IEnumVariableDefinition } from '../model-gen/org.accordproject.templatemark@0.5.0';
import { AbstractComplexCompiler, getTypeScriptType, makeCiceroMark, writeCloseDataScope, writeCloseGenerateScope, writeOpenDataScope, writeOpenGenerateScope } from './Common';

export class EnumVariable extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.EnumVariableDefinition`;
    constructor() {
        super(true);
    }
    generate(fw:FileWriter, level:number, templateMarkNode:IEnumVariableDefinition) {
        const clone = makeCiceroMark(templateMarkNode) as IEnumVariable;
        writeOpenGenerateScope(fw,level);
        if(templateMarkNode.name !== 'this') {
            writeOpenDataScope(fw,level,templateMarkNode.name);
        }
        fw.writeLine(level, 'const text = JSON.stringify(Runtime.peek($data)) as string;');
        if(templateMarkNode.name !== 'this') {
            writeCloseDataScope(fw,level);
        }
        fw.writeLine(level, `const variable:any = ${JSON.stringify(clone)};`);
        fw.writeLine(level, 'variable.value = text;');
        fw.writeLine(level, `return variable as ${getTypeScriptType(clone.$class)};`);
        writeCloseGenerateScope(fw,level);
    }
}