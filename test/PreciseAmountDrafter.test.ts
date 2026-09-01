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

    // --- Non-2 scale currencies ---

    test('JPY: scale 0 integer-only currency', () => {
        const amount = { unscaledValue: '1234', unit: { scale: 0, code: 'JPY' } };
        expect(preciseAmountDrafter(amount)).toBe('1234 JPY');
    });

    test('JPY: scale 0 with format string', () => {
        const amount = { unscaledValue: '1234', unit: { scale: 0, code: 'JPY' } };
        expect(preciseAmountDrafter(amount, 'K 0,0 CCC')).toBe('¥ 1,234 JPY');
    });

    test('KWD: scale 3 (Kuwaiti Dinar)', () => {
        const amount = { unscaledValue: '123456', unit: { scale: 3, code: 'KWD' } };
        expect(preciseAmountDrafter(amount)).toBe('123.456 KWD');
    });

    test('KWD: scale 3, value less than 1', () => {
        const amount = { unscaledValue: '1', unit: { scale: 3, code: 'KWD' } };
        expect(preciseAmountDrafter(amount)).toBe('0.001 KWD');
    });

    test('USDC: scale 6 stablecoin, exactly 1 token', () => {
        const amount = { unscaledValue: '1000000', unit: { scale: 6, code: 'USDC' } };
        expect(preciseAmountDrafter(amount)).toBe('1.000000 USDC');
    });

    test('USDC: scale 6, fractional amount', () => {
        const amount = { unscaledValue: '123456', unit: { scale: 6, code: 'USDC' } };
        expect(preciseAmountDrafter(amount)).toBe('0.123456 USDC');
    });

    test('USDC: scale 6, negative value', () => {
        const amount = { unscaledValue: '-500000', unit: { scale: 6, code: 'USDC' } };
        expect(preciseAmountDrafter(amount)).toBe('-0.500000 USDC');
    });

    // --- ETH / high-precision tokens (scale 18) ---

    test('ETH: exactly 1 ETH (1e18 wei)', () => {
        const amount = { unscaledValue: '1000000000000000000', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('1.000000000000000000 ETH');
    });

    test('ETH: 0.1 ETH (17-digit unscaledValue)', () => {
        const amount = { unscaledValue: '100000000000000000', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('0.100000000000000000 ETH');
    });

    test('ETH: 1 wei — smallest possible unit (1 < scale digits)', () => {
        const amount = { unscaledValue: '1', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('0.000000000000000001 ETH');
    });

    test('ETH: preserves trailing precision digit that JS float would lose', () => {
        // 1 ETH + 1 wei: as a JS Number this rounds to exactly 1e18, losing the last digit
        const amount = { unscaledValue: '1000000000000000001', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('1.000000000000000001 ETH');
    });

    test('ETH: 19-digit unscaledValue (10 ETH)', () => {
        const amount = { unscaledValue: '10000000000000000000', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('10.000000000000000000 ETH');
    });

    test('ETH: 20-digit unscaledValue (100 ETH) with precision in fractional part', () => {
        const amount = { unscaledValue: '100000000000000000001', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('100.000000000000000001 ETH');
    });

    test('ETH: negative 1 wei', () => {
        const amount = { unscaledValue: '-1', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('-0.000000000000000001 ETH');
    });

    test('ETH: negative 1 ETH + 1 wei, precision preserved', () => {
        const amount = { unscaledValue: '-1000000000000000001', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount)).toBe('-1.000000000000000001 ETH');
    });

    test('ETH: formatted with grouping separator, large amount', () => {
        // 1234.5 ETH expressed as unscaled wei
        const amount = { unscaledValue: '1234500000000000000000', unit: { scale: 18, code: 'ETH' } };
        expect(preciseAmountDrafter(amount, 'K 0,0.000000000000000000 CCC')).toBe('ETH 1,234.500000000000000000 ETH');
    });

    test('ETH: unknown symbol falls back to currency code in format', () => {
        const amount = { unscaledValue: '1000000000000000000', unit: { scale: 18, code: 'ETH' } };
        // K token should resolve to 'ETH' since ETH is not in the CurrencyCode enum
        const result = preciseAmountDrafter(amount, 'K 0,0.00 CCC');
        expect(result).toContain('ETH');
    });

    // --- Scale 8 (BTC-style) ---

    test('BTC: scale 8, exactly 1 BTC', () => {
        const amount = { unscaledValue: '100000000', unit: { scale: 8, code: 'BTC' } };
        expect(preciseAmountDrafter(amount)).toBe('1.00000000 BTC');
    });

    test('BTC: scale 8, 1 satoshi', () => {
        const amount = { unscaledValue: '1', unit: { scale: 8, code: 'BTC' } };
        expect(preciseAmountDrafter(amount)).toBe('0.00000001 BTC');
    });

    test('BTC: scale 8, large value with precision preserved', () => {
        // 21_000_000 BTC (supply cap) in satoshis: 2100000000000000
        const amount = { unscaledValue: '2100000000000000', unit: { scale: 8, code: 'BTC' } };
        expect(preciseAmountDrafter(amount)).toBe('21000000.00000000 BTC');
    });
});



