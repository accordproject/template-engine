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
import { IConditional } from '../model-gen/org.accordproject.ciceromark@0.6.0';
import { IConditionalDefinition } from '../model-gen/org.accordproject.templatemark@0.4.0';
import { AbstractComplexCompiler, getTypeScriptType, makeCiceroMark, writeCloseDataScope, writeCloseGenerateScope, writeOpenDataScope, writeOpenGenerateScope } from './Common';

interface INamedConditionalDefinition extends IConditionalDefinition {
    readonly functionName: string;
}

export class Conditional extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition`;
    constructor() {
        super(false);
    }
    generate(fw:FileWriter, level:number, templateMarkNode:INamedConditionalDefinition) {
        const clone = makeCiceroMark(templateMarkNode, true) as IConditional;
        delete (clone as any).condition;
        delete (clone as any).dependencies;
        delete (clone as any).functionName;
        clone.isTrue = true;
        writeOpenGenerateScope(fw,level);
        if(templateMarkNode.condition) {
            fw.writeLine(level, `const isTrue:boolean = UserCode.${templateMarkNode.functionName}(data,library,now)`);
        }
        else {
            writeOpenDataScope(fw,level,templateMarkNode.name);
            fw.writeLine(level, 'const isTrue:boolean = Runtime.peek($data);');
            writeCloseDataScope(fw,level);
        }
        fw.writeLine(level, `const curNode = ${JSON.stringify(clone)} as ${getTypeScriptType(templateMarkNode.$class)};`);
        fw.writeLine(level, '(curNode as CiceroMark.IConditional).isTrue = isTrue;');
        fw.writeLine(level, 'return curNode;');
        writeCloseGenerateScope(fw,level);
        delete templateMarkNode.condition;
        delete (templateMarkNode as any).whenTrue;
        delete (templateMarkNode as any).whenFalse;

    }
}