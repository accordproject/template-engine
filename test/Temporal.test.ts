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
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { readFileSync } from 'fs';
import { TemplateMarkInterpreter } from '../src';
import { GenerationOptions } from '../src/TypeScriptRuntime';

const FIXTURE = './test/templates/good/formula-temporal';

/**
 * Drafts a template against the formula-temporal model and data, and returns the
 * values of its formulas, in document order.
 * @param {string} template - the template text
 * @param {GenerationOptions} options - the generation options
 * @returns {Promise<string[]>} the formula values
 */
async function draftFormulas(template: string, options: GenerationOptions): Promise<string[]> {
    const model = readFileSync(`${FIXTURE}/model.cto`, 'utf-8');
    const data = JSON.parse(readFileSync(`${FIXTURE}/data.json`, 'utf-8'));
    return draftFormulasWith(model, data, template, options);
}

/**
 * Drafts a template against a model and data, and returns the values of its formulas,
 * in document order.
 * @param {string} model - the template model
 * @param {Record<string, unknown>} data - the template data
 * @param {string} template - the template text
 * @param {GenerationOptions} options - the generation options
 * @returns {Promise<string[]>} the formula values
 */
async function draftFormulasWith(model: string, data: Record<string, unknown>, template: string, options: GenerationOptions): Promise<string[]> {
    const modelManager = new ModelManager();
    modelManager.addCTOModel(model);
    const templateMarkDom = new TemplateMarkTransformer().fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
    const ciceroMark = await new TemplateMarkInterpreter(modelManager, {}).generate(templateMarkDom, data, options);
    const values: string[] = [];
    JSON.stringify(ciceroMark.toJSON(), (key, value) => {
        if (value && typeof value === 'object' && typeof value.$class === 'string' && value.$class.endsWith('.Formula')) {
            values.push(value.value);
        }
        return value;
    });
    return values;
}

describe('Temporal in formulas', () => {
    jest.setTimeout(30000);

    [false, true].forEach(childProcessJavaScriptEvaluation => {
        const mode = childProcessJavaScriptEvaluation ? 'in a child process' : 'in process';

        test(`temporalNow is the same instant as now, for a now without a UTC offset (${mode})`, async () => {
            // dayjs reads a date-time without an offset as local time; Temporal.Instant.from
            // would reject it, so temporalNow must follow now rather than parse options.now itself
            const values = await draftFormulas('{{% return temporalNow.epochMilliseconds === now.valueOf() %}}', {
                now: '2023-03-17T09:30:00',
                childProcessJavaScriptEvaluation,
            });
            expect(values).toEqual(['true']);
        });

        test(`formulas can construct Temporal values (${mode})`, async () => {
            const values = await draftFormulas(
                '{{% return Temporal.PlainDate.from(\'2024-02-28\').add({ days: 2 }).toString() %}} {{% return Temporal.Duration.from({ hours: 36 }).total(\'days\') %}}',
                { now: '2023-03-17T00:00:00.000Z', childProcessJavaScriptEvaluation }
            );
            expect(values).toEqual(['"2024-03-01"', '1.5']);
        });

        // these names are bound for formulas, but a template property of the same name
        // takes precedence, as it did before Temporal and temporalNow were added
        ['Temporal', 'temporalNow', 'jp'].forEach(name => {
            test(`a template property called ${name} takes precedence (${mode})`, async () => {
                const model = `namespace test@1.0.0\n@template\nconcept TemplateData {\n    o String ${name}\n}`;
                const data = { $class: 'test@1.0.0.TemplateData', [name]: 'from the data' };
                const values = await draftFormulasWith(model, data, `{{% return ${name}.toUpperCase() %}} {{% return now.toISOString() %}}`, {
                    now: '2023-03-17T00:00:00.000Z',
                    childProcessJavaScriptEvaluation,
                });
                expect(values).toEqual(['"FROM THE DATA"', '"2023-03-17T00:00:00.000Z"']);
            });
        });
    });

    test('an invalid now does not break formulas that do not use temporalNow', async () => {
        // existing behaviour: dayjs makes an invalid date, which the template prints
        const values = await draftFormulas('{{% return now.isValid() %}}', { now: 'not a date' });
        expect(values).toEqual(['false']);
    });

    test('temporalNow rejects an invalid now', async () => {
        await expect(draftFormulas('{{% return temporalNow.toString() %}}', { now: 'not a date' })).rejects.toThrow(/RangeError/);
    });

    test('temporalNow defaults to the current time when now is not set', async () => {
        const before = Date.now();
        const [value] = await draftFormulas('{{% return temporalNow.epochMilliseconds %}}', {});
        const after = Date.now();
        expect(Number(value)).toBeGreaterThanOrEqual(before);
        expect(Number(value)).toBeLessThanOrEqual(after);
    });
});

describe('Temporal implementation', () => {
    const runtimeTemporal = (globalThis as { Temporal?: unknown }).Temporal;
    afterEach(() => {
        if (runtimeTemporal === undefined) {
            delete (globalThis as { Temporal?: unknown }).Temporal;
        } else {
            (globalThis as { Temporal?: unknown }).Temporal = runtimeTemporal;
        }
    });

    test('uses the polyfill when the runtime has no Temporal', () => {
        delete (globalThis as { Temporal?: unknown }).Temporal;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { Temporal } = require('../src/temporal');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            expect(Temporal).toBe(require('@js-temporal/polyfill').Temporal);
        });
    });

    test('uses the runtime Temporal when there is one', () => {
        const native = { Instant: {} };
        (globalThis as { Temporal?: unknown }).Temporal = native;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { Temporal } = require('../src/temporal');
            expect(Temporal).toBe(native);
        });
    });
});
