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
});
