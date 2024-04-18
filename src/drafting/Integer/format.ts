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

import {ToWords} from 'to-words';

/**
 * Creates a drafter for Integer
 * @param {number} value - the integer
 * @returns {string} the text
 */
export function draftInteger(value:number) : string {
    return '' + value;
}

/**
 * Creates a drafter for a formatted Integer
 * @param {number} value - the Integer
 * @param {string} format - the format
 * @returns {string} formatted integer value as string
 */
export enum DraftFormat{NUMBER='', TEXT='word'}
export function draftIntegerFormat(value:number,format:DraftFormat=DraftFormat.NUMBER) : string {
    if (format === DraftFormat.TEXT) {
        const converter:ToWords = new ToWords();
        const res:string=converter.convert(value);
        return res;
    } else {
        return format.replace(/0(.)0/gi, function(_a,sep1){
            const vs = value.toFixed(0);
            let res = '';
            let i = vs.substring(0,vs.length);
            while (i.length > 3) {
                res = sep1 + i.substring(i.length - 3) + res;
                i = i.substring(0, i.length - 3);
            }
            return i + res;
        });
    }
}