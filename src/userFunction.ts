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

import dayjs from 'dayjs';
import jp from 'jsonpath';
import { Temporal } from './temporal';

/**
 * Creates a function from the compiled code of a formula or condition.
 *
 * The modules exposed to user code (dayjs, jsonpath as `jp`, and `Temporal`) are
 * bound in an enclosing scope rather than passed as parameters. The code declares a
 * variable for each template property, and a property can then share a name with one
 * of these modules (a property called `Temporal`, for example): the property shadows
 * the module instead of redeclaring a parameter, which is a SyntaxError.
 * @param {string[]} argumentNames - the names of the function's parameters
 * @param {string} code - the body of the function
 * @param {boolean} [strict] - true to evaluate the code in strict mode
 * @returns {Function} the function
 */
export function createUserFunction(argumentNames: string[], code: string, strict = false): (...args: unknown[]) => unknown {
    const directive = strict ? '"use strict";\n' : '';
    const body = `return function (${argumentNames.join(', ')}) {\n${directive}${code}\n};`;
    return new Function('dayjs', 'jp', 'Temporal', body)(dayjs, jp, Temporal);
}
