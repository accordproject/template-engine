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
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import webpack from 'webpack';

// Everything is served from one fake origin, so the app, its lazy SDK chunk
// and the mocked chat-completions endpoint are all same-origin.
const ORIGIN = 'https://sdk-loader-app.test';
const ENTRY = path.resolve(__dirname, '../fixtures/sdk-loader-app.js');

let outDir: string;

/**
 * Bundles the fixture app the way a consumer's bundler would, failing on any
 * module that cannot be resolved.
 * @returns the output directory
 */
async function bundleApp(): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-loader-app-'));
    const compiler = webpack({
        mode: 'production',
        target: 'web',
        entry: ENTRY,
        devtool: false,
        output: { path: dir, filename: 'app.js', publicPath: `${ORIGIN}/`, clean: true },
        resolve: { mainFields: ['browser', 'module', 'main'] },
        performance: { hints: false },
    });
    const stats = await new Promise<webpack.Stats>((resolve, reject) => {
        compiler.run((err, result) => (err || !result ? reject(err) : resolve(result)));
    });
    await new Promise<void>((resolve) => compiler.close(() => resolve()));
    if (stats.hasErrors()) {
        throw new Error(stats.toString({ all: false, errors: true }));
    }
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><script src="app.js"></script>');
    return dir;
}

/**
 * Serves the bundle and a mocked chat-completions endpoint, then opens the app.
 * @param page - the Playwright page
 * @returns the bodies of the chat-completions requests the app made
 */
async function openApp(page: Page): Promise<unknown[]> {
    const requests: unknown[] = [];
    await page.route(`${ORIGIN}/v1/chat/completions`, async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Hello from the mock' } }] }),
        });
    });
    await page.route(`${ORIGIN}/*.js`, (route) =>
        route.fulfill({ path: path.join(outDir, new URL(route.request().url()).pathname) }));
    await page.route(`${ORIGIN}/`, (route) => route.fulfill({ path: path.join(outDir, 'index.html') }));
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => typeof (window as any).runReasoner === 'function');
    return requests;
}

test.describe('injected SDK loaders in a bundled browser app', () => {
    test.beforeAll(async () => {
        outDir = await bundleApp();
    });

    test.afterAll(() => {
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    test('the bundler splits the SDK into its own lazy chunk', () => {
        const chunks = fs.readdirSync(outDir).filter((f) => f.endsWith('.js') && f !== 'app.js');
        expect(chunks.length).toBeGreaterThan(0);
        expect(fs.readFileSync(path.join(outDir, 'app.js'), 'utf8')).not.toContain('dangerouslyAllowBrowser');
    });

    test('loads the SDK through the injected loader and completes a request', async ({ page }) => {
        const requests = await openApp(page);
        const result = await page.evaluate(() => (window as any).runReasoner({ dangerouslyAllowBrowser: true }));
        expect(result).toEqual({ content: 'Hello from the mock' });
        expect(requests).toEqual([expect.objectContaining({ model: 'test-model' })]);
    });

    test('the OpenAI SDK still refuses to run in the browser without dangerouslyAllowBrowser', async ({ page }) => {
        const requests = await openApp(page);
        const result = await page.evaluate(() => (window as any).runReasoner(undefined));
        expect(result.error).toContain('dangerouslyAllowBrowser');
        expect(requests).toEqual([]);
    });
});
