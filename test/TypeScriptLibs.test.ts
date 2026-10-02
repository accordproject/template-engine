import { readFileSync } from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { TYPESCRIPT_LIBS, TYPESCRIPT_LIBS_VERSION } from '../src/runtime/typescriptLibs';

/**
 * Spy on the @typescript/vfs functions that load the TypeScript lib files, so the
 * tests can check where the lib files come from.
 */
jest.mock('@typescript/vfs', () => {
    const actual = jest.requireActual('@typescript/vfs');
    return {
        ...actual,
        createDefaultMapFromNodeModules: jest.fn(actual.createDefaultMapFromNodeModules),
        createDefaultMapFromCDN: jest.fn(actual.createDefaultMapFromCDN),
    };
});

const TYPESCRIPT_LIB_DIR = path.dirname(require.resolve('typescript/lib/lib.d.ts'));
const TEMPLATE_CONCEPT = 'helloformula@1.0.0.TemplateData';

/**
 * The lib files are cached at module level, so each test loads a fresh copy of the
 * modules (and the mocks) to start with an empty cache.
 */
async function loadCompiler() {
    jest.resetModules();
    const vfs = jest.mocked(await import('@typescript/vfs'));
    const { ModelManager } = await import('@accordproject/concerto-core');
    const { TypeScriptToJavaScriptCompiler } = await import('../src/TypeScriptToJavaScriptCompiler');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(readFileSync('./test/templates/good/helloformula/model.cto', 'utf-8'));
    const compiler = new TypeScriptToJavaScriptCompiler(modelManager, TEMPLATE_CONCEPT);
    return { vfs, compiler };
}

function userCode(body: string) {
    return `export function f(data:any) : any { ${body} }`;
}

describe('bundled typescript lib files', () => {
    test('should come from the installed typescript version', () => {
        expect(TYPESCRIPT_LIBS_VERSION).toBe(ts.version);
        for (const [fileName, contents] of Object.entries(TYPESCRIPT_LIBS)) {
            expect(contents).toBe(readFileSync(path.join(TYPESCRIPT_LIB_DIR, fileName), 'utf-8'));
        }
    });

    test('should contain the ES2022 lib and every lib file it references, but not the DOM libs', () => {
        expect(TYPESCRIPT_LIBS['/lib.es2022.d.ts']).toBeDefined();
        expect(TYPESCRIPT_LIBS['/lib.es5.d.ts']).toBeDefined();
        expect(Object.keys(TYPESCRIPT_LIBS).filter(f => /dom|webworker|scripthost/.test(f))).toEqual([]);
        for (const contents of Object.values(TYPESCRIPT_LIBS)) {
            for (const match of contents.matchAll(/\/\/\/\s*<reference\s+lib="([^"]+)"/g)) {
                expect(Object.keys(TYPESCRIPT_LIBS)).toContain(`/lib.${match[1].toLowerCase()}.d.ts`);
            }
        }
    });
});

describe('typescript lib files', () => {
    jest.setTimeout(120000);

    test('should use the bundled lib files in the browser, without reading node_modules or fetching', async () => {
        const { vfs, compiler } = await loadCompiler();
        const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'));
        // the compiler takes its browser path when a window global exists
        const global = globalThis as { window?: object };
        global.window = {};
        try {
            await compiler.initialize();
        }
        finally {
            delete global.window;
            fetchSpy.mockRestore();
        }

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(vfs.createDefaultMapFromNodeModules).not.toHaveBeenCalled();
        expect(vfs.createDefaultMapFromCDN).not.toHaveBeenCalled();
        for (const fileName of Object.keys(TYPESCRIPT_LIBS)) {
            expect(compiler.fsMap!.get(fileName)).toBe(TYPESCRIPT_LIBS[fileName]);
        }
        const result = compiler.compile(userCode('console.log(data); return [1, 2].at(-1);'));
        expect(result.errors).toEqual([]);
        expect(result.code).toContain('console.log(data)');
    });

    test('should allow console and ES2022 APIs in user code', async () => {
        const { compiler } = await loadCompiler();
        await compiler.initialize();

        const result = compiler.compile(userCode('console.log(Object.hasOwn(data, "message")); return [1, 2].at(-1);'));

        expect(result.errors).toEqual([]);
    });

    test('should not allow DOM globals in user code', async () => {
        const { compiler } = await loadCompiler();
        await compiler.initialize();

        const result = compiler.compile(userCode('return document.title;'));

        expect(result.errors.map(e => e.renderedMessage)).toEqual([
            expect.stringContaining('Cannot find name \'document\''),
        ]);
    });
});
