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
import { IWithDefinition } from '../model-gen/org.accordproject.templatemark@0.4.0';
import { AbstractComplexCompiler, writeCloseDataScope, writeDebug, writeOpenDataScope } from './Common';

export class With extends AbstractComplexCompiler {
    static TYPE = `${TemplateMarkModel.NAMESPACE}.WithDefinition`;
    constructor() {
        super(false);
    }

    enter(fw:FileWriter, level:number,templateMarkNode:IWithDefinition) {
        writeDebug(fw, level, templateMarkNode);
        writeOpenDataScope(fw,level,templateMarkNode.name);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    generate(fw:FileWriter, level:number, templateMarkNode:IWithDefinition) {
    }

    exit(fw:FileWriter, level:number) {
        writeCloseDataScope(fw,level);
    }
}