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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDrafter = getDrafter;
/* eslint-disable @typescript-eslint/no-explicit-any */
const Boolean_1 = __importDefault(require("./Boolean"));
const DateTime_1 = __importDefault(require("./DateTime"));
const Double_1 = __importDefault(require("./Double"));
const Integer_1 = __importDefault(require("./Integer"));
const Duration_1 = __importDefault(require("./Duration"));
const Long_1 = __importDefault(require("./Long"));
const MonetaryAmount_1 = __importDefault(require("./MonetaryAmount"));
const PreciseAmount_1 = __importDefault(require("./PreciseAmount"));
const String_1 = __importDefault(require("./String"));
const concerto_core_1 = require("@accordproject/concerto-core");
function drafterKey(fqn) {
    if (concerto_core_1.ModelUtil.isPrimitiveType(fqn)) {
        return fqn; // Boolean, String, Integer, ...
    }
    try {
        const ns = concerto_core_1.ModelUtil.getNamespace(fqn);
        const name = concerto_core_1.ModelUtil.getShortName(fqn);
        const { name: nsName, version } = concerto_core_1.ModelUtil.parseNamespace(ns);
        const major = version ? version.split('.')[0] : '';
        return `${nsName}@${major}.${name}`;
    }
    catch {
        // Not a versioned namespace type (e.g. user-defined concept without a version).
        // Return as-is so it hits the default: null branch in getDrafter.
        return fqn;
    }
}
function getDrafter(typeName) {
    switch (drafterKey(typeName)) {
        case 'Boolean': return Boolean_1.default;
        case 'DateTime': return DateTime_1.default;
        case 'Double': return Double_1.default;
        case 'Integer': return Integer_1.default;
        case 'Long': return Long_1.default;
        case 'org.accordproject.money@0.MonetaryAmount': return MonetaryAmount_1.default;
        case 'org.accordproject.money@1.PreciseAmount': return PreciseAmount_1.default;
        case 'org.accordproject.time@0.Duration': return Duration_1.default;
        case 'org.accordproject.time@0.Period': return Duration_1.default;
        case 'String': return String_1.default;
        default: return null;
    }
}
//# sourceMappingURL=index.js.map