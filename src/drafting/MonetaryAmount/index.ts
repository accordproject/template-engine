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

import { draftDoubleIEEE } from '../Double/format';
import { draftDoubleFormat } from '../Double/format';
import { MonetaryAmountFormat } from '../DraftFormat';
import { replaceCurrencyTokens } from './formatTokens';

type MonetaryAmount = {
    doubleValue: number;
    currencyCode: string;
};

/**
 * Creates a drafter for monetary amount with no format
 * @param {object} value the monetary amount
 * @returns {string} the text
 */
function monetaryAmountDefaultDrafter(value:MonetaryAmount) {
    return '' + draftDoubleIEEE(value.doubleValue) + ' ' + value.currencyCode;
}


/**
 * Creates a drafter for monetary amount with a given format
 * @param {object} value the monetary amount
 * @param {string} format the format
 * @returns {string} the text
 */
function monetaryAmountFormatDrafter(value:MonetaryAmount,format:MonetaryAmountFormat) : string {
    return draftDoubleFormat(value.doubleValue, replaceCurrencyTokens(format, value.currencyCode));
}

/**
 * Creates a drafter for a monetary amount
 * @param {object} value the monetary amount
 * @param {string} format the format
 * @returns {string} the text
 */
export default function monetaryAmountDrafter(value:MonetaryAmount,format?:MonetaryAmountFormat) : string {
    if (format) {
        return monetaryAmountFormatDrafter(value,format);
    } else {
        return monetaryAmountDefaultDrafter(value);
    }
}