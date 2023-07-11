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
import { TemplateMarkModel,CommonMarkModel } from '@accordproject/markdown-common';
import { IClause } from '../model-gen/org.accordproject.ciceromark@0.6.0';
import { IParagraph } from '../model-gen/org.accordproject.commonmark@0.5.0';
import { IClauseDefinition, IWithDefinition } from '../model-gen/org.accordproject.templatemark@0.5.0';
import { AbstractComplexCompiler, getTypeScriptType, makeCiceroMark, writeCloseDataScope, writeCloseGenerateScope, writeCloseNodeScope, writeDebug, writeOpenDataScope, writeOpenGenerateScope, writeOpenNodeScope } from './Common';

interface INamedClauseDefinition extends IClauseDefinition {
    readonly functionName: string;
}

export class Clause extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`;
    constructor() {
        super(false);
    }

    enter(fw:FileWriter, level:number,templateMarkNode:IWithDefinition) {
        writeDebug(fw, level, templateMarkNode);
        writeOpenNodeScope(fw,level);
        writeOpenDataScope(fw,level,templateMarkNode.name);
    }

    generate(fw:FileWriter, level:number, templateMarkNode:INamedClauseDefinition) {
        const clone = makeCiceroMark(templateMarkNode) as IClause;
        delete (clone as any).condition;
        delete (clone as any).functionName;
        const para = {$class: `${CommonMarkModel.NAMESPACE}.Paragraph`} as IParagraph;
        writeOpenGenerateScope(fw, level);
        if(templateMarkNode.condition) {
            fw.writeLine(level, `const isTrue:boolean = UserCode.${templateMarkNode.functionName}(data,library,options)`);
        }
        else {
            fw.writeLine(level, 'const isTrue:boolean = true;');
        }
        fw.writeLine(level, 'if(isTrue) {');
        fw.writeLine(level, `return ${JSON.stringify(clone)} as ${getTypeScriptType(clone.$class)};`);
        fw.writeLine(level, '}');
        fw.writeLine(level, 'else {');
        fw.writeLine(level, `return ${JSON.stringify(para)} as ${getTypeScriptType(para.$class)};`);
        fw.writeLine(level, '}');
        writeCloseGenerateScope(fw, level);
        delete templateMarkNode.condition;
    }

    exit(fw:FileWriter, level:number) {
        writeCloseDataScope(fw,level);
        writeCloseNodeScope(fw,level);
    }
}