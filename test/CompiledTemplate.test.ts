import { generator } from './compiled-templates/full/generator';
import { ITemplateData } from './compiled-templates/full/test@1.0.0';

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

describe('compiled template', () => {
    test('should create agreementmark from a template and data', async () => {

        /**
         * Define the data we will merge with the template - an instance of the template model
         */
        const data:ITemplateData = {
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
            preferences: {
                $class: 'test@1.0.0.Preferences',
                favoriteColors: ['RED', 'PINK']
            }
        };

        const now = dayjs('2023-03-17T00:00:00.000Z');
        let ciceroMark = generator(data, CLAUSE_LIBRARY, now);
        expect(ciceroMark).toMatchSnapshot();

        data.loyaltyStatus = {
            $class: 'test@1.0.0.LoyaltyStatus',
            level: 'Gold'
        };

        ciceroMark = generator(data, CLAUSE_LIBRARY, now);
        expect(ciceroMark).toMatchSnapshot();
    });
});
