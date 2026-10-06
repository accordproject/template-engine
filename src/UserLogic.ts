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

/**
 * The result of compiling the user-authored logic.ts that ships
 * with a template archive. Used by TemplateArchiveProcessor.draft
 * to expose helper symbols to formula expressions like
 * {{% helperFn(...) %}}.
 */
export type CompiledUserLogic = {
    /** Raw TypeScript source from logic/logic.ts */
    source: string;
    /** Compiled JavaScript (ESM) output */
    compiledJs: string;
    /**
     * Top-level identifiers (functions, classes, const/let/var bindings)
     * declared by logic.ts. Used to populate `declare const X: any`
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
 * Compiles the template's logic/logic.ts to JavaScript, using the same
 * compilation context as TemplateArchiveProcessor.compileLogic (see issue #147).
 * @param {ModelManager} modelManager the template's model manager
 * @param {string} templateConceptFqn the fully qualified name of the template concept
 * @param {string} source the TypeScript source of logic/logic.ts
 * @returns {Promise<CompiledUserLogic>} the compiled user logic
 */
export async function compileUserLogic(
    modelManager: ModelManager,
    templateConceptFqn: string,
    source: string,
): Promise<CompiledUserLogic> {
    const compiler = new TypeScriptToJavaScriptCompiler(modelManager, templateConceptFqn);
    await compiler.initialize();
    const result = compiler.compile(source);
    return toCompiledUserLogic(source, result.code || '');
}

/**
 * Builds a CompiledUserLogic from logic.ts source and its already compiled JavaScript.
 * @param {string} source the TypeScript source of logic/logic.ts
 * @param {string} compiledJs the compiled JavaScript for the source
 * @returns {Promise<CompiledUserLogic>} the compiled user logic
 */
export async function toCompiledUserLogic(source: string, compiledJs: string): Promise<CompiledUserLogic> {
    const prelude = stripModuleSyntax(compiledJs);
    const symbols = await extractTopLevelSymbols(source);
    return { source, compiledJs, symbols, prelude };
}

/**
 * Removes top-level `import` statements and the `export` keyword from
 * JS source so that the remaining declarations can be evaluated inside
 * a function body via `new Function(...)`. The compiled output of
 * logic.ts is an ES module; both `import` and `export` are syntax
 * errors inside a `new Function` body.
 * @param {string} js the JavaScript source
 * @returns {string} the JavaScript without module syntax
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
 * Returns the names of the top-level runtime values (functions, classes and
 * const/let/var bindings) declared by a TypeScript source file. Ambient
 * (`declare`) declarations and type-only declarations are ignored.
 * @param {string} source the TypeScript source
 * @returns {Promise<string[]>} the declared names
 */
export async function extractTopLevelSymbols(source: string): Promise<string[]> {
    const tsImport = await import('typescript');
    const ts = ('default' in tsImport && tsImport.default ? tsImport.default : tsImport);
    const sourceFile = ts.createSourceFile('logic.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const names = new Set<string>();
    for (const statement of sourceFile.statements) {
        const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
        if (modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword)) {
            continue;
        }
        if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
            names.add(statement.name.text);
        }
        else if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name)) {
                    names.add(declaration.name.text);
                }
            }
        }
    }
    return Array.from(names);
}
