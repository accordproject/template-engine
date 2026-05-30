import { ModelManager } from '@accordproject/concerto-core';
import { CommonMarkModel } from '@accordproject/markdown-common';
import { TemplateMarkInterpreter } from '../src';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import { loadOfflineExternalModels } from './support/externalModels';

const CLAUSE_LIBRARY = {
    'clauses': [
        {
            'category': 'reference',
            'author': 'Dan',
            'body': 'Dad jokes',
            'risk': 8.95
        },
        {
            'category': 'reference',
            'author': 'Dan',
            'body': 'Programming for fun and profit',
            'risk': 1.95
        },
        {
            'category': 'onboarding',
            'author': 'Peter',
            'body': 'Legal stuff',
            'risk': 2.95
        },
        {
            'category': 'offboarding',
            'author': 'Matt',
            'body': 'All goodness',
            'risk': 4.95
        }
    ]
};

const GOOD_TEMPLATES_ROOT = './test/templates/good';
const BAD_TEMPLATES_ROOT = './test/templates/bad';

describe('templatemark interpreter', () => {
    jest.setTimeout(30000);
    const goodTemplates: Array<{ name: string, content: string }> = readdirSync(GOOD_TEMPLATES_ROOT).map(dir => {
        return {
            name: dir,
            content: readFileSync(path.join(GOOD_TEMPLATES_ROOT, dir, 'template.md'), 'utf-8')
        };
    });

    goodTemplates.forEach(function (template) {
        if(template.name === 'foreach') return; // currently broken!!

        test(`should generate ${template.name}`, async () => {
            const templateName = path.parse(template.name).name;

            /**
             * Define the data model for the template. The model must have a concept with
             * the @template decorator. The types of properties allow the template to be
             * type-checked.
            */
            const model = readFileSync(`${GOOD_TEMPLATES_ROOT}/${templateName}/model.cto`, 'utf-8');

            /**
             * Load the template, rich-text with variables, conditional sections etc
             */
            const templateMarkup = readFileSync(`${GOOD_TEMPLATES_ROOT}/${templateName}/template.md`, 'utf-8');

            /**
             * Define the data we will merge with the template - an instance of the template model
             */
            const data = JSON.parse(readFileSync(`${GOOD_TEMPLATES_ROOT}/${templateName}/data.json`, 'utf-8'));

            const modelManager = new ModelManager();
            loadOfflineExternalModels(modelManager);
            modelManager.addCTOModel(model, undefined, true);
            const engine = new TemplateMarkInterpreter(modelManager, CLAUSE_LIBRARY);

            const templateMarkTransformer = new TemplateMarkTransformer();

            const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: templateMarkup }, modelManager, 'contract', { verbose: false });
            // console.log(JSON.stringify(templateMarkDom, null, 2));

            // execute without sandbox
            const now = '2023-03-17T00:00:00.000Z';
            const ciceroMark = await engine.generate(templateMarkDom, data, {now, locale: 'en'});
            expect(ciceroMark.getFullyQualifiedType()).toBe(`${CommonMarkModel.NAMESPACE}.Document`);
            expect(ciceroMark.toJSON()).toMatchSnapshot();

            // check we get the same result when we execute with sandbox
            const ciceroMarkSandbox = await engine.generate(templateMarkDom, data, {now, locale: 'en', childProcessJavaScriptEvaluation: true});
            expect(ciceroMarkSandbox.toJSON()).toStrictEqual(ciceroMark.toJSON());
        });
    });

    const badTemplates: Array<{ name: string, content: string }> = readdirSync(BAD_TEMPLATES_ROOT).map(dir => {
        return {
            name: dir,
            content: readFileSync(path.join(BAD_TEMPLATES_ROOT, dir, 'template.md'), 'utf-8')
        };
    });

    badTemplates.forEach(function (template) {
        test(`should fail to generate ${template.name}`, async () => {
            const templateName = path.parse(template.name).name;
            const model = readFileSync(`${BAD_TEMPLATES_ROOT}/${templateName}/model.cto`, 'utf-8');
            const templateMarkup = readFileSync(`${BAD_TEMPLATES_ROOT}/${templateName}/template.md`, 'utf-8');
            const data = JSON.parse(readFileSync(`${BAD_TEMPLATES_ROOT}/${templateName}/data.json`, 'utf-8'));
            const modelManager = new ModelManager();
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, CLAUSE_LIBRARY);

            const f = async () => {
                const templateMarkTransformer = new TemplateMarkTransformer();
                const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: templateMarkup }, modelManager, 'contract', { verbose: false });
                const now = '2023-03-17T00:00:00.000Z';
                return engine.generate(templateMarkDom, data, {now});
            };
            await expect(f()).rejects.toMatchSnapshot();
        });
    });

    // Regression for https://github.com/accordproject/template-engine/issues/145.
    // When a {{#ulist}} / {{#olist}} body contains direct variable references with no
    // leading list marker, the markdown parser produces a Paragraph (not a List/Item
    // wrapping) under the ListBlockDefinition. The recursion must still descend into the
    // per-iteration template and resolve those variables against each array element.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    describe('issue #145: direct variable references inside ulist/olist', () => {
        const MODEL = `namespace volumediscount@1.0.0
concept VolumeDiscount {
    o Double volumeAbove
    o Double rate
}
@template
concept TemplateData {
    o VolumeDiscount[] volumeDiscounts
}`;
        const DATA = {
            $class: 'volumediscount@1.0.0.TemplateData',
            volumeDiscounts: [
                { $class: 'volumediscount@1.0.0.VolumeDiscount', volumeAbove: 100, rate: 5 },
                { $class: 'volumediscount@1.0.0.VolumeDiscount', volumeAbove: 500, rate: 10 },
            ]
        };

        async function renderList(content: string): Promise<any> {
            const modelManager = new ModelManager();
            modelManager.addCTOModel(MODEL);
            const engine = new TemplateMarkInterpreter(modelManager, {});
            const templateMarkTransformer = new TemplateMarkTransformer();
            const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
                { content }, modelManager, 'clause', { verbose: false });
            const ciceroMark = await engine.generate(templateMarkDom, DATA, { now: '2023-03-17T00:00:00.000Z' });
            const json: any = ciceroMark.toJSON();
            const found: any[] = [];
            (function walk(n: any) {
                if (!n) return;
                if (n.$class === `${CommonMarkModel.NAMESPACE}.List`) found.push(n);
                if (Array.isArray(n.nodes)) n.nodes.forEach(walk);
            })(json);
            return found[0];
        }

        // Asserts the rendered List has one Item per array element, each containing the
        // variable's drafted value. Both ulist and olist hit the same code path.
        async function expectVariablesResolved(content: string, listType: 'bullet' | 'ordered') {
            const list = await renderList(content);
            expect(list).toBeDefined();
            expect(list.type).toBe(listType);
            expect(list.nodes).toHaveLength(2);
            const collectVariables = (item: any): Array<{ name: string, value: string }> => {
                const out: Array<{ name: string, value: string }> = [];
                (function walk(n: any) {
                    if (!n) return;
                    if (n.$class === 'org.accordproject.ciceromark@0.6.0.Variable') {
                        out.push({ name: n.name, value: n.value });
                    }
                    if (Array.isArray(n.nodes)) n.nodes.forEach(walk);
                })(item);
                return out;
            };
            expect(collectVariables(list.nodes[0])).toEqual([
                { name: 'volumeAbove', value: '100.0' },
                { name: 'rate', value: '5.0' },
            ]);
            expect(collectVariables(list.nodes[1])).toEqual([
                { name: 'volumeAbove', value: '500.0' },
                { name: 'rate', value: '10.0' },
            ]);
        }

        // Failure mode A: a VariableDefinition is the very first inline node, which
        // triggered `getJsonPath` to throw `Paths must be supplied`.
        test('ulist body starting with a variable does not throw and resolves values', async () => {
            await expectVariablesResolved(
                '{{#ulist volumeDiscounts}}\n{{volumeAbove}} units at {{rate}}%\n{{/ulist}}\n',
                'bullet'
            );
        });

        test('olist body starting with a variable does not throw and resolves values', async () => {
            await expectVariablesResolved(
                '{{#olist volumeDiscounts}}\n{{volumeAbove}} units at {{rate}}%\n{{/olist}}\n',
                'ordered'
            );
        });

        // Failure mode B: leading text means no throw, but Items were silently empty.
        test('ulist body with leading text yields populated items', async () => {
            await expectVariablesResolved(
                '{{#ulist volumeDiscounts}}\nAbove {{volumeAbove}} units: {{rate}}% off\n{{/ulist}}\n',
                'bullet'
            );
        });
    });
});
