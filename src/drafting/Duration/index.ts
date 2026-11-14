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

import { DraftFormat } from '../DraftFormat';

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
 * Intl unit identifiers for the TemporalUnit and PeriodUnit values in
 * org.accordproject.time. Intl supplies the words, plural forms and word
 * order for the locale. It has no unit for quarters, so those fall back
 * to the enum value.
 */
const INTL_UNITS: ReadonlyMap<string, string> = new Map([
    ['seconds', 'second'],
    ['minutes', 'minute'],
    ['hours', 'hour'],
    ['days', 'day'],
    ['weeks', 'week'],
    ['months', 'month'],
    ['years', 'year'],
]);

/**
 * The locale used when generation options do not set one
 */
const DEFAULT_LOCALE = 'en';

/**
 * Creates a drafter for Duration/Period types
 * @param {unknown} value the duration or period (validated at runtime)
 * @param {DraftFormat} [format] the format (not used)
 * @param {string} [locale] the locale to draft in, 'en' if not set or empty
 * @returns {string} the text (e.g., "2 days" in 'en', "2 jours" in 'fr')
 */
export default function durationDrafter(value: unknown, format?: DraftFormat, locale?: string): string {
    if (!isDuration(value)) {
        return '0 unknown';
    }

    const unit = INTL_UNITS.get(value.unit);
    if (!unit) {
        return `${value.amount} ${value.unit}`;
    }

    // An empty string is not a valid locale for Intl, so treat it as unset
    return new Intl.NumberFormat(locale || DEFAULT_LOCALE, {
        style: 'unit',
        unit,
        unitDisplay: 'long',
        useGrouping: false,
    }).format(value.amount);
}
