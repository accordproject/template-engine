"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = monetaryAmountDrafter;
const format_1 = require("../Double/format");
const format_2 = require("../Double/format");
const formatTokens_1 = require("./formatTokens");
/**
 * Creates a drafter for monetary amount with no format
 * @param {object} value the monetary amount
 * @returns {string} the text
 */
function monetaryAmountDefaultDrafter(value) {
    return '' + (0, format_1.draftDoubleIEEE)(value.doubleValue) + ' ' + value.currencyCode;
}
/**
 * Creates a drafter for monetary amount with a given format
 * @param {object} value the monetary amount
 * @param {string} format the format
 * @returns {string} the text
 */
function monetaryAmountFormatDrafter(value, format) {
    return (0, format_2.draftDoubleFormat)(value.doubleValue, (0, formatTokens_1.replaceCurrencyTokens)(format, value.currencyCode));
}
/**
 * Creates a drafter for a monetary amount
 * @param {object} value the monetary amount
 * @param {string} format the format
 * @returns {string} the text
 */
function monetaryAmountDrafter(value, format) {
    if (format) {
        return monetaryAmountFormatDrafter(value, format);
    }
    else {
        return monetaryAmountDefaultDrafter(value);
    }
}
//# sourceMappingURL=index.js.map