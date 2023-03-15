import { Factory, ModelManager, Serializer } from '@accordproject/concerto-core';
import { CommonMarkModel, CiceroMarkModel, ConcertoMetaModel } from '@accordproject/markdown-common';

import { ITemplateData, Color } from '../output/full/test@1.0.0';
import { generator } from '../output/full/generator';

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

describe('runner', () => {
    test('should run generated function', async () => {
        const data: ITemplateData = {
            $class: 'test@1.0.0.TemplateData',
            firstName: 'Dan',
            lastName: 'Selman',
            middleNames: ['Tenzin', 'Isaac', 'Mia'],
            active: false,
            lastVisit: new Date('2023-01-10'),
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
            preferences: {
                $class: 'test@1.0.0.Preferences',
                favoriteColors: [Color.RED, Color.PINK]
            }
        };
        const agreement = generator(data, CLAUSE_LIBRARY);
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(CiceroMarkModel.MODEL, 'ciceromark.cto');

        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        try {
            serializer.fromJSON(agreement);
            console.log(JSON.stringify(agreement, null, 2));
            console.log('Generated a valid agreement.');
        }
        catch (err) {
            console.log(JSON.stringify(agreement, null, 2));
            throw new Error(`Generated invalid agreement: ${err}`);
        }
    });
});