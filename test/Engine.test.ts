import { ModelManager } from '@accordproject/concerto-core';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { HtmlTransformer } from '@accordproject/markdown-html';
import { CommonMarkModel } from '@accordproject/markdown-common';

import { readFileSync, writeFileSync } from 'fs';
import { Engine } from '../src/';

test('should generate an agreement with variables, conditionals, formulae', async () => {

    /**
     * Define the data model for the template. The model must have a concept with
     * the @template decorator. The types of properties allow the template to be
     * type-checked.
    */
    const model = readFileSync('./test/model.cto', 'utf-8');

    /**
     * Load the template, rich-text with variables, conditional sections etc
     */
    const template = readFileSync('./test/template.md', 'utf-8');

    /**
     * Define the data we will merge with the template - an instance of the template model
     */
    const data = {
        $class: 'test@1.0.0.TemplateData',
        firstName: 'Dan',
        lastName: 'Selman',
        middleNames: ['Tenzin', 'Isaac', 'Mia'],
        active: true,
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
    const engine = new Engine(modelManager);

    const templateMarkTransformer = new TemplateMarkTransformer();

    const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({content: template}, modelManager, 'contract', { verbose: false });
    console.log(JSON.stringify(templateMarkDom, null, 2));

    const ciceroMark = engine.generate(templateMarkDom, data);
    console.log(JSON.stringify(ciceroMark, null, 2));
    expect(ciceroMark.getFullyQualifiedType()).toBe(`${CommonMarkModel.NAMESPACE}.Document`);
    const htmlTransformer = new HtmlTransformer();
    try {
        const html = htmlTransformer.toHtml(ciceroMark);
        writeFileSync('./output.html', html);
    }
    catch(err) {
        console.log(err);
    }
});