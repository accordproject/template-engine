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
    result += '   ' + wrapExpressionWithReturn(code) + '\n';
    result += '}\n';
    result += '\n';

    return result;
}

const RETURN_KEYWORD_RE = /\breturn\b/;

/**
 * Linear, ReDoS-safe pass that drops string literals, line comments, and block
 * comments from JS/TS source. Used to scan for the `return` keyword without
 * false positives from quoted/commented occurrences.
 */
function stripStringsAndComments(s: string): string {
    let out = '';
    const n = s.length;
    let i = 0;
    while (i < n) {
        const c = s[i];
        const next = i + 1 < n ? s[i + 1] : '';
        if (c === '/' && next === '/') {
            i += 2;
            while (i < n && s[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && next === '*') {
            i += 2;
            while (i < n - 1 && !(s[i] === '*' && s[i + 1] === '/')) i++;
            i = Math.min(n, i + 2);
            continue;
        }
        if (c === '\'' || c === '"' || c === '`') {
            const quote = c;
            i++;
            while (i < n && s[i] !== quote) {
                if (s[i] === '\\' && i + 1 < n) {
                    i += 2;
                } else {
                    i++;
                }
            }
            i++;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/**
 * Wraps user-supplied formula/condition code with `return` when the user did
 * not write an explicit `return`, so that an inline expression like
 * `{{% amount / 2.0 %}}` produces a value rather than an undefined result that
 * fails downstream validation.
 */
function wrapExpressionWithReturn(code: string): string {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
        return trimmed;
    }
    if (RETURN_KEYWORD_RE.test(stripStringsAndComments(trimmed))) {
        return trimmed;
    }
    return `return ${trimmed.replace(/;\s*$/, '')};`;
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
