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

import { extractTopLevelSymbols, stripModuleSyntax } from '../src/UserLogic';

describe('user logic', () => {
    test('should extract only top-level runtime declarations', async () => {
        const symbols = await extractTopLevelSymbols(`
import { IFoo } from './generated/foo';
declare const ambient: number;
interface IBar { x: number }
type Baz = string;
export function helper(input: number): number {
    const local = input * 2;
    return local;
}
const RATE = 2.5, OTHER = 1;
let { destructured } = { destructured: 1 };
class Logic {
    method() { const inner = 1; return inner; }
}
export default Logic;
`);
        expect(symbols.sort()).toEqual(['Logic', 'OTHER', 'RATE', 'helper']);
    });

    test('should strip module syntax', () => {
        const js = stripModuleSyntax(`import dayjs from 'dayjs';
export function helper() { return 1; }
export class Logic {}
export default Logic;
`);
        expect(js).not.toMatch(/\bimport\b|\bexport\b/);
        expect(js).toContain('function helper()');
        expect(js).toContain('class Logic {}');
    });
});
