import { ModelManager } from '@accordproject/concerto-core';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { readFileSync } from 'fs-extra';
import { TemplateMarkToJavaScriptCompiler } from '../src/TemplateMarkToJavaScriptCompiler';

describe('templatemark to javascript compiler', () => {
    test('should compile templatemark containing typescript to javascript', async () => {

        const modelManager = new ModelManager();
        modelManager.addCTOModel( readFileSync('./test/templates/good/full/model.cto', 'utf-8'), 'model.cto');
        const compiler = new TemplateMarkToJavaScriptCompiler(modelManager);

        const templateMd = readFileSync('./test/templates/good/full/template.md', 'utf-8');
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkJson = templateMarkTransformer.fromMarkdownTemplate({ content: templateMd }, modelManager, 'contract', { verbose: false });

        const results = compiler.compile(templateMarkJson);
        expect(results).toMatchSnapshot();
    });
});