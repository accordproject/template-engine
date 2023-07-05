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
import { CommonMarkModel,TemplateMarkModel } from '@accordproject/markdown-common';

import { ProcessingFunction } from '../TemplateMarkToTypeScriptCompiler';
import { IOptionalDefinition } from '../model-gen/org.accordproject.templatemark@0.5.0';
import { AbstractComplexCompiler, getTypeScriptType, makeCiceroMark, writeCloseDataScope, writeCloseGenerateScope, writeCloseNodeScope, writeDebug, writeOpenDataScope, writeOpenGenerateScope, writeOpenNodeScope } from './Common';


export class Optional extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.OptionalDefinition`;
    constructor() {
        super(false);
    }

    enter(fw:FileWriter, level:number,templateMarkNode:IOptionalDefinition) {
        writeDebug(fw, level, templateMarkNode);
        writeOpenNodeScope(fw,level);
        writeOpenDataScope(fw,level,templateMarkNode.name, true); // allow pushing undefined onto the stack
    }

    generate(fw:FileWriter, level:number, templateMarkNode:IOptionalDefinition, doIt:ProcessingFunction) {
        const clone = makeCiceroMark(templateMarkNode) as any;
        delete clone.nodes;
        delete clone.whenSome; // replaced below
        delete clone.whenNone;
        writeOpenGenerateScope(fw, level);
        fw.writeLine(level, `const result = ${JSON.stringify(clone)} as ${getTypeScriptType(templateMarkNode.$class)};`);
        fw.writeLine(level, 'const hasSome:boolean = !(Runtime.peek($data) === null || Runtime.peek($data) === undefined);');
        fw.writeLine(level, '(result as CiceroMark.IOptional).hasSome = hasSome;');
        fw.writeLine(level, 'if(hasSome) {');
        doIt(fw, level+1, {$class: `${CommonMarkModel.NAMESPACE}.Paragraph`, nodes: templateMarkNode.whenSome});
        fw.writeLine(level, '(result as CiceroMark.IOptional).whenSome = $result.nodes[0];');
        fw.writeLine(level, '(result as CiceroMark.IOptional).whenNone = $result.nodes[0];'); // HACK - model needs to be updated
        fw.writeLine(level, 'return result;');
        fw.writeLine(level, '}');
        fw.writeLine(level, 'else {');
        doIt(fw, level+1, {$class: `${CommonMarkModel.NAMESPACE}.Paragraph`, nodes: templateMarkNode.whenNone});
        fw.writeLine(level, '(result as CiceroMark.IOptional).whenNone = $result.nodes[0];');
        fw.writeLine(level, '(result as CiceroMark.IOptional).whenSome = $result.nodes[0];');  // HACK - model needs to be updated
        fw.writeLine(level, 'return result;');
        fw.writeLine(level, '}');
        writeCloseGenerateScope(fw, level);
        delete templateMarkNode.nodes;
        delete (templateMarkNode as any).whenSome; // already handled
        delete (templateMarkNode as any).whenNone;
    }

    exit(fw:FileWriter, level:number) {
        writeCloseDataScope(fw,level);
        writeCloseNodeScope(fw,level);
    }
}