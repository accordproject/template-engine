import { readFileSync } from 'fs';

/**
 * Spy on the @typescript/vfs functions that load the TypeScript lib files, so the
 * tests can count how often the (expensive) lib loading happens.
 */
jest.mock('@typescript/vfs', () => {
    const actual = jest.requireActual('@typescript/vfs');
    return {
        ...actual,
        createDefaultMapFromNodeModules: jest.fn(actual.createDefaultMapFromNodeModules),
        createDefaultMapFromCDN: jest.fn(actual.createDefaultMapFromCDN),
    };
});

/**
 * The lib files are cached at module level, so each test loads a fresh copy of the
 * modules (and the mocks) to start with an empty cache.
 */
async function loadModules() {
    jest.resetModules();
    return {
        vfs: jest.mocked(await import('@typescript/vfs')),
        ModelManager: (await import('@accordproject/concerto-core')).ModelManager,
        TemplateMarkTransformer: (await import('@accordproject/markdown-template')).TemplateMarkTransformer,
        TemplateMarkInterpreter: (await import('../src')).TemplateMarkInterpreter,
        TypeScriptToJavaScriptCompiler: (await import('../src/TypeScriptToJavaScriptCompiler')).TypeScriptToJavaScriptCompiler,
    };
}

function loadTemplate(modules: Awaited<ReturnType<typeof loadModules>>, name: string) {
    const root = `./test/templates/good/${name}`;
    const modelManager = new modules.ModelManager();
    modelManager.addCTOModel(readFileSync(`${root}/model.cto`, 'utf-8'));
    const templateMark = new modules.TemplateMarkTransformer().fromMarkdownTemplate(
        { content: readFileSync(`${root}/template.md`, 'utf-8') }, modelManager, 'contract', { verbose: false });
    const data = JSON.parse(readFileSync(`${root}/data.json`, 'utf-8'));
    return { modelManager, templateMark, data };
}

const now = '2023-03-17T00:00:00.000Z';

describe('typescript compiler reuse', () => {
    jest.setTimeout(120000);

    test('should load the TypeScript lib files once across repeated generate() calls', async () => {
        const modules = await loadModules();
        const { modelManager, templateMark, data } = loadTemplate(modules, 'helloformula');
        const engine = new modules.TemplateMarkInterpreter(modelManager, {});

        const first = await engine.generate(templateMark, data, { now });
        const second = await engine.generate(templateMark, data, { now });
        // a new interpreter (as template-playground creates on every render) also reuses them
        const other = new modules.TemplateMarkInterpreter(modelManager, {});
        const third = await other.generate(templateMark, data, { now });

        expect(modules.vfs.createDefaultMapFromNodeModules).toHaveBeenCalledTimes(1);
        expect(modules.vfs.createDefaultMapFromCDN).not.toHaveBeenCalled();
        expect(second.toJSON()).toEqual(first.toJSON());
        expect(third.toJSON()).toEqual(first.toJSON());
    });

    test('should share one load between concurrent generate() calls', async () => {
        const modules = await loadModules();
        const { modelManager, templateMark, data } = loadTemplate(modules, 'helloformula');

        await Promise.all([1, 2, 3].map(() =>
            new modules.TemplateMarkInterpreter(modelManager, {}).generate(templateMark, data, { now })));

        expect(modules.vfs.createDefaultMapFromNodeModules).toHaveBeenCalledTimes(1);
    });

    test('should reuse the compiler for the same interpreter and template concept', async () => {
        const modules = await loadModules();
        const { modelManager, templateMark, data } = loadTemplate(modules, 'helloformula');
        const engine = new modules.TemplateMarkInterpreter(modelManager, {});

        await engine.generate(templateMark, data, { now });
        const compiler = engine.compilers.get('helloformula@1.0.0.TemplateData');
        await engine.generate(templateMark, data, { now });

        expect(engine.compilers.size).toBe(1);
        expect(compiler).toBeDefined();
        expect(engine.compilers.get('helloformula@1.0.0.TemplateData')).toBe(compiler);
    });

    test('should not load the TypeScript compiler for templates without code', async () => {
        const modules = await loadModules();
        const { modelManager, templateMark, data } = loadTemplate(modules, 'helloworld');
        const engine = new modules.TemplateMarkInterpreter(modelManager, {});
        const original = JSON.parse(JSON.stringify(templateMark));

        const ciceroMark = await engine.generate(templateMark, data, { now });

        expect(modules.vfs.createDefaultMapFromNodeModules).not.toHaveBeenCalled();
        expect(modules.vfs.createDefaultMapFromCDN).not.toHaveBeenCalled();
        expect(engine.compilers.size).toBe(0);
        expect(JSON.stringify(ciceroMark.toJSON())).toContain('World');
        // generate() must not modify the caller's TemplateMark
        expect(templateMark).toEqual(original);
    });

    test('should compile each formula against a fresh copy of the lib files', async () => {
        const modules = await loadModules();
        const { modelManager } = loadTemplate(modules, 'helloformula');
        const compiler = new modules.TypeScriptToJavaScriptCompiler(modelManager, 'helloformula@1.0.0.TemplateData');
        await compiler.initialize();
        const files = Array.from(compiler.fsMap!.keys());

        const first = compiler.compile('export function f(data:any) : number { return 1; }');
        const second = compiler.compile('export function f(data:any) : number { return 2; }');

        expect(first.errors).toEqual([]);
        expect(second.code).toContain('return 2');
        // twoslash writes the compiled files into the map it is given, so that must be a copy
        expect(Array.from(compiler.fsMap!.keys())).toEqual(files);
    });

    test('should retry loading the lib files after a failed load', async () => {
        const modules = await loadModules();
        const { modelManager } = loadTemplate(modules, 'helloformula');
        modules.vfs.createDefaultMapFromNodeModules.mockImplementationOnce(() => {
            throw new Error('lib files unavailable');
        });

        const failing = new modules.TypeScriptToJavaScriptCompiler(modelManager, 'helloformula@1.0.0.TemplateData');
        await expect(failing.initialize()).rejects.toThrow('lib files unavailable');

        const retry = new modules.TypeScriptToJavaScriptCompiler(modelManager, 'helloformula@1.0.0.TemplateData');
        await retry.initialize();
        expect(retry.fsMap!.size).toBeGreaterThan(0);
        expect(modules.vfs.createDefaultMapFromNodeModules).toHaveBeenCalledTimes(2);
    });
});
