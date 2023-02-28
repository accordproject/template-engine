import { ModelManager } from '@accordproject/concerto-core';
import { Engine } from '../src/';

/**
 * Define the data model for the template. The model must have a concept with
 * the @template decorator. The types of properties allow the template to be
 * type-checked.
 */
const model = `namespace test@1.0.0

@template
concept TemplateData {
    o String firstName
    o String lastName optional
    o DateTime lastVisit
}
`;

/**
 * Define the structure of the template using a TemplateMark JSON DOM.
 */
const templateMark = {
    '$class': 'org.accordproject.commonmark@1.0.0.Document',
    'xmlns': 'http://commonmark.org/xml/1.0',
    'nodes': [
        {
            '$class': 'org.accordproject.templatemark@1.0.0.ClauseDefinition',
            'name': 'top',
            'elementType': 'test@1.0.0.TemplateData',
            'decorators': [
                {
                    '$class': 'concerto.metamodel@1.0.0.Decorator',
                    'name': 'template',
                    'arguments': []
                }
            ],
            'nodes': [
                {
                    '$class': 'org.accordproject.commonmark@1.0.0.Paragraph',
                    'nodes': [
                        {
                            '$class': 'org.accordproject.commonmark@1.0.0.Text',
                            'text': 'Hello '
                        },
                        {
                            '$class': 'org.accordproject.templatemark@1.0.0.VariableDefinition',
                            'name': 'firstName',
                            'elementType': 'String'
                        },
                        {
                            '$class': 'org.accordproject.templatemark@1.0.0.ConditionalDefinition',
                            'whenTrue': [
                                {
                                    '$class': 'org.accordproject.commonmark@1.0.0.Text',
                                    'text': 'Mister'
                                }
                            ],
                            'whenFalse': [
                                {
                                    '$class': 'org.accordproject.commonmark@1.0.0.Text',
                                    'text': 'Dude'
                                }
                            ],
                            'condition': 'lastName.startsWith(\'S\')',
                            'dependencies': [
                                'person.lastName'
                            ],
                            'name': 'if'
                        },
                        {
                            '$class': 'org.accordproject.commonmark@1.0.0.Text',
                            'text': '!'
                        }
                    ]
                },
                {
                    '$class': 'org.accordproject.commonmark@1.0.0.Paragraph',
                    'nodes': [
                        {
                            '$class': 'org.accordproject.commonmark@1.0.0.Text',
                            'text': 'Thank you for visiting us '
                        },
                        {
                            '$class': 'org.accordproject.templatemark@1.0.0.FormulaDefinition',
                            'dependencies': [
                                'now',
                                'lastVisit'
                            ],
                            'code': ' return now.diff(lastVisit,\'day\') ',
                            'name': 'formula_53113a901ca88208df47bc83374866e8d497d84099c0f88123c918ff1960b17e'
                        },
                        {
                            '$class': 'org.accordproject.commonmark@1.0.0.Text',
                            'text': ' days ago.'
                        }
                    ]
                }
            ]
        }
    ]
};

test('should generate an agreement with variables, conditionals, formulae', async () => {
    const data = {
        $class: 'test@1.0.0.TemplateData',
        firstName: 'Dan',
        lastName: 'Selman',
        lastVisit: '2023-01-10'
    };
    const modelManager = new ModelManager();
    modelManager.addCTOModel(model);
    const engine = new Engine(modelManager);

    const agreementMark = engine.generate(templateMark, data);
    expect(agreementMark).toBeTruthy();
    console.log(JSON.stringify(agreementMark, null, 2 ));
});