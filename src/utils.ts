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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ClassDeclaration, Introspector, ModelManager, Property } from '@accordproject/concerto-core';
import { TemplateMarkModel } from '@accordproject/markdown-common';
import { templatemarkutil } from '@accordproject/markdown-template';

import { existsSync, mkdirSync, rmSync } from 'fs';
import traverse from 'traverse';

export function ensureDirSync(path:string) {
    if(!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

export function removeSync(path:string) {
    rmSync(path, { recursive: true, force: true });
}

export function writeFunctionToString(templateClass:ClassDeclaration, functionName: string, returnType: string, code: string): string {
    let result = '';
    result += '/// ---cut---\n';
    result += `export function ${functionName}(data:TemplateModel.I${templateClass.getName()}, library:any, options:GenerationOptions) : ${returnType} {\n`;
    result += '   const now = dayjs(options?.now);\n';
    result += '   const locale = options?.locale;\n';
    templateClass.getProperties().forEach((p: Property) => {
        result += `   const ${p.getName()} = data.${p.getName()};\n`;
    });
    result += '   ' + code.trim() + '\n';
    result += '}\n';
    result += '\n';

    return result;
}

export function nameUserCode(templateMarkDom: any) {
    return traverse(templateMarkDom).map(function (x) {
        if (x && ((x.$class === `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition` && x.condition) ||
            (x.$class === `${TemplateMarkModel.NAMESPACE}.ClauseDefinition` && x.condition))) {
            x.functionName = `condition_${this.path.join('_')}`;
        }
        this.update(x);
    });
}

export function getTemplateClassDeclaration(modelManager: ModelManager, templateConceptFqn?: string) : ClassDeclaration {
    const introspector = new Introspector(modelManager);
    try {
        return templatemarkutil.findTemplateConcept(introspector, 'clause', templateConceptFqn);
    }
    catch(err) {
        console.log(err);
        throw err;
    }
}
