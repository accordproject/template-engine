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
            const modelManager = new ModelManager({ strict: true });
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, {});
            const templateMarkTransformer = new TemplateMarkTransformer();
            const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
            const now = '2023-03-17T00:00:00.000Z';
            return engine.generate(templateMarkDom, data, {now, disableJavaScriptEvaluation: true});
        };
        await expect(f()).rejects.toThrow('JavaScript evaluation is disabled.');
    });
    test('should evaluate a formula with sandboxJavaScriptEvaluation set to true', async () => {
        const f = async () => {
            const model = readFileSync('./test/templates/good/helloformula/model.cto', 'utf-8');
            const template = readFileSync('./test/templates/good/helloformula/template.md', 'utf-8');
            const data = JSON.parse(readFileSync('./test/templates/good/helloformula/data.json', 'utf-8'));
            const modelManager = new ModelManager({ strict: true });
            modelManager.addCTOModel(model);
            const engine = new TemplateMarkInterpreter(modelManager, {});
            const templateMarkTransformer = new TemplateMarkTransformer();
            const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
            const now = '2023-03-17T00:00:00.000Z';
            return engine.generate(templateMarkDom, data, {now, sandboxJavaScriptEvaluation: false});
        };
        await expect(f()).resolves.toMatchSnapshot();
    });
});
