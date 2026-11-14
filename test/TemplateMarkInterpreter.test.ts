import { ModelManager } from '@accordproject/concerto-core';
import { CommonMarkModel, CommonMarkTransformer, TemplateMarkModel } from '@accordproject/markdown-common';
import { transform } from '@accordproject/markdown-transform';
import { TemplateCompilationError, TemplateMarkInterpreter } from '../src';
import { TemplateMarkTransformer, templatemarkutil } from '@accordproject/markdown-template';
import { existsSync, readFileSync, readdirSync } from 'fs';
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

// Shared by the list structure assertions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const text = (node: any): string => node.value ?? node.text ?? (node.nodes ?? []).map(text).join('');

function loadTemplateMark(fixtureRoot: string, modelManager: ModelManager) {
    const templateJsonPath = path.join(fixtureRoot, 'template.json');
    return existsSync(templateJsonPath)
        ? templatemarkutil.templateMarkTyping(JSON.parse(readFileSync(templateJsonPath, 'utf-8')), modelManager, 'contract')
        : new TemplateMarkTransformer().fromMarkdownTemplate({
            content: readFileSync(path.join(fixtureRoot, 'template.md'), 'utf-8')
        }, modelManager, 'contract', { verbose: false });
}

const GOOD_TEMPLATES_ROOT = './test/templates/good';
const BAD_TEMPLATES_ROOT = './test/templates/bad';
const MONEY_MODEL_FILES = [
    '@models.accordproject.org.money@0.3.0.cto',
    '@models.accordproject.org.money@1.0.0.cto'
];

describe('templatemark interpreter', () => {
    jest.setTimeout(30000);
    const goodTemplates = readdirSync(GOOD_TEMPLATES_ROOT);

    goodTemplates.forEach(function (templateName) {
        if(templateName === 'foreach') return; // currently broken!!

        test(`should generate ${templateName}`, async () => {
            /**
             * Define the data model for the template. The model must have a concept with
             * the @template decorator. The types of properties allow the template to be
             * type-checked.
            */
            const model = readFileSync(`${GOOD_TEMPLATES_ROOT}/${templateName}/model.cto`, 'utf-8');

            /**
             * Define the data we will merge with the template - an instance of the template model
             */
            const data = JSON.parse(readFileSync(`${GOOD_TEMPLATES_ROOT}/${templateName}/data.json`, 'utf-8'));

            const modelManager = new ModelManager();
            MONEY_MODEL_FILES.forEach(file => {
                modelManager.addCTOModel(readFileSync(path.join(__dirname, 'models', file), 'utf-8'), file);
            });
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, CLAUSE_LIBRARY);

            const templateMarkDom = loadTemplateMark(path.join(GOOD_TEMPLATES_ROOT, templateName), modelManager);
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

    const badTemplates = readdirSync(BAD_TEMPLATES_ROOT);

    badTemplates.forEach(function (templateName) {
        test(`should fail to generate ${templateName}`, async () => {
            const model = readFileSync(`${BAD_TEMPLATES_ROOT}/${templateName}/model.cto`, 'utf-8');
            const data = JSON.parse(readFileSync(`${BAD_TEMPLATES_ROOT}/${templateName}/data.json`, 'utf-8'));
            const modelManager = new ModelManager();
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, CLAUSE_LIBRARY);

            const f = async () => {
                const templateMarkDom = loadTemplateMark(path.join(BAD_TEMPLATES_ROOT, templateName), modelManager);
                const now = '2023-03-17T00:00:00.000Z';
                return engine.generate(templateMarkDom, data, {now});
            };
            const err = await f().then(() => undefined, e => e);
            expect(err).toBeInstanceOf(Error);
            expect(err).toMatchSnapshot();
            if (err instanceof TemplateCompilationError) {
                expect(err.errors).toMatchSnapshot('compilation errors');
            }
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
        const LIST_CASES: Array<['ulist' | 'olist', 'bullet' | 'ordered']> = [
            ['ulist', 'bullet'],
            ['olist', 'ordered'],
        ];

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
        test.each(LIST_CASES)('%s body starting with a variable does not throw and resolves values', async (templateListType, renderedListType) => {
            await expectVariablesResolved(
                `{{#${templateListType} volumeDiscounts}}\n{{volumeAbove}} units at {{rate}}%\n{{/${templateListType}}}\n`,
                renderedListType
            );
        });

        // Failure mode B: leading text means no throw, but Items were silently empty.
        test.each(LIST_CASES)('%s body with leading text yields populated items', async (templateListType, renderedListType) => {
            await expectVariablesResolved(
                `{{#${templateListType} volumeDiscounts}}\nAbove {{volumeAbove}} units: {{rate}}% off\n{{/${templateListType}}}\n`,
                renderedListType
            );
        });
    });

    describe('multi-block list bodies', () => {
        const MODEL = `namespace listbody@1.0.0
concept Entry {
    o String first
    o String second
}
@template
concept TemplateData {
    o Entry[] entries
    o String[] names
}`;
        const DATA = {
            $class: 'listbody@1.0.0.TemplateData',
            entries: [
                { $class: 'listbody@1.0.0.Entry', first: 'alpha', second: 'A2' },
                { $class: 'listbody@1.0.0.Entry', first: 'beta', second: 'B2' },
            ],
            names: ['alpha', 'beta'],
        };
        const LIST_CASES: Array<['ulist' | 'olist', 'bullet' | 'ordered']> = [
            ['ulist', 'bullet'],
            ['olist', 'ordered'],
        ];
        const cm = (type: string) => `${CommonMarkModel.NAMESPACE}.${type}`;
        const itemBodies = (list: any) => list.nodes.map((item: any) => ({
            $class: item.$class,
            blocks: item.nodes.map((block: any) => ({ $class: block.$class, text: text(block) })),
        }));

        async function renderBody(kind: 'ulist' | 'olist', body: string, wrapped = false, data = DATA, field = 'entries') {
            const modelManager = new ModelManager();
            modelManager.addCTOModel(MODEL);
            const marker = kind === 'ulist' ? '- ' : '1. ';
            const content = wrapped
                ? body.split('\n').map((line, index) => index === 0 ? marker + line : line ? '   ' + line : '').join('\n')
                : body;
            const templateMark = new TemplateMarkTransformer().fromMarkdownTemplate(
                { content: `{{#${kind} ${field}}}\n${content}\n{{/${kind}}}` }, modelManager, 'contract');
            const agreement = await new TemplateMarkInterpreter(modelManager, {}).generate(templateMark, data);
            const json = agreement.toJSON();
            const list = json.nodes[0].nodes[0];
            const markdown = await transform(json, 'ciceromark', ['ciceromark_unquoted', 'markdown'], null, {});
            const rendered = new CommonMarkTransformer().fromMarkdown(markdown);
            expect(list.$class).toBe(cm('List'));
            return { list, markdown, rendered };
        }

        test.each(LIST_CASES)('%s preserves formatted paragraphs and per-element values', async (kind, listType) => {
            const body = '**First: {{first}}**\n\nSecond: [{{second}}](https://example.test) with *emphasis* and `code`';
            const result = await renderBody(kind, body);
            const wrapped = await renderBody(kind, body, true);
            const expectedItems = DATA.entries.map(entry => ({
                $class: cm('Item'),
                blocks: [
                    { $class: cm('Paragraph'), text: `First: ${entry.first}` },
                    { $class: cm('Paragraph'), text: `Second: ${entry.second} with emphasis and code` },
                ],
            }));
            expect({ agreement: itemBodies(result.list), markdown: itemBodies(result.rendered.nodes[0]) })
                .toEqual({ agreement: expectedItems, markdown: expectedItems });
            expect(result.list.type).toBe(listType);
            result.list.nodes.forEach((item: any) => {
                expect(item.nodes[0].nodes[0].$class).toBe(cm('Strong'));
                expect(item.nodes[1].nodes.map((node: any) => node.$class))
                    .toEqual(['Text', 'Link', 'Text', 'Emph', 'Text', 'Code'].map(cm));
            });
            expect(result.list).toEqual(wrapped.list);
            expect(result.markdown).toBe(wrapped.markdown);
        });

        test.each(LIST_CASES)('%s preserves static nested blocks after the first paragraph', async (kind) => {
            for (const [suffix, blockType] of [
                ['> Quote: {{second}}', 'BlockQuote'],
                ['- Child: {{second}}', 'List'],
            ]) {
                const body = `First: {{first}}\n\n${suffix}`;
                const result = await renderBody(kind, body);
                const wrapped = await renderBody(kind, body, true);
                for (const list of [result.list, result.rendered.nodes[0]]) {
                    expect(list.nodes).toHaveLength(DATA.entries.length);
                    list.nodes.forEach((item: any, index: number) => {
                        expect(item.$class).toBe(cm('Item'));
                        expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm(blockType)]);
                        expect(text(item.nodes[0])).toBe(`First: ${DATA.entries[index].first}`);
                        expect(text(item.nodes[1])).toBe(`${blockType === 'List' ? 'Child' : 'Quote'}: ${DATA.entries[index].second}`);
                        expect(item.nodes[1].nodes[0].$class).toBe(cm(blockType === 'List' ? 'Item' : 'Paragraph'));
                    });
                }
                expect(result.list).toEqual(wrapped.list);
                expect(result.markdown).toBe(wrapped.markdown);
            }
        });

        test.each(LIST_CASES)('%s preserves multiple paragraphs for primitive array elements', async (kind) => {
            const result = await renderBody(kind, 'First: {{this}}\n\nSecond: {{this}}', false, DATA, 'names');
            const expectedItems = DATA.names.map(name => ({
                $class: cm('Item'),
                blocks: [
                    { $class: cm('Paragraph'), text: `First: ${name}` },
                    { $class: cm('Paragraph'), text: `Second: ${name}` },
                ],
            }));
            expect({ agreement: itemBodies(result.list), markdown: itemBodies(result.rendered.nodes[0]) })
                .toEqual({ agreement: expectedItems, markdown: expectedItems });
        });

        test.each(LIST_CASES)('%s emits no items for an empty array', async (kind) => {
            const body = 'First: {{first}}\n\nSecond: {{second}}';
            for (const wrapped of [false, true]) {
                const result = await renderBody(kind, body, wrapped, { ...DATA, entries: [] });
                expect(result.list.nodes).toEqual([]);
                expect(result.markdown).toBe('');
                expect(result.rendered).toEqual(new CommonMarkTransformer().fromMarkdown(''));
            }
        });
    });

    describe('nested list data contexts', () => {
        const fixtureRoot = path.join(GOOD_TEMPLATES_ROOT, 'nested-list');
        const DATA = JSON.parse(readFileSync(path.join(fixtureRoot, 'data.json'), 'utf-8'));
        const cm = (type: string) => `${CommonMarkModel.NAMESPACE}.${type}`;
        const nested = '{{#ulist entries}}\n{{label}}\n\n{{#olist tags}}\n{{this}}\n{{/olist}}\n{{/ulist}}';

        async function render(content = readFileSync(path.join(fixtureRoot, 'template.md'), 'utf-8'), entries = DATA.entries) {
            const modelManager = new ModelManager();
            modelManager.addCTOModel(readFileSync(path.join(fixtureRoot, 'model.cto'), 'utf-8'));
            const templateMark = new TemplateMarkTransformer().fromMarkdownTemplate({ content }, modelManager, 'contract');
            const agreement = await new TemplateMarkInterpreter(modelManager, {}).generate(templateMark, { ...DATA, entries });
            const json = agreement.toJSON();
            const markdown = await transform(json, 'ciceromark', ['ciceromark_unquoted', 'markdown'], null, {});
            return { nodes: json.nodes[0].nodes, markdown, rendered: new CommonMarkTransformer().fromMarkdown(markdown) };
        }

        test('preserves populated wrapped and unwrapped lists and repeated child values', async () => {
            const result = await render();
            for (const nodes of [result.nodes, result.rendered.nodes]) {
                expect(nodes.map((list: any) => list.type)).toEqual(['bullet', 'ordered']);
                nodes.forEach((list: any, index: number) => {
                    expect(list.$class).toBe(cm('List'));
                    expect(list.nodes.map((item: any) => item.nodes.map(text)))
                        .toEqual([['first', 'redredblue'], ['second', 'green']]);
                    list.nodes.forEach((item: any) => {
                        expect(item.$class).toBe(cm('Item'));
                        expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm('List')]);
                        expect(item.nodes[1].type).toBe(index === 0 ? 'ordered' : 'bullet');
                    });
                    expect(list.nodes[0].nodes[1].nodes.map(text)).toEqual(['red', 'red', 'blue']);
                });
            }
        });

        test('does not evaluate child lists for an empty outer list', async () => {
            const result = await render(nested, []);
            expect(result.nodes[0]).toMatchObject({ $class: cm('List'), type: 'bullet', nodes: [] });
            expect(result.markdown).toBe('');
        });

        test('uses the corresponding item at each of three list levels', async () => {
            const result = await render('{{#ulist entries}}\n{{label}}\n\n{{#olist children}}\n{{label}}\n\n{{#ulist tags}}\n{{this}}\n{{/ulist}}\n{{/olist}}\n{{/ulist}}');
            const outer = result.nodes[0];
            expect(outer.nodes.map((item: any) => text(item.nodes[0]))).toEqual(['first', 'second']);
            expect(outer.nodes[1].nodes[1].nodes).toEqual([]);
            for (const list of [outer, result.rendered.nodes[0]]) {
                const children = list.nodes[0].nodes[1];
                expect(children).toMatchObject({ $class: cm('List'), type: 'ordered' });
                expect(children.nodes).toHaveLength(1);
                expect(text(children.nodes[0].nodes[0])).toBe('child');
                expect(children.nodes[0].nodes[1]).toMatchObject({ $class: cm('List'), type: 'bullet' });
                expect(children.nodes[0].nodes[1].nodes.map(text)).toEqual(['deep']);
            }
        });

        test('keeps an independent top-level sibling list in the root context', async () => {
            const result = await render(nested + '\n\n{{#olist names}}\n{{this}}\n{{/olist}}');
            for (const nodes of [result.nodes, result.rendered.nodes]) {
                expect(nodes).toHaveLength(2);
                expect(nodes[0].nodes.map((item: any) => text(item.nodes[0]))).toEqual(['first', 'second']);
                expect(nodes[1]).toMatchObject({ $class: cm('List'), type: 'ordered' });
                expect(nodes[1].nodes.map(text)).toEqual(['root']);
            }
        });
    });
    // Optional blocks guarding scalar values (primitives and enums) have no property
    // scope to navigate into: named variables inside them resolve from the parent data
    // context, while {{this}} refers to the optional value itself. The TemplateMark is
    // built by hand because the parser does not yet accept named variables (or enum
    // {{this}}) inside scalar optionals.
    describe('scalar optional blocks', () => {
        const NS = 'test@1.0.0';
        const MODEL = `namespace ${NS}
enum Color {
    o RED
    o GREEN
}
concept Person {
    o String name
    o Integer age optional
}
@template
concept TemplateData {
    o String name
    o Integer age optional
    o Color favoriteColor optional
    o Person person optional
}`;
        const DATA = {
            $class: `${NS}.TemplateData`,
            name: 'Bob',
            age: 30,
            favoriteColor: 'GREEN',
            person: { $class: `${NS}.Person`, name: 'Alice', age: 25 }
        };
        const TM = TemplateMarkModel.NAMESPACE;
        const text = (t: string) => ({ $class: `${CommonMarkModel.NAMESPACE}.Text`, text: t });
        const variable = (name: string, elementType: string) => ({ $class: `${TM}.VariableDefinition`, name, elementType });
        const enumVariable = (name: string) => ({ $class: `${TM}.EnumVariableDefinition`, name, elementType: `${NS}.Color`, enumValues: ['RED', 'GREEN'] });
        const optional = (name: string, elementType: string, whenSome: any[]) => ({
            $class: `${TM}.OptionalDefinition`, name, elementType, whenSome, whenNone: [text('none')]
        });

        async function render(nodes: any[]): Promise<string> {
            const modelManager = new ModelManager();
            modelManager.addCTOModel(MODEL);
            const engine = new TemplateMarkInterpreter(modelManager, {});
            const templateMark = {
                $class: `${CommonMarkModel.NAMESPACE}.Document`,
                xmlns: 'http://commonmark.org/xml/1.0',
                nodes: [{
                    $class: `${TM}.ClauseDefinition`,
                    name: 'top',
                    elementType: `${NS}.TemplateData`,
                    nodes: [{ $class: `${CommonMarkModel.NAMESPACE}.Paragraph`, nodes }]
                }]
            };
            const ciceroMark = await engine.generate(templateMark, DATA, { now: '2023-03-17T00:00:00.000Z' });
            const out: string[] = [];
            (function walk(n: any) {
                if (!n) return;
                if (typeof n.text === 'string') out.push(n.text);
                if (typeof n.value === 'string') out.push(n.value);
                if (Array.isArray(n.nodes)) n.nodes.forEach(walk);
            })(ciceroMark.toJSON());
            return out.join('');
        }

        test('named variables resolve from the parent context inside a primitive optional', async () => {
            expect(await render([optional('age', 'Integer', [variable('name', 'String'), text(' is '), variable('age', 'Integer')])]))
                .toBe('Bob is 30');
        });

        test('{{this}} still refers to the value of a primitive optional', async () => {
            expect(await render([optional('age', 'Integer', [text('Age '), variable('this', 'Integer')])]))
                .toBe('Age 30');
        });

        test('named variables and {{this}} resolve inside an enum optional', async () => {
            expect(await render([optional('favoriteColor', `${NS}.Color`, [enumVariable('favoriteColor'), text(' / '), enumVariable('this')])]))
                .toBe('GREEN / GREEN');
        });

        test('primitive optionals nested in an object optional resolve against the object', async () => {
            expect(await render([optional('person', `${NS}.Person`, [
                variable('name', 'String'),
                optional('age', 'Integer', [text(' '), variable('age', 'Integer'), text(' '), variable('this', 'Integer')])
            ])])).toBe('Alice 25 25');
        });
    });
});
