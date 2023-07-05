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
import { ProcessingFunction } from '../TemplateMarkToTypeScriptCompiler';
import { IList } from '../model-gen/org.accordproject.commonmark@0.5.0';
import { IListBlockDefinition, IWithDefinition } from '../model-gen/org.accordproject.templatemark@0.5.0';
import { AbstractComplexCompiler, getTypeScriptType, makeCiceroMark, writeCloseDataScope, writeCloseGenerateScope, writeCloseNodeScope, writeDebug, writeOpenDataScope, writeOpenGenerateScope, writeOpenNodeScope } from './Common';

export class ListBlock extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.ListBlockDefinition`;
    constructor() {
        super(false);
    }

    enter(fw:FileWriter, level:number,templateMarkNode:IWithDefinition) {
        writeDebug(fw, level, templateMarkNode);
        writeOpenNodeScope(fw,level);
        writeOpenDataScope(fw,level,templateMarkNode.name);
    }

    generate(fw:FileWriter, level:number, templateMarkNode:IListBlockDefinition, doIt:ProcessingFunction) {
        if(templateMarkNode?.nodes?.[0]) {
            const clone = makeCiceroMark(templateMarkNode?.nodes?.[0]) as IList;
            writeOpenGenerateScope(fw, level);
            fw.writeLine(level, `const result = ${JSON.stringify(clone)} as ${getTypeScriptType(templateMarkNode.$class)};`);
            fw.writeLine(level, 'Runtime.peek($data).forEach( (item:any) => {');
            fw.writeLine(level, 'Runtime.push($data,item);');
            if(templateMarkNode.nodes?.[0].nodes?.[0]) {
                doIt(fw, level+1, templateMarkNode.nodes[0].nodes[0]);
                delete templateMarkNode.nodes; // already handled children ^^^
            }
            fw.writeLine(level, 'Runtime.pop($data);');
            fw.writeLine(level, '});');
            fw.writeLine(level, 'return result;');
            writeCloseGenerateScope(fw, level);
        }
    }

    exit(fw:FileWriter, level:number) {
        writeCloseDataScope(fw,level);
        writeCloseNodeScope(fw,level);
    }
}