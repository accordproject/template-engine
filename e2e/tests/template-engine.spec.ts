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

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const BUNDLE = path.resolve(__dirname, '../../umd/template-engine.js');

/**
 * Loads about:blank and injects the UMD bundle, then waits for the global.
 * @param page - the Playwright page
 */
async function inject(page: Page): Promise<void> {
    await page.goto('about:blank');
    await page.addScriptTag({ path: BUNDLE });
    await page.waitForFunction(() => typeof (window as any)['template-engine'] !== 'undefined');
}

test.describe('@accordproject/template-engine UMD', () => {
    test('exposes the public API on the global', async ({ page }) => {
        await inject(page);
        const api = await page.evaluate(() => {
            const m = (window as any)['template-engine'];
            return {
                interpreter: typeof m.TemplateMarkInterpreter,
                processor: typeof m.TemplateArchiveProcessor,
                modelManager: typeof m.ModelManager,
                transformer: typeof m.TemplateMarkTransformer,
            };
        });
        expect(api.interpreter).toBe('function');
        expect(api.processor).toBe('function');
        expect(api.modelManager).toBe('function');
        expect(api.transformer).toBe('function');
    });

    // Parsing a template to TemplateMark and type-checking it are fully browser-safe
    // (concerto + markdown-template + the interpreter's type/guard checks). A full
    // generate() additionally compiles the template's TypeScript logic, which today uses
    // the twoslash compiler and does not run in the browser bundle yet — that is tracked
    // as a follow-up (unify the twoslash/webpack TS->JS compilers).
    test('parses and type-checks a template in the browser', async ({ page }) => {
        await inject(page);
        const json = await page.evaluate(() => {
            const { ModelManager, TemplateMarkTransformer, TemplateMarkInterpreter } =
                (window as any)['template-engine'];
            const MODEL = 'namespace test@1.0.0\n@template\nconcept TemplateData {\n  o String name\n}';
            const mm = new ModelManager();
            mm.addCTOModel(MODEL, undefined, true);
            const tmt = new TemplateMarkTransformer();
            const templateMark = tmt.fromMarkdownTemplate(
                { content: 'Hello {{name}}!' }, mm, 'contract', { verbose: false });
            const engine = new TemplateMarkInterpreter(mm, {});
            const checked = engine.checkTypes(templateMark);
            return JSON.stringify(checked);
        });
        // the {{name}} variable definition resolves to the String 'name' property
        expect(json).toContain('VariableDefinition');
        expect(json).toContain('"name":"name"');
        expect(json).toContain('"elementType":"String"');
    });
});
