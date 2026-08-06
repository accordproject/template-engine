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

import preciseAmountDrafter from '../src/drafting/PreciseAmount';

describe('PreciseAmount Drafter', () => {
    test('should format PreciseAmount with zero value', () => {
        const amount = { unscaledValue: '0', unit: { scale: 2, code: 'USD' } };
        expect(preciseAmountDrafter(amount)).toBe('0.00 USD');
    });

    test('should format PreciseAmount with positive value', () => {
        const amount = { unscaledValue: '123400', unit: { scale: 2, code: 'USD' } };
        expect(preciseAmountDrafter(amount)).toBe('1234.00 USD');
    });

    test('should zero-pad when scale exceeds digit count', () => {
        const amount = { unscaledValue: '1', unit: { scale: 2, code: 'USD' } };
        expect(preciseAmountDrafter(amount)).toBe('0.01 USD');
    });

    test('should zero-pad negative values when scale exceeds digit count', () => {
        const amount = { unscaledValue: '-1', unit: { scale: 2, code: 'USD' } };
        expect(preciseAmountDrafter(amount)).toBe('-0.01 USD');
    });

    test('should fall back to plain string for out-of-JS-range formatted value', () => {
        // A value with 400 digits overflows IEEE-754 double → Infinity
        const amount = { unscaledValue: '9'.repeat(400), unit: { scale: 2, code: 'USD' } };
        const result = preciseAmountDrafter(amount, 'K 0,0.00 CCC');
        expect(result).toContain('USD');
        expect(result).not.toBe('Infinity USD');
    });

    test('should format PreciseAmount with negative value', () => {
        const amount = { unscaledValue: '-123400', unit: { scale: 2, code: 'USD' } };
        expect(preciseAmountDrafter(amount)).toBe('-1234.00 USD');
    });

    test('should format PreciseAmount with scale 0', () => {
        const amount = { unscaledValue: '1234', unit: { scale: 0, code: 'USD' } };
        expect(preciseAmountDrafter(amount)).toBe('1234 USD');
    });

    test('should format PreciseAmount with custom format string', () => {
        const amount = { unscaledValue: '123400', unit: { scale: 2, code: 'USD' } };
        expect(preciseAmountDrafter(amount, 'K 0,0.00 CCC')).toBe('$ 1,234.00 USD');
    });
});



