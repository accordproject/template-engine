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
import { IJoinDefinition } from '../model-gen/org.accordproject.templatemark@0.4.0';
import { AbstractComplexCompiler, getTypeScriptType, writeCloseDataScope, writeCloseGenerateScope, writeOpenDataScope, writeOpenGenerateScope } from './Common';

export class Join extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.JoinDefinition`;
    constructor() {
        super(true);
    }
    generate(fw:FileWriter, level:number, templateMarkNode:IJoinDefinition) {
        writeOpenGenerateScope(fw,level);
        writeOpenDataScope(fw,level,templateMarkNode.name);
        fw.writeLine(level, `const text = Runtime.peek($data).join('${templateMarkNode.separator}');`);
        writeCloseDataScope(fw,level);
        fw.writeLine(level, `return { $class: '${CommonMarkModel.NAMESPACE}.Text', text: text } as ${getTypeScriptType(CommonMarkModel.NAMESPACE + '.Text')};`);
        writeCloseGenerateScope(fw,level);
        delete templateMarkNode.nodes; // ignore child nodes, like {{this}}
    }
}