/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import { TemplateLogic, TriggerResponse, InitResponse, IClause, IRequest, IResponse, IState } from '../src';
import { toRuntimeDeclarations } from '../src/TypeScriptCompilationContext';
import { SMART_LEGAL_CONTRACT_SOURCE } from '../src/runtime/smartLegalContract';

interface IHelloData extends IClause {
    name: string;
}
interface IHelloRequest extends IRequest {
    greeting: string;
}
interface IHelloResponse extends IResponse {
    message: string;
}

// Written the way a template's logic/logic.ts is, against the package's exports:
// no @ts-ignore, no locally declared response type. ts-jest type-checks it.
class HelloLogic extends TemplateLogic<IHelloData> {
    async trigger(data: IHelloData, request: IHelloRequest): Promise<TriggerResponse> {
        const result: IHelloResponse = {
            $class: 'hello@1.0.0.Response',
            $timestamp: request.$timestamp,
            message: `${request.greeting} ${data.name}`,
        };
        return { result, events: [] };
    }
}

describe('SmartLegalContract exports', () => {
    it('exports TemplateLogic as a class that template logic can extend', async () => {
        expect(typeof TemplateLogic).toBe('function');
        const logic = new HelloLogic();
        expect(logic).toBeInstanceOf(TemplateLogic);

        const data: IHelloData = { $class: 'hello@1.0.0.TemplateModel', $identifier: 'c1', clauseId: 'c1', name: 'World' };
        const response = await logic.trigger(data, { $class: 'hello@1.0.0.Request', $timestamp: '2026-01-01T00:00:00Z', greeting: 'Hello' } as IHelloRequest);
        expect((response.result as IHelloResponse).message).toBe('Hello World');

        // Templates without state need not implement init().
        const init: InitResponse<IState> | undefined = await logic.init(data);
        expect(init).toBeUndefined();
    });

    it('ships declarations a TypeScript consumer can compile against', () => {
        // The built package (npm test builds first). Before this fix, lib/index.d.ts
        // imported ./slc/SmartLegalContract.d.ts, which the build did not emit, and
        // exported TemplateLogic as a type only, so `extends TemplateLogic` failed.
        const libIndex = path.resolve(__dirname, '../lib/index.d.ts');
        if (!existsSync(libIndex)) {
            throw new Error('Run `npm run build` before this test: lib/index.d.ts is missing');
        }
        const consumer = path.resolve(__dirname, 'consumer.ts');
        const consumerSource = `
import { TemplateLogic, TriggerResponse, IClause, IRequest } from '@accordproject/template-engine';
interface IData extends IClause { name: string }
export class Logic extends TemplateLogic<IData> {
    async trigger(data: IData, request: IRequest): Promise<TriggerResponse> {
        return { result: { $class: 'x@1.0.0.Response', $timestamp: request.$timestamp } };
    }
}
export class Wrong extends TemplateLogic<IData> {
    // @ts-expect-error trigger must resolve to a TriggerResponse, which has a result
    async trigger(): Promise<TriggerResponse> { return { events: [] }; }
}
`;
        const options: ts.CompilerOptions = {
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            target: ts.ScriptTarget.ES2021,
            module: ts.ModuleKind.CommonJS,
            moduleResolution: ts.ModuleResolutionKind.Node10,
            esModuleInterop: true,
            types: ['node'],
            baseUrl: path.resolve(__dirname, '..'),
            paths: { '@accordproject/template-engine': ['lib/index.d.ts'] },
        };
        const host = ts.createCompilerHost(options);
        const readFile = host.readFile;
        host.readFile = (fileName) => (path.resolve(fileName) === consumer ? consumerSource : readFile(fileName));
        const fileExists = host.fileExists;
        host.fileExists = (fileName) => path.resolve(fileName) === consumer || fileExists(fileName);

        // Diagnostics in this package's declarations or in the consumer; dependencies
        // such as cicero-core are left to their own repositories.
        const libDir = path.dirname(libIndex) + path.sep;
        const program = ts.createProgram([consumer], options, host);
        const diagnostics = ts.getPreEmitDiagnostics(program)
            .filter(d => d.file === undefined || path.resolve(d.file.fileName).startsWith(libDir) || path.resolve(d.file.fileName) === consumer)
            .map(d => `${d.file ? path.basename(d.file.fileName) : ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
        expect(diagnostics).toEqual([]);
    });
});

describe('toRuntimeDeclarations', () => {
    const bounds = { state: '__RtState0', request: '__RtRequest0 | __RtRequest1', response: 'never', event: '__RtEvent0' };

    it('embeds the current src/slc/SmartLegalContract.ts', () => {
        // with LF line endings, whatever the checkout uses
        const source = readFileSync(path.resolve(__dirname, '../src/slc/SmartLegalContract.ts'), 'utf-8');
        expect(SMART_LEGAL_CONTRACT_SOURCE).toBe(source.replace(/\r\n?/g, '\n'));
        expect(SMART_LEGAL_CONTRACT_SOURCE).not.toContain('\r');
    });

    it('gives the same declarations for a CRLF source as for an LF one', () => {
        const crlf = SMART_LEGAL_CONTRACT_SOURCE.replace(/\n/g, '\r\n');
        const declarations = toRuntimeDeclarations(crlf, bounds);
        expect(declarations).toBe(toRuntimeDeclarations(SMART_LEGAL_CONTRACT_SOURCE, bounds));
        expect(declarations).not.toContain('\r');
        expect(declarations).not.toMatch(/^\s*(\/\/|\/\*)/m);
    });

    it('binds the runtime types to the given unions', () => {
        const declarations = toRuntimeDeclarations(SMART_LEGAL_CONTRACT_SOURCE, bounds);
        expect(declarations).toContain('type RuntimeState = __RtState0;');
        expect(declarations).toContain('type RuntimeRequest = __RtRequest0 | __RtRequest1;');
        expect(declarations).toContain('type RuntimeResponse = never;');
        expect(declarations).toContain('type RuntimeEvent = __RtEvent0;');
        expect(declarations).not.toContain('= IState;');
        expect(declarations).not.toContain('@runtime-bounds');
    });

    it('drops exports and comments, keeping the declarations', () => {
        const declarations = toRuntimeDeclarations(SMART_LEGAL_CONTRACT_SOURCE, bounds);
        expect(declarations).not.toMatch(/^export /m);
        expect(declarations).not.toMatch(/^\s*(\/\/|\/\*)/m);
        expect(declarations).toContain('abstract class TemplateLogic<T extends TemplateData, S extends RuntimeState = RuntimeState> {');
        expect(declarations).toContain('interface TriggerResponse<S extends RuntimeState = RuntimeState> extends EngineResponse<S> {');
    });

    it('throws when the source has no runtime bounds block', () => {
        expect(() => toRuntimeDeclarations('export interface IState { $identifier: string; }', bounds))
            .toThrow(/@runtime-bounds-start/);
    });
});
