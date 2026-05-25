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

import { ModelManager } from '@accordproject/concerto-core';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
import { SMART_LEGAL_CONTRACT_BASE64 } from './runtime/declarations';

/**
 * The result of compiling the user-authored logic.ts that ships
 * with a template archive. Used by both
 * TemplateArchiveProcessor.trigger/init (to execute the logic class)
 * and TemplateArchiveProcessor.draft (to expose helper symbols to
 * formula expressions like {{% helperFn(...) %}}).
 */
export type CompiledUserLogic = {
    /** Raw TypeScript source from logic/logic.ts */
    source: string;
    /** Compiled JavaScript (ESM) output */
    compiledJs: string;
    /**
     * Top-level identifiers (functions, classes, const/let/var bindings)
     * declared by the compiled JS. Used to populate `declare const X: any`
     * stubs when compiling inline formulas, so user helper functions
     * type-check.
     */
    symbols: string[];
    /**
     * `compiledJs` with `import`/`export` statements stripped so it can be
     * spliced into a formula function body as a runtime prelude.
     */
    prelude: string;
};

/**
 * Compiles the template's logic/logic.ts to JavaScript. Mirrors what
 * TemplateArchiveProcessor.trigger() has always done, but as a shared
 * helper so draft() can also load logic helpers (see issue #147).
 */
export async function compileUserLogic(
    modelManager: ModelManager,
    templateConceptFqn: string,
    source: string,
): Promise<CompiledUserLogic> {
    const compiler = new TypeScriptToJavaScriptCompiler(modelManager, templateConceptFqn);
    await compiler.initialize();
    const code = `${Buffer.from(SMART_LEGAL_CONTRACT_BASE64, 'base64').toString()}
${source}`;
    const result = compiler.compile(code);
    const compiledJs = result.code || '';
    const prelude = stripModuleSyntax(compiledJs);
    const symbols = extractTopLevelSymbols(prelude);
    return { source, compiledJs, symbols, prelude };
}

/**
 * Removes top-level `import` statements and the `export` keyword from
 * JS source so that the remaining declarations can be evaluated inside
 * a function body via `new Function(...)`. The compiled output of
 * logic.ts is an ES module; both `import` and `export` are syntax
 * errors inside a `new Function` body.
 */
export function stripModuleSyntax(js: string): string {
    let result = js;
    // Drop import statements (single or multi-line).
    result = result.replace(/^[ \t]*import[\s\S]*?(?:;|\n)/gm, '');
    // Drop `export default <expr>;` lines entirely.
    result = result.replace(/^[ \t]*export\s+default\s+[^;\n]*;?\s*$/gm, '');
    // Strip a leading `export ` keyword from declarations
    // (`export function`, `export class`, `export const`, ...).
    result = result.replace(/^[ \t]*export\s+(?=(?:async\s+)?(?:abstract\s+)?(?:function|class|const|let|var|interface|type|enum)\b)/gm, '');
    return result;
}

/**
 * Extracts top-level identifier names declared in the JS source.
 * Heuristic, regex-based — good enough for the common case of helper
 * functions and constants in a template's logic.ts.
 */
export function extractTopLevelSymbols(js: string): string[] {
    const names = new Set<string>();
    const patterns = [
        /^\s*(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
        /^\s*(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
        /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    ];
    for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(js)) !== null) {
            names.add(m[1]);
        }
    }
    return Array.from(names);
}
