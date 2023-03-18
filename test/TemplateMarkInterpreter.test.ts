import { ModelManager } from '@accordproject/concerto-core';
import { CommonMarkModel } from '@accordproject/markdown-common';
import { readFileSync } from 'fs-extra';
import { TemplateMarkInterpreter } from '../src';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import dayjs from 'dayjs';

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

describe('templatemark interpreter', () => {
    test('should create agreementmark from a template and data', async () => {

        /**
         * Define the data model for the template. The model must have a concept with
         * the @template decorator. The types of properties allow the template to be
         * type-checked.
        */
        const model = readFileSync('./test/templates/full/model.cto', 'utf-8');

        /**
         * Load the template, rich-text with variables, conditional sections etc
         */
        const template = readFileSync('./test/templates/full/template.md', 'utf-8');

        /**
         * Define the data we will merge with the template - an instance of the template model
         */
        const data = {
            $class: 'test@1.0.0.TemplateData',
            firstName: 'Dan',
            lastName: 'Selman',
            middleNames: ['Tenzin', 'Isaac', 'Mia'],
            active: false,
            lastVisit: '2023-01-10',
            address: {
                $class: 'test@1.0.0.Address',
                street: '1 Main Street',
                city: 'Boston',
                zip: '12345'
            },
            orders: [
                {
                    $class: 'test@1.0.0.Order',
                    sku: 'WIDGET-2000',
                    amount: 10
                },
                {
                    $class: 'test@1.0.0.Order',
                    sku: 'DOODAH-X',
                    amount: 3
                }
            ],
            // loyaltyStatus: {
            //     $class: 'test@1.0.0.LoyaltyStatus',
            //     level: 'Gold'
            // },
            preferences: {
                $class: 'test@1.0.0.Preferences',
                favoriteColors: ['RED', 'PINK']
            }
        };
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(model);
        const engine = new TemplateMarkInterpreter(modelManager, CLAUSE_LIBRARY);

        const templateMarkTransformer = new TemplateMarkTransformer();

        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
        // console.log(JSON.stringify(templateMarkDom, null, 2));

        const now = dayjs('2023-03-17T00:00:00.000Z');
        const ciceroMark = await engine.generate(templateMarkDom, data, now);
        expect(ciceroMark.getFullyQualifiedType()).toBe(`${CommonMarkModel.NAMESPACE}.Document`);
        expect(ciceroMark.toJSON()).toMatchSnapshot();
    });
});
