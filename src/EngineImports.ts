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

import { SMART_LEGAL_CONTRACT_SOURCE } from './runtime/smartLegalContract';

/** The module specifier template logic uses to import the runtime declarations. */
export const ENGINE_MODULE = '@accordproject/template-engine';

/**
 * The names declared by src/slc/SmartLegalContract.ts. The compilation context
 * declares each of them locally (bound to the template's model), so these are the
 * names template logic may import from the engine package.
 * @returns {Set<string>} the declared names
 */
export function getRuntimeDeclarationNames(): Set<string> {
    const names = new Set<string>();
    const pattern = /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type)\s+(\w+)/gm;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(SMART_LEGAL_CONTRACT_SOURCE)) !== null) {
        names.add(match[1]);
    }
    return names;
}

/**
 * Replaces the given range of text with spaces, keeping its line breaks, so that
 * line and column numbers of the rest of the source (and of diagnostics) do not move.
 * @param {string} text the text to blank out
 * @returns {string} the blanked text
 */
function blank(text: string): string {
    return text.replace(/[^\r\n]/g, ' ');
}

/**
 * Removes `import ... from '@accordproject/template-engine'` declarations from
 * template logic before it is compiled.
 *
 * Template logic is compiled against a context that already declares `TemplateLogic`,
 * `TriggerResponse` and the other runtime types, bound to the template's model, and
 * the emitted JavaScript is evaluated as a standalone module that cannot resolve
 * packages. Left in place, such an import would conflict with the local declarations
 * at compile time and fail to resolve at runtime. Because every importable name is
 * declared under the same name in the context, the import can be dropped.
 *
 * Only named imports without a rename are supported, and only of names that
 * src/slc/SmartLegalContract.ts declares; anything else throws, rather than compiling
 * to code that fails later.
 * @param {any} ts the typescript module
 * @param {string} source the TypeScript source of the template logic
 * @param {string} [fileName] the name of the file, used in error messages
 * @returns {string} the source with the engine imports removed
 * @throws {Error} for a default, namespace or renamed import of the engine, or an
 * imported name the engine does not provide to template logic
 */
export function removeEngineImports(ts: any, source: string, fileName = 'logic.ts'): string {
    if (!source.includes(ENGINE_MODULE)) {
        return source;
    }
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const available = getRuntimeDeclarationNames();
    const ranges: Array<{ start: number, end: number }> = [];

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            statement.moduleSpecifier.text !== ENGINE_MODULE) {
            continue;
        }
        const clause = statement.importClause;
        const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
        const where = `${fileName}:${line}`;
        if (clause) {
            if (clause.name) {
                throw new Error(`${where}: a default import of '${ENGINE_MODULE}' is not supported in template logic; use a named import, such as import { TemplateLogic } from '${ENGINE_MODULE}'.`);
            }
            const bindings = clause.namedBindings;
            if (bindings && ts.isNamespaceImport(bindings)) {
                throw new Error(`${where}: a namespace import of '${ENGINE_MODULE}' is not supported in template logic; use a named import, such as import { TemplateLogic } from '${ENGINE_MODULE}'.`);
            }
            for (const element of bindings?.elements ?? []) {
                const imported = (element.propertyName ?? element.name).text;
                if (element.propertyName && element.propertyName.text !== element.name.text) {
                    throw new Error(`${where}: renaming '${imported}' on import from '${ENGINE_MODULE}' is not supported in template logic; import it as '${imported}'.`);
                }
                if (!available.has(imported)) {
                    throw new Error(`${where}: '${imported}' is not available to template logic from '${ENGINE_MODULE}'. Template logic can import: ${Array.from(available).sort().join(', ')}.`);
                }
            }
        }
        ranges.push({ start: statement.getStart(sourceFile), end: statement.getEnd() });
    }

    let result = source;
    // replace from the end so earlier offsets stay valid
    for (const { start, end } of ranges.reverse()) {
        result = result.slice(0, start) + blank(result.slice(start, end)) + result.slice(end);
    }
    return result;
}
