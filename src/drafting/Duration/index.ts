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

type Duration = {
    amount: number;
    unit: string;
};

/**
 * Type guard to check if a value is a valid Duration
 */
function isDuration(value: unknown): value is Duration {
    return (
        value != null &&
        typeof value === 'object' &&
        'amount' in value &&
        'unit' in value &&
        typeof (value as Duration).amount === 'number' &&
        typeof (value as Duration).unit === 'string'
    );
}

/**
 * Singular forms of the TemporalUnit and PeriodUnit enum values,
 * which are declared in the plural in org.accordproject.time
 */
const SINGULAR_UNITS: Record<string, string> = {
    seconds: 'second',
    minutes: 'minute',
    hours: 'hour',
    days: 'day',
    weeks: 'week',
    months: 'month',
    quarters: 'quarter',
    years: 'year',
};

/**
 * Creates a drafter for Duration/Period types
 * @param {unknown} value the duration or period (validated at runtime)
 * @returns {string} the text (e.g., "2 days" or "1 day")
 */
export default function durationDrafter(value: unknown): string {
    if (!isDuration(value)) {
        return '0 unknown';
    }

    const unit = Math.abs(value.amount) === 1
        ? SINGULAR_UNITS[value.unit] ?? value.unit
        : value.unit;
    return `${value.amount} ${unit}`;
}
