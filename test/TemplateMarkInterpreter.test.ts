import { ModelManager } from '@accordproject/concerto-core';
import { CommonMarkModel, CommonMarkTransformer } from '@accordproject/markdown-common';
import { transform } from '@accordproject/markdown-transform';
import { TemplateCompilationError, TemplateMarkInterpreter } from '../src';
import { TemplateMarkTransformer, templatemarkutil } from '@accordproject/markdown-template';
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
const MONEY_MODEL_FILES = [
    '@models.accordproject.org.money@0.3.0.cto',
    '@models.accordproject.org.money@1.0.0.cto'
];

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
            MONEY_MODEL_FILES.forEach(file => {
                modelManager.addCTOModel(readFileSync(path.join(__dirname, 'models', file), 'utf-8'), file);
            });
            modelManager.addCTOModel(model);
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
        const text = (node: any): string => node.value ?? node.text ?? (node.nodes ?? []).map(text).join('');
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
        const MODEL = `namespace nestedlists@1.0.0
concept Person { o String name o String[] tags }
concept Child { o String label o String[] tags }
concept Entry {
    o String label
    o String[] tags
    o String[] extra
    o Child[] children
    o Person person optional
}
@template
concept TemplateData { o Entry[] entries o String[] names }`;
        const DATA = {
            $class: 'nestedlists@1.0.0.TemplateData',
            entries: [
                {
                    $class: 'nestedlists@1.0.0.Entry', label: 'first', tags: ['red', 'red', 'blue'], extra: ['x'],
                    children: [{ $class: 'nestedlists@1.0.0.Child', label: 'child', tags: ['deep'] }],
                    person: { $class: 'nestedlists@1.0.0.Person', name: 'Alice', tags: ['person-A'] },
                },
                {
                    $class: 'nestedlists@1.0.0.Entry', label: 'second', tags: ['green'], extra: ['y', 'z'], children: [],
                    person: { $class: 'nestedlists@1.0.0.Person', name: 'Bob', tags: ['person-B'] },
                },
            ],
            names: ['root'],
        };
        type ListKind = 'ulist' | 'olist';
        const KINDS: ListKind[] = ['ulist', 'olist'];
        const COMBINATIONS = KINDS.flatMap(outer => KINDS.map(inner => [outer, inner] as const));
        const cm = (type: string) => `${CommonMarkModel.NAMESPACE}.${type}`;
        const tm = (type: string) => `org.accordproject.templatemark@0.5.0.${type}`;
        const text = (node: any): string => node.value ?? node.text ?? (node.nodes ?? []).map(text).join('');
        const block = (kind: ListKind, name: string, body: string) => `{{#${kind} ${name}}}\n${body}\n{{/${kind}}}`;
        const nested = (outer: ListKind, inner: ListKind) => block(outer, 'entries', `{{label}}\n\n${block(inner, 'tags', '{{this}}')}`);
        const listType = (kind: ListKind) => kind === 'ulist' ? 'bullet' : 'ordered';

        function parse(content: string) {
            const modelManager = new ModelManager();
            modelManager.addCTOModel(MODEL);
            const templateMark = new TemplateMarkTransformer().fromMarkdownTemplate({ content }, modelManager, 'contract');
            return { modelManager, templateMark, interpreter: new TemplateMarkInterpreter(modelManager, {}) };
        }

        async function generate(parsed: ReturnType<typeof parse>, data = DATA) {
            const agreement = await parsed.interpreter.generate(parsed.templateMark, data);
            const json = agreement.toJSON();
            const markdown = await transform(json, 'ciceromark', ['ciceromark_unquoted', 'markdown'], null, {});
            const rendered = new CommonMarkTransformer().fromMarkdown(markdown);
            return { list: json.nodes[0].nodes[0], json, markdown, rendered };
        }

        function expectLeafList(list: any, kind: ListKind, values: string[]) {
            expect(list).toMatchObject({ $class: cm('List'), type: listType(kind) });
            expect(list.nodes.map((item: any) => ({
                $class: item.$class,
                blocks: item.nodes.map((node: any) => ({ $class: node.$class, text: text(node) })),
            }))).toEqual(values.map(value => ({
                $class: cm('Item'), blocks: [{ $class: cm('Paragraph'), text: value }],
            })));
        }

        function expectEntryLists(list: any, outer: ListKind, inner: ListKind, data = DATA) {
            expect(list).toMatchObject({ $class: cm('List'), type: listType(outer) });
            expect(list.nodes).toHaveLength(data.entries.length);
            list.nodes.forEach((item: any, index: number) => {
                expect(item.$class).toBe(cm('Item'));
                expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm('List')]);
                expect(text(item.nodes[0])).toBe(data.entries[index].label);
                expectLeafList(item.nodes[1], inner, data.entries[index].tags);
            });
        }

        test.each(COMBINATIONS)('%s containing %s preserves each parent context and repeated child values', async (outer, inner) => {
            const parsed = parse(nested(outer, inner));
            const definition = parsed.templateMark.nodes[0].nodes[0];
            expect(definition.$class).toBe(tm('ListBlockDefinition'));
            expect(definition.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), tm('ListBlockDefinition')]);
            const result = await generate(parsed);
            expectEntryLists(result.list, outer, inner);
            expectEntryLists(result.rendered.nodes[0], outer, inner);
        });

        test.each(COMBINATIONS)('%s containing %s does not require child data for an empty parent', async (outer, inner) => {
            const result = await generate(parse(nested(outer, inner)), { ...DATA, entries: [] });
            expect(result.list).toMatchObject({ $class: cm('List'), type: listType(outer), nodes: [] });
            expect(result.markdown).toBe('');
            expect(result.rendered).toEqual(new CommonMarkTransformer().fromMarkdown(''));
        });

        test('retains the parent and an empty child list', async () => {
            const data = { ...DATA, entries: [{ ...DATA.entries[0], tags: [] }] };
            const result = await generate(parse(nested('ulist', 'olist')), data);
            expectEntryLists(result.list, 'ulist', 'olist', data);
            expectLeafList(result.rendered.nodes[0], 'ulist', ['first']);
        });

        test('evaluates sibling nested lists independently within each parent', async () => {
            const parsed = parse(block('ulist', 'entries', `{{label}}\n\n${block('ulist', 'tags', '{{this}}')}\n\n${block('olist', 'extra', '{{this}}')}`));
            expect(parsed.templateMark.nodes[0].nodes[0].nodes.map((node: any) => node.$class))
                .toEqual([cm('Paragraph'), tm('ListBlockDefinition'), tm('ListBlockDefinition')]);
            const result = await generate(parsed);
            for (const list of [result.list, result.rendered.nodes[0]]) {
                expect(list.nodes).toHaveLength(2);
                list.nodes.forEach((item: any, index: number) => {
                    expect(item.$class).toBe(cm('Item'));
                    expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm('List'), cm('List')]);
                    expect(text(item.nodes[0])).toBe(DATA.entries[index].label);
                    expectLeafList(item.nodes[1], 'ulist', DATA.entries[index].tags);
                    expectLeafList(item.nodes[2], 'olist', DATA.entries[index].extra);
                });
            }
        });

        test('switches data context at each of three list levels', async () => {
            const parsed = parse(block('ulist', 'entries', `{{label}}\n\n${block('olist', 'children', `{{label}}\n\n${block('ulist', 'tags', '{{this}}')}`)}`));
            const outer = parsed.templateMark.nodes[0].nodes[0];
            expect(outer.nodes[1].name).toBe('children');
            expect(outer.nodes[1].nodes[1].name).toBe('tags');
            const result = await generate(parsed);
            expect(result.list.nodes.map((item: any) => text(item.nodes[0]))).toEqual(['first', 'second']);
            result.list.nodes.forEach((item: any, index: number) => {
                expect(item.$class).toBe(cm('Item'));
                expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm('List')]);
                const children = item.nodes[1];
                expect(children).toMatchObject({ $class: cm('List'), type: 'ordered' });
                expect(children.nodes).toHaveLength(DATA.entries[index].children.length);
                children.nodes.forEach((child: any, childIndex: number) => {
                    expect(child.$class).toBe(cm('Item'));
                    expect(child.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm('List')]);
                    expect(text(child.nodes[0])).toBe(DATA.entries[index].children[childIndex].label);
                    expectLeafList(child.nodes[1], 'ulist', DATA.entries[index].children[childIndex].tags);
                });
            });
            const renderedChildren = result.rendered.nodes[0].nodes[0].nodes[1];
            expect(text(renderedChildren.nodes[0].nodes[0])).toBe('child');
            expectLeafList(renderedChildren.nodes[0].nodes[1], 'ulist', ['deep']);
        });

        test.each(KINDS)('%s keeps wrapped and synthetic multi-block Items equivalent', async (outer) => {
            const inner: ListKind = outer === 'ulist' ? 'olist' : 'ulist';
            const body = `First {{label}}\n\nSecond {{label}}\n\n${block(inner, 'tags', '{{this}}')}`;
            const marker = outer === 'ulist' ? '-' : '1.';
            const childMarker = inner === 'ulist' ? '-' : '1.';
            const wrappedBody = `${marker} First {{label}}\n\n   Second {{label}}\n\n   {{#${inner} tags}}\n   ${childMarker} {{this}}\n   {{/${inner}}}`;
            const unwrapped = parse(block(outer, 'entries', body));
            const wrapped = parse(block(outer, 'entries', wrappedBody));
            const expectedTypes = [cm('Paragraph'), cm('Paragraph'), tm('ListBlockDefinition')];
            expect(unwrapped.templateMark.nodes[0].nodes[0].nodes.map((node: any) => node.$class)).toEqual(expectedTypes);
            const wrapper = wrapped.templateMark.nodes[0].nodes[0].nodes[0];
            expect(wrapper.$class).toBe(cm('List'));
            expect(wrapper.nodes[0].$class).toBe(cm('Item'));
            expect(wrapper.nodes[0].nodes.map((node: any) => node.$class)).toEqual(expectedTypes);
            for (const data of [DATA, { ...DATA, entries: [] }]) {
                const result = await generate(unwrapped, data);
                const control = await generate(wrapped, data);
                expect(result.list).toEqual(control.list);
                expect(result.markdown).toBe(control.markdown);
                for (const list of [result.list, ...(data.entries.length ? [result.rendered.nodes[0]] : [])]) {
                    expect(list).toMatchObject({ $class: cm('List'), type: listType(outer) });
                    expect(list.nodes).toHaveLength(data.entries.length);
                    list.nodes.forEach((item: any, index: number) => {
                        expect(item.$class).toBe(cm('Item'));
                        expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph'), cm('Paragraph'), cm('List')]);
                        expect(item.nodes.slice(0, 2).map(text)).toEqual([`First ${data.entries[index].label}`, `Second ${data.entries[index].label}`]);
                        expectLeafList(item.nodes[2], inner, data.entries[index].tags);
                    });
                }
            }
        });

        test('preserves independent root lists at sibling indices 1 and 10', async () => {
            const parsed = parse([
                nested('ulist', 'olist'), block('olist', 'names', '{{this}}'),
                ...Array.from({ length: 8 }, (_, index) => `Static paragraph ${index}`),
                block('ulist', 'names', '{{this}}'),
            ].join('\n\n'));
            for (const index of [1, 10]) {
                expect(parsed.templateMark.nodes[0].nodes[index].$class).toBe(tm('ListBlockDefinition'));
            }
            const result = await generate(parsed);
            for (const nodes of [result.json.nodes[0].nodes, result.rendered.nodes]) {
                const lists = nodes.filter((node: any) => node.$class === cm('List'));
                expect(lists).toHaveLength(3);
                expectEntryLists(lists[0], 'ulist', 'olist');
                expectLeafList(lists[1], 'olist', DATA.names);
                expectLeafList(lists[2], 'ulist', DATA.names);
            }
        });

        // Multiline Markdown ends these inline wrappers before a child list. Assemble
        // their nested bodies from parsed nodes, then run the model-aware type checker.
        test.each(['with', 'optional'])('typed List -> %s(person) -> List retains navigation and item scope', async (kind) => {
            const parsed = parse(block('ulist', 'entries', `{{label}} {{#${kind} person}}{{name}}{{/${kind}}}`));
            const wrapper = parsed.templateMark.nodes[0].nodes[0].nodes[0].nodes[2];
            expect(wrapper.$class).toBe(tm(kind === 'with' ? 'WithDefinition' : 'OptionalDefinition'));
            const child = parse(block('olist', 'names', '{{this}}')).templateMark.nodes[0].nodes[0];
            child.name = 'tags';
            const children = kind === 'with' ? wrapper.nodes : wrapper.whenSome;
            children.push(child);
            parsed.templateMark = templatemarkutil.templateMarkTyping(parsed.templateMark, parsed.modelManager, 'contract');
            const typedWrapper = parsed.templateMark.nodes[0].nodes[0].nodes[0].nodes[2];
            expect((kind === 'with' ? typedWrapper.nodes : typedWrapper.whenSome)[1])
                .toMatchObject({ $class: tm('ListBlockDefinition'), name: 'tags' });
            expect(child.nodes[0].nodes[0]).toMatchObject({ $class: tm('VariableDefinition'), name: 'this', elementType: 'String' });
            for (const data of [DATA, { ...DATA, entries: [] }]) {
                const result = await generate(parsed, data);
                expect(result.list).toMatchObject({ $class: cm('List'), type: 'bullet' });
                expect(result.list.nodes).toHaveLength(data.entries.length);
                result.list.nodes.forEach((item: any, index: number) => {
                    expect(item.$class).toBe(cm('Item'));
                    expect(item.nodes.map((node: any) => node.$class)).toEqual([cm('Paragraph')]);
                    expect(text(item.nodes[0].nodes[0])).toBe(data.entries[index].label);
                    const person = item.nodes[0].nodes[2];
                    expect(person.$class).toBe(kind === 'with' ? cm('Paragraph') : 'org.accordproject.ciceromark@0.6.0.Optional');
                    expect(text(person.nodes[0])).toBe(data.entries[index].person.name);
                    expectLeafList(person.nodes[1], 'olist', data.entries[index].person.tags);
                    expect(result.markdown).toContain(data.entries[index].person.tags[0]);
                });
                if (!data.entries.length) expect(result.markdown).toBe('');
            }
        });

        test('rejects missing required child properties instead of treating them as empty arrays', async () => {
            const data = JSON.parse(JSON.stringify(DATA));
            delete data.entries[1].tags;
            await expect(generate(parse(nested('ulist', 'olist')), data)).rejects.toThrow(/missing the required field "tags"/);
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
        const TM = 'org.accordproject.templatemark@0.5.0';
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
