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
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = integerDrafter;
const format_1 = require("./format");
const format_2 = require("./format");
/**
 * Creates a drafter for an Integer
 * @param {number} value - the integer
 * @param {NumberDraftFormat} format - the format
 * @returns {string} the text
 */
function integerDrafter(value, format) {
    if (format) {
        return (0, format_2.draftIntegerFormat)(value, format);
    }
    else {
        return (0, format_1.draftInteger)(value);
    }
}
//# sourceMappingURL=index.js.map