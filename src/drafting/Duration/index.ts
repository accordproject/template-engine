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
 * Creates a drafter for Duration/Period types
 * @param {object} value the duration or period
 * @returns {string} the text (e.g., "2 days")
 */
export default function durationDrafter(value: Duration): string {
    // Validate input to avoid runtime errors
    if (value == null || typeof value !== 'object') {
        return '0 unknown';
    }

    const amount = typeof value.amount === 'number' ? value.amount : 0;
    const unit = typeof value.unit === 'string' && value.unit ? value.unit : 'unknown';

    return `${amount} ${unit}`;
}
