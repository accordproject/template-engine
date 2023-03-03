import { ModelManager } from '@accordproject/concerto-core';
import { readFileSync } from 'fs';
import { Engine } from '../src/';

/**
 * Define the data model for the template. The model must have a concept with
 * the @template decorator. The types of properties allow the template to be
 * type-checked.
 */
const model = readFileSync('./test/model.cto', 'utf-8');

/**
 * Define the structure of the template using a TemplateMark JSON DOM.
 */
const oldTemplateMark = JSON.parse(readFileSync('./test/template.json', 'utf-8'));

test('should generate an agreement with variables, conditionals, formulae', async () => {
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
        loyaltyStatus: {
            $class: 'test@1.0.0.LoyaltyStatus',
            level: 'Gold'
        },
        favoriteColors: ['RED', 'PINK']
    };
    const modelManager = new ModelManager();
    modelManager.addCTOModel(model);
    const engine = new Engine(modelManager);

    const templateMark = engine.migrate(oldTemplateMark);
    const agreementMark = engine.generate(templateMark, data);
    expect(agreementMark.$class).toBe('org.accordproject.commonmark@1.0.0.Document');
    console.log(JSON.stringify(agreementMark, null, 2 ));
});