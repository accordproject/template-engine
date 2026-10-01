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
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinList = joinList;
exports.peek = peek;
exports.peekProperty = peekProperty;
exports.push = push;
exports.addChild = addChild;
exports.pop = pop;
const DEBUG = false;
function joinList(data, joinDef, options) {
    if (joinDef.separator) {
        return data.join(joinDef.separator);
    }
    else {
        const formatter = new Intl.ListFormat(joinDef.locale ? joinDef.locale : options?.locale, {
            style: joinDef.style,
            type: joinDef.type
        });
        return formatter.format(data);
    }
}
/**
 * These utility functions are used by the typescript code that
 * is generated from TemplateMark. They manage a stack to improve
 * debuggability.
 */
function dump(op, $data) {
    if (DEBUG) {
        console.log(`${op}: ${JSON.stringify($data)}`);
    }
}
function peek($data) {
    if ($data.length <= 0) {
        throw new Error('Empty array');
    }
    const result = $data[$data.length - 1];
    dump('peek', $data);
    return result;
}
function peekProperty($data, propertyName, allowUndefined = false) {
    const head = peek($data);
    const result = head[propertyName];
    if (!allowUndefined && result === undefined) {
        throw new Error(`Undefined property ${propertyName}. Current stack is ${JSON.stringify($data)}`);
    }
    return result;
}
function push($data, item) {
    const result = $data.push(item);
    dump('push', $data);
    return result;
}
function addChild($data, item) {
    const node = peek($data);
    if (node.nodes) {
        node.nodes.push(item);
    }
    else {
        node.nodes = [item];
    }
}
function pop($data) {
    if ($data.length <= 0) {
        throw new Error('Empty array');
    }
    const result = $data.pop();
    dump('pop', $data);
    return result;
}
//# sourceMappingURL=TypeScriptRuntime.js.map