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

/**
 * Records the TypeScript lib.*.d.ts requests the page makes to the TypeScript CDN.
 * @param page - the Playwright page
 * @returns the requested URLs, updated as requests are made
 */
function trackLibRequests(page: Page): string[] {
    const urls: string[] = [];
    page.on('request', request => {
        if (request.url().includes('playgroundcdn.typescriptlang.org')) {
            urls.push(request.url());
        }
    });
    return urls;
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

    // Browser flow for a template without code: parse -> type-check -> generate. There is
    // nothing to compile, so the TypeScript lib files must not be loaded.
    test('generates an agreement in the browser', async ({ page }) => {
        const libRequests = trackLibRequests(page);
        await inject(page);
        const json = await page.evaluate(async () => {
            const { ModelManager, TemplateMarkTransformer, TemplateMarkInterpreter } =
                (window as any)['template-engine'];
            const MODEL = 'namespace test@1.0.0\n@template\nconcept TemplateData {\n  o String name\n}';
            const mm = new ModelManager();
            mm.addCTOModel(MODEL, undefined, true);
            const tmt = new TemplateMarkTransformer();
            const templateMark = tmt.fromMarkdownTemplate(
                { content: 'Hello {{name}}!' }, mm, 'contract', { verbose: false });
            const engine = new TemplateMarkInterpreter(mm, {});
            const result = await engine.generate(
                templateMark,
                { $class: 'test@1.0.0.TemplateData', name: 'World' },
                { now: '2023-03-17T00:00:00.000Z' });
            return JSON.stringify(result.toJSON());
        });
        expect(json).toContain('Hello ');
        expect(json).toContain('World');
        expect(libRequests).toEqual([]);
    });

    // Full browser flow: parse -> type-check -> compile the template's TypeScript logic to
    // JS (twoslash, using the bundled TypeScript) -> evaluate, all in headless Chromium.
    test('compiles template formulas in the browser, loading the lib files once', async ({ page }) => {
        const libRequests = trackLibRequests(page);
        await inject(page);
        const results = await page.evaluate(async () => {
            const { ModelManager, TemplateMarkTransformer, TemplateMarkInterpreter } =
                (window as any)['template-engine'];
            const MODEL = 'namespace test@1.0.0\n@template\nconcept TemplateData {\n  o String name\n}';
            const mm = new ModelManager();
            mm.addCTOModel(MODEL, undefined, true);
            const tmt = new TemplateMarkTransformer();
            const templateMark = tmt.fromMarkdownTemplate(
                { content: 'Hello {{name}}! Your name is {{% return name.length %}} characters long.' },
                mm, 'contract', { verbose: false });
            const data = { $class: 'test@1.0.0.TemplateData', name: 'World' };
            const options = { now: '2023-03-17T00:00:00.000Z' };
            const engine = new TemplateMarkInterpreter(mm, {});
            const first = await engine.generate(templateMark, data, options);
            const second = await engine.generate(templateMark, data, options);
            // template-playground creates a new interpreter on every render
            const third = await new TemplateMarkInterpreter(mm, {}).generate(templateMark, data, options);
            return [first, second, third].map(result => JSON.stringify(result.toJSON()));
        });
        expect(results[0]).toContain('"value":"5"');
        expect(results[1]).toBe(results[0]);
        expect(results[2]).toBe(results[0]);
        // each lib file is requested once, not once per generate()
        expect(libRequests.length).toBeGreaterThan(0);
        expect(new Set(libRequests).size).toBe(libRequests.length);
    });
});
