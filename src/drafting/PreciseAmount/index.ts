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

import { MonetaryAmountFormat } from '../DraftFormat';
import { replaceCurrencyTokens } from '../MonetaryAmount/formatTokens';

export type PreciseAmount = {
    unscaledValue: string;
    unit: {
        code: string;
        scheme?: string;
        identifier?: string;
        scale: number;
    };
};


/**
 * Helper to reconstruct the decimal string representation of a PreciseAmount
 * without losing precision via JavaScript floats.
 */
function reconstructDecimalString(value: string, scale: number): string {
    if (scale === 0) return value;
    
    let isNegative = false;
    let absValue = value;
    if (absValue.startsWith('-')) {
        isNegative = true;
        absValue = absValue.substring(1);
    }
    
    if (absValue.length <= scale) {
        absValue = absValue.padStart(scale + 1, '0');
    }
    
    const insertPos = absValue.length - scale;
    const integerPart = absValue.substring(0, insertPos);
    const decimalPart = absValue.substring(insertPos);
    
    let result = `${integerPart}.${decimalPart}`;
    if (isNegative) {
        result = '-' + result;
    }
    return result;
}

/**
 * Creates a drafter for precise amount with no format
 * @param {object} value the precise amount
 * @returns {string} the text
 */
function preciseAmountDefaultDrafter(value:PreciseAmount) {
    return reconstructDecimalString(value.unscaledValue, value.unit.scale) + ' ' + value.unit.code;
}

/**
 * Creates a drafter for precise amount with a given format
 * @param {object} value the precise amount
 * @param {string} format the format
 * @returns {string} the text
 */
function preciseAmountFormatDrafter(value:PreciseAmount,format:MonetaryAmountFormat) : string {
    const strValue = reconstructDecimalString(value.unscaledValue, value.unit.scale);
    const formatWithTokens = replaceCurrencyTokens(format, value.unit.code);

    return formatWithTokens.replace(/0(.)0((.)(0+))?/gi, function(_a,sep1,_b,sep2,digits){
        const len = digits ? digits.length : 0;
        
        const parts = strValue.split('.');
        let integerPart = parts[0];
        let decimalPart = parts.length > 1 ? parts[1] : '';

        // Adjust decimal part to 'len' digits
        if (len === 0) {
            decimalPart = '';
        } else {
            if (decimalPart.length > len) {
                // Truncate without rounding (to preserve strict string handling without complex BigInt math)
                decimalPart = decimalPart.substring(0, len);
            } else {
                decimalPart = decimalPart.padEnd(len, '0');
            }
        }

        let res = '';
        if (sep2 && len > 0) {
            res += sep2 + decimalPart;
        }

        let isNegative = false;
        if (integerPart.startsWith('-')) {
            isNegative = true;
            integerPart = integerPart.substring(1);
        }

        // Apply grouping (sep1)
        while (integerPart.length > 3) {
            res = sep1 + integerPart.substring(integerPart.length - 3) + res;
            integerPart = integerPart.substring(0, integerPart.length - 3);
        }
        res = integerPart + res;

        if (isNegative) {
            res = '-' + res;
        }

        return res;
    });
}

/**
 * Creates a drafter for a precise amount
 * @param {object} value the precise amount
 * @param {string} format the format
 * @returns {string} the text
 */
export default function preciseAmountDrafter(value:PreciseAmount,format?:MonetaryAmountFormat) : string {
    if (format) {
        return preciseAmountFormatDrafter(value,format);
    } else {
        return preciseAmountDefaultDrafter(value);
    }
}
