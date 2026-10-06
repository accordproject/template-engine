import { ModelManager } from '@accordproject/concerto-core';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { readFileSync } from 'fs';
import { TemplateCompilationError, TemplateMarkToJavaScriptCompiler } from '../src/TemplateMarkToJavaScriptCompiler';

describe('templatemark to javascript compiler', () => {
    test('should compile templatemark containing typescript to javascript', async () => {

        const modelManager = new ModelManager();
        modelManager.addCTOModel( readFileSync('./test/templates/good/full/model.cto', 'utf-8'), 'model.cto');
        const compiler = new TemplateMarkToJavaScriptCompiler(modelManager);
        await compiler.initialize();

        const templateMd = readFileSync('./test/templates/good/full/template.md', 'utf-8');
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkJson = templateMarkTransformer.fromMarkdownTemplate({ content: templateMd }, modelManager, 'contract', { verbose: false });

        const results = compiler.compile(templateMarkJson);
        expect(results).toMatchSnapshot();
    });

    test('should throw an Error object with diagnostics and errors array on compilation failure', async () => {
        const modelManager = new ModelManager();
        modelManager.addCTOModel(readFileSync('./test/templates/bad/formula-no-method/model.cto', 'utf-8'), 'model.cto');
        const compiler = new TemplateMarkToJavaScriptCompiler(modelManager);
        await compiler.initialize();

        const templateMd = readFileSync('./test/templates/bad/formula-no-method/template.md', 'utf-8');
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkJson = templateMarkTransformer.fromMarkdownTemplate({ content: templateMd }, modelManager, 'contract', { verbose: false });

        let thrown: unknown;
        try {
            compiler.compile(templateMarkJson);
        } catch (err) {
            thrown = err;
        }

        expect(thrown).toBeInstanceOf(TemplateCompilationError);
        expect(thrown).toBeInstanceOf(Error);
        const err = thrown as TemplateCompilationError;
        expect(err.name).toBe('TemplateCompilationError');
        expect(err.message).toMatch(/Compilation error in 'formula_/);
        expect(err.message).toContain("Property 'missing' does not exist on type 'string'. (line 140, col 18)");
        expect(Array.isArray(err.errors)).toBe(true);
        expect(err.errors.length).toBe(1);
        expect(err.errors[0].nodeId).toMatch(/^formula_/);
        expect(err.errors[0].code).toBe(' return message.missing() ');
        expect(err.errors[0].errors[0].renderedMessage).toBe("Property 'missing' does not exist on type 'string'.");
        expect(err.errors[0].errors[0].line).toBe(140);
        expect(err.errors[0].errors[0].character).toBe(18);
    });
});
