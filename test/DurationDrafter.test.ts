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
        ['seconds', 'second'],
        ['minutes', 'minute'],
        ['hours', 'hour'],
        ['days', 'day'],
        ['weeks', 'week'],
        ['months', 'month'],
        ['quarters', 'quarter'],
        ['years', 'year'],
    ])('should use the singular of %s for an amount of 1', (unit, singular) => {
        expect(durationDrafter({ amount: 1, unit })).toBe(`1 ${singular}`);
    });

    test('should use the singular unit for an amount of -1', () => {
        expect(durationDrafter({ amount: -1, unit: 'days' })).toBe('-1 day');
    });

    test('should keep the plural unit for an amount of 0', () => {
        expect(durationDrafter({ amount: 0, unit: 'weeks' })).toBe('0 weeks');
    });

    test('should leave unknown units unchanged for an amount of 1', () => {
        expect(durationDrafter({ amount: 1, unit: 'fortnights' })).toBe('1 fortnights');
    });
});
