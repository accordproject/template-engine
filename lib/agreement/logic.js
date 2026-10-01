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
exports.conceptType = conceptType;
exports.identifiedType = identifiedType;
exports.defineLogic = defineLogic;
exports.isLogic = isLogic;
function conceptType() {
    return ($class) => ({
        $class,
        create: fields => ({ $class, ...fields }),
        is: (value) => value?.$class === $class,
    });
}
function identifiedType() {
    return ($class, identifiedBy) => ({
        ...conceptType()($class),
        create: fields => ({ $class, $identifier: String(fields[identifiedBy]), ...fields }),
        ref: (id) => `resource:${$class}#${id}`,
    });
}
class LogicDefinition {
    constructor(handlers = new Map(), initHandler) {
        this.handlers = handlers;
        this.initHandler = initHandler;
    }
    init(handler) {
        if (this.initHandler) {
            throw new Error('init() is already registered.');
        }
        return new LogicDefinition(this.handlers, handler);
    }
    on(type, handler) {
        if (this.handlers.has(type.$class)) {
            throw new Error(`A handler is already registered for ${type.$class}.`);
        }
        const handlers = new Map(this.handlers).set(type.$class, handler);
        return new LogicDefinition(handlers, this.initHandler);
    }
    get requestTypes() {
        return [...this.handlers.keys()];
    }
    get hasInit() {
        return this.initHandler !== undefined;
    }
    async start(self) {
        await this.initHandler?.(self);
    }
    async handle(request, self, supertypes = () => []) {
        const type = [request.$class, ...supertypes(request.$class)].find(t => this.handlers.has(t));
        if (!type) {
            throw new Error(`No handler for ${request.$class}.`);
        }
        return this.handlers.get(type)(request, self);
    }
}
/** Starts a template's logic; `S` is its `Self` type. */
function defineLogic() {
    return new LogicDefinition();
}
/** Whether `value` is a template's logic, as `defineLogic` makes it. */
function isLogic(value) {
    const logic = value;
    return !!logic && typeof logic.handle === 'function' && typeof logic.start === 'function' && Array.isArray(logic.requestTypes);
}
//# sourceMappingURL=logic.js.map