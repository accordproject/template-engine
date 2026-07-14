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
import * as ts from 'typescript';

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
    result += '   ' + wrapExpressionWithReturn(code) + '\n';
    result += '}\n';
    result += '\n';

    return result;
}

/**
 * Wraps user-supplied formula/condition code with `return` when the user did
 * not write an explicit `return`, so that an inline expression like
 * `{{% amount / 2.0 %}}` produces a value rather than an undefined result that
 * fails downstream validation.
 *
 * Uses the TypeScript AST to inspect only top-level statements, so a nested
 * function/arrow that contains its own `return` does not confuse the outer
 * detection (e.g. `[1,2,3].map(x => { return x*2 })[0]`).
 */
export function wrapExpressionWithReturn(code: string): string {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }
    const sourceFile = ts.createSourceFile('formula.ts', trimmed, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const statements = sourceFile.statements;
    if (statements.length === 0) {
        return trimmed;
    }
    for (const stmt of statements) {
        if (ts.isReturnStatement(stmt)) {
            return trimmed;
        }
    }
    const last = statements[statements.length - 1];
    if (!ts.isExpressionStatement(last)) {
        return trimmed;
    }
    const prefix = statements
        .slice(0, -1)
        .map(s => s.getText(sourceFile))
        .join('\n');
    const expr = last.expression.getText(sourceFile);
    return prefix.length > 0 ? `${prefix}\nreturn ${expr};` : `return ${expr};`;
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
