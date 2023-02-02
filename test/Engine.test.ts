import { generateAgreement } from '../src/';

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
                                'lastName'
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

test('should detect no changes between two identical files', async () => {
    const data = {
        'firstName': 'Dan',
        'lastName': 'Selman',
        'lastVisit': '2023-01-10'
    };
    const agreementMark = generateAgreement(templateMark, data);
    expect(agreementMark).toBeTruthy();
});