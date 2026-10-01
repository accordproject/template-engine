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
exports.codeSymbol = codeSymbol;
exports.replaceCurrencyTokens = replaceCurrencyTokens;
const currencycode_1 = require("./currencycode");
/**
 * Symbol from a currency code
 * @param {string} c - the currency code
 * @returns {string} the symbol
 */
function codeSymbol(c) {
    const index = Object.keys(currencycode_1.CurrencyCode).indexOf(c);
    if (index >= 0) {
        return Object.values(currencycode_1.CurrencyCode)[index];
    }
    else {
        return c;
    }
}
/**
 * Replaces currency tokens (K for symbol, CCC for code) in a format string
 * @param {string} format - the format string
 * @param {string} code - the currency code
 * @returns {string} the format string with tokens replaced
 */
function replaceCurrencyTokens(format, code) {
    return format
        .replace(/K/gi, codeSymbol(code))
        .replace(/CCC/gi, code);
}
//# sourceMappingURL=formatTokens.js.map