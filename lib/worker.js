"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const dayjs_1 = __importDefault(require("dayjs"));
const jsonpath_1 = __importDefault(require("jsonpath"));
/**
 * This executed JS code inside a child process, so that the code
 * has no access to the parent process and can be terminated on timeout etc
 * We do not use Node.js Cluster to ensure that each child process that is
 * forked is not reused and cannot be polluted by previous calls.
 */
process.on('message', (msg) => {
    if (!process.send) {
        throw new Error('Cannot communicate with parent process!');
    }
    // we wrap the code in "use strict" to so the code cannot access the global scope
    const code = `"use strict";
    ${msg.code}
    `;
    try {
        // we expose just two node modules to the function: 'dayjs' and 'jsonpath'
        const argNames = ['dayjs', 'jp', ...msg.argumentNames];
        const args = [dayjs_1.default, jsonpath_1.default, ...msg.arguments];
        const fun = new Function(...argNames, code);
        const result = fun(...args);
        process.send({ result }, () => {
            process.exit();
        });
    }
    catch (err) {
        // console.log(`worker: ${err} ${msg.code}`);
        process.send({ message: err.toString() }, () => {
            process.exit(1);
        });
    }
});
//# sourceMappingURL=worker.js.map