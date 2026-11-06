import { ModelManager } from '@accordproject/concerto-core';
import { readFileSync } from 'fs';
import { TemplateMarkInterpreter } from '../src';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';

describe('template generation options', () => {
    test('should fail to evaluate a formula with disableJavaScriptEvaluation set to true', async () => {
        const f = async () => {
            const model = readFileSync('./test/templates/good/helloformula/model.cto', 'utf-8');
            const template = readFileSync('./test/templates/good/helloformula/template.md', 'utf-8');
            const data = JSON.parse(readFileSync('./test/templates/good/helloformula/data.json', 'utf-8'));
            const modelManager = new ModelManager();
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, {});
            const templateMarkTransformer = new TemplateMarkTransformer();
            const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
            const now = '2023-03-17T00:00:00.000Z';
            return engine.generate(templateMarkDom, data, {now, disableJavaScriptEvaluation: true});
        };
        await expect(f()).rejects.toThrow('JavaScript evaluation is disabled.');
    });
    test('should evaluate a formula with childProcessJavaScriptEvaluation set to true', async () => {
        const f = async () => {
            const model = readFileSync('./test/templates/good/helloformula/model.cto', 'utf-8');
            const template = readFileSync('./test/templates/good/helloformula/template.md', 'utf-8');
            const data = JSON.parse(readFileSync('./test/templates/good/helloformula/data.json', 'utf-8'));
            const modelManager = new ModelManager();
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, {});
            const templateMarkTransformer = new TemplateMarkTransformer();
            const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
            const now = '2023-03-17T00:00:00.000Z';
            return engine.generate(templateMarkDom, data, {now, childProcessJavaScriptEvaluation: true});
        };
        await expect(f()).resolves.toMatchSnapshot();
    });
    test('should draft a Duration and a Period in the locale option', async () => {
        const timeModel = readFileSync('./test/archives/latedeliveryandpenalty-typescript/model/@models.accordproject.org.time@0.3.0.cto', 'utf-8');
        const model = `namespace test@1.0.0
import org.accordproject.time@0.3.0.{Duration, Period}

@template
concept Notice {
    o Duration notice
    o Period term
}`;
        const template = 'Give {{notice}} of notice during the first {{term}}.';
        const data = {
            $class: 'test@1.0.0.Notice',
            notice: { $class: 'org.accordproject.time@0.3.0.Duration', amount: 1, unit: 'days' },
            term: { $class: 'org.accordproject.time@0.3.0.Period', amount: 2, unit: 'years' },
        };
        const modelManager = new ModelManager();
        modelManager.addCTOModel(timeModel, '@models.accordproject.org.time@0.3.0.cto');
        modelManager.addCTOModel(model);
        const engine = new TemplateMarkInterpreter(modelManager, {});
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
        const now = '2023-03-17T00:00:00.000Z';

        const english = JSON.stringify((await engine.generate(templateMarkDom, data, { now, locale: 'en' })).toJSON());
        expect(english).toContain('"value":"1 day"');
        expect(english).toContain('"value":"2 years"');

        // French uses a no-break space before some units, so compare with plain spaces
        const french = JSON.stringify((await engine.generate(templateMarkDom, data, { now, locale: 'fr' })).toJSON()).replace(/\s/gu, ' ');
        expect(french).toContain('"value":"1 jour"');
        expect(french).toContain('"value":"2 ans"');
    });
});
