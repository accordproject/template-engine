import { ModelManager } from '@accordproject/concerto-core';
import { CommonMarkModel } from '@accordproject/markdown-common';
import { TemplateMarkInterpreter } from '../src';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';

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

            const modelManager = new ModelManager({ strict: true });
            modelManager.addCTOModel(model, undefined, true);
            await modelManager.updateExternalModels();
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
            const templatenName = path.parse(template.name).name;
            const model = readFileSync(`${BAD_TEMPLATES_ROOT}/${templatenName}/model.cto`, 'utf-8');
            const templateMarkup = readFileSync(`${BAD_TEMPLATES_ROOT}/${templatenName}/template.md`, 'utf-8');
            const data = JSON.parse(readFileSync(`${BAD_TEMPLATES_ROOT}/${templatenName}/data.json`, 'utf-8'));
            const modelManager = new ModelManager({ strict: true });
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
});
