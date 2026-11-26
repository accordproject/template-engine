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
import ts from 'typescript';
import { getRuntimeDeclarationNames, removeEngineImports } from '../src/EngineImports';

describe('removeEngineImports', () => {
    it('lists the names declared by SmartLegalContract.ts', () => {
        const names = getRuntimeDeclarationNames();
        for (const name of ['TemplateLogic', 'TriggerResponse', 'InitResponse', 'EngineResponse', 'IState', 'IRequest', 'IResponse', 'IEvent', 'TemplateData', 'RuntimeState']) {
            expect(names).toContain(name);
        }
    });

    it('leaves source without an engine import unchanged', () => {
        const source = 'import { IFoo } from "./generated/foo@1.0.0";\nclass A {}\n';
        expect(removeEngineImports(ts, source)).toBe(source);
    });

    it('removes named, type-only and multi-line imports, and keeps every line in place', () => {
        const source = [
            'import { TemplateLogic, TriggerResponse } from \'@accordproject/template-engine\';',
            'import type {',
            '    InitResponse,',
            '    IState,',
            '} from "@accordproject/template-engine";',
            'import { type IRequest } from \'@accordproject/template-engine\';',
            'import \'@accordproject/template-engine\';',
            'import { IFoo } from "./generated/foo@1.0.0";',
            'class A extends TemplateLogic<IFoo> {}',
        ].join('\n');
        const result = removeEngineImports(ts, source);
        expect(result).not.toContain('@accordproject/template-engine');
        expect(result).toContain('import { IFoo } from "./generated/foo@1.0.0";');
        expect(result.split('\n')).toHaveLength(source.split('\n').length);
        expect(result.split('\n')[8]).toBe('class A extends TemplateLogic<IFoo> {}');
    });

    it('keeps CRLF line endings', () => {
        const source = 'import { TemplateLogic } from \'@accordproject/template-engine\';\r\nclass A {}\r\n';
        const result = removeEngineImports(ts, source);
        expect(result).not.toContain('@accordproject/template-engine');
        expect(result.endsWith('\r\nclass A {}\r\n')).toBe(true);
    });

    it('does not touch an engine specifier that is not in an import declaration', () => {
        const source = 'const name = \'@accordproject/template-engine\';\n';
        expect(removeEngineImports(ts, source)).toBe(source);
    });

    it('rejects a default import', () => {
        expect(() => removeEngineImports(ts, 'import engine from \'@accordproject/template-engine\';'))
            .toThrow(/logic\.ts:1: a default import .* is not supported/);
    });

    it('rejects a namespace import', () => {
        expect(() => removeEngineImports(ts, '\nimport * as engine from \'@accordproject/template-engine\';'))
            .toThrow(/logic\.ts:2: a namespace import .* is not supported/);
    });

    it('rejects a renamed import', () => {
        expect(() => removeEngineImports(ts, 'import { TemplateLogic as Base } from \'@accordproject/template-engine\';'))
            .toThrow(/renaming 'TemplateLogic' .* is not supported/);
    });

    it('rejects a name the engine does not provide to template logic', () => {
        expect(() => removeEngineImports(ts, 'import { TemplateArchiveProcessor } from \'@accordproject/template-engine\';', 'logic/logic.ts'))
            .toThrow(/logic\/logic\.ts:1: 'TemplateArchiveProcessor' is not available to template logic .* TemplateLogic/);
    });
});
