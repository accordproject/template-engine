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

import durationDrafter from '../src/drafting/Duration';
import { getDrafter } from '../src/drafting';

// Locales differ in which space goes between the amount and the unit
// (French uses a no-break space for some units), and that can vary
// between ICU versions, so the locale tests compare with plain spaces.
const plainSpaces = (text: string) => text.replace(/\s/gu, ' ');

describe('Duration Drafter', () => {
    test('should format Duration with days', () => {
        const duration = { amount: 2, unit: 'days' };
        expect(durationDrafter(duration)).toBe('2 days');
    });

    test('should format Duration with hours', () => {
        const duration = { amount: 24, unit: 'hours' };
        expect(durationDrafter(duration)).toBe('24 hours');
    });

    test('should format Period with months', () => {
        const period = { amount: 3, unit: 'months' };
        expect(durationDrafter(period)).toBe('3 months');
    });

    test('should format Duration with singular unit', () => {
        const duration = { amount: 1, unit: 'day' };
        expect(durationDrafter(duration)).toBe('1 day');
    });

    test.each([
        ['seconds', '1 second'],
        ['minutes', '1 minute'],
        ['hours', '1 hour'],
        ['days', '1 day'],
        ['weeks', '1 week'],
        ['months', '1 month'],
        ['years', '1 year'],
    ])('should draft an amount of 1 %s in the singular', (unit, expected) => {
        expect(durationDrafter({ amount: 1, unit })).toBe(expected);
    });

    test('should use the singular unit for an amount of -1', () => {
        expect(durationDrafter({ amount: -1, unit: 'days' })).toBe('-1 day');
    });

    test('should keep the plural unit for an amount of 0', () => {
        expect(durationDrafter({ amount: 0, unit: 'weeks' })).toBe('0 weeks');
    });

    test('should not group the digits of the amount', () => {
        expect(durationDrafter({ amount: 1000, unit: 'days' })).toBe('1000 days');
    });

    test.each([
        ['fr', 1, 'days', '1 jour'],
        ['fr', 2, 'days', '2 jours'],
        ['de', 2, 'years', '2 Jahre'],
        ['hu', 2, 'days', '2 nap'],
        ['ar', 2, 'days', 'يومان'],
        ['zh', 2, 'days', '2天'],
    ])('should draft in the %s locale (%d %s)', (locale, amount, unit, expected) => {
        expect(plainSpaces(durationDrafter({ amount, unit }, undefined, locale))).toBe(expected);
    });

    test('should draft quarters with the enum value, as Intl has no unit for them', () => {
        expect(durationDrafter({ amount: 2, unit: 'quarters' })).toBe('2 quarters');
    });

    test('should leave unknown units unchanged for an amount of 1', () => {
        expect(durationDrafter({ amount: 1, unit: 'fortnights' })).toBe('1 fortnights');
    });

    test.each(['constructor', 'toString', '__proto__'])(
        'should not resolve %s through the object prototype',
        (unit) => {
            expect(durationDrafter({ amount: 1, unit })).toBe(`1 ${unit}`);
        },
    );

    test('should receive the locale through getDrafter', () => {
        const drafter = getDrafter('org.accordproject.time@0.3.0.Period');
        expect(drafter).not.toBeNull();
        expect(plainSpaces(drafter!({ amount: 3, unit: 'months' }, undefined, 'fr'))).toBe('3 mois');
    });
});
