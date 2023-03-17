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

import { draftInteger as draftLong } from '../Integer/format';
import { draftIntegerFormat as draftLongFormat } from '../Integer/format';

/**
 * Creates a drafter for a long
 * @param {number} value - the Long
 * @param {string} format - the format
 * @returns {string} the text
 */
export default function longDrafter(value:number,format:string) : string {
    if (format) {
        return draftLongFormat(value,format);
    } else {
        return draftLong(value);
    }
}