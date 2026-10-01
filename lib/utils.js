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
exports.STATE_DATA_FQN = exports.TEMPLATE_DATA_FQN = exports.RUNTIME_1_RESPONSE_FQN = exports.RUNTIME_1_REQUEST_FQN = exports.RUNTIME_CONTRACT_FQN = exports.RUNTIME_OBLIGATION_FQN = exports.BASE_EVENT_FQN = exports.RUNTIME_RESPONSE_FQN = exports.RUNTIME_REQUEST_FQN = exports.RUNTIME_STATE_FQN = void 0;
exports.getAssignableConcreteTypes = getAssignableConcreteTypes;
exports.isAssignableTo = isAssignableTo;
exports.ensureDirSync = ensureDirSync;
exports.removeSync = removeSync;
exports.writeFunctionToString = writeFunctionToString;
exports.nameUserCode = nameUserCode;
exports.getTemplateClassDeclaration = getTemplateClassDeclaration;
/* eslint-disable @typescript-eslint/no-explicit-any */
const concerto_core_1 = require("@accordproject/concerto-core");
const markdown_common_1 = require("@accordproject/markdown-common");
const markdown_template_1 = require("@accordproject/markdown-template");
const fs_1 = require("fs");
const traverse_1 = __importDefault(require("traverse"));
// Fully-qualified names of the runtime base types that logic types must be, or extend.
// Request / Response / State are concrete in org.accordproject.runtime@0.2.0, so a template
// may use the bare base type. Events bind to the base Concerto Event (a plain Event or a
// specialized Obligation both extend it); Obligation itself is abstract. Shared by the
// compilation context (compile-time unions) and the archive processor (runtime $class
// hierarchy checks).
exports.RUNTIME_STATE_FQN = 'org.accordproject.runtime@0.2.0.State';
exports.RUNTIME_REQUEST_FQN = 'org.accordproject.runtime@0.2.0.Request';
exports.RUNTIME_RESPONSE_FQN = 'org.accordproject.runtime@0.2.0.Response';
exports.BASE_EVENT_FQN = 'concerto@1.0.0.Event';
exports.RUNTIME_OBLIGATION_FQN = 'org.accordproject.runtime@0.2.0.Obligation';
exports.RUNTIME_CONTRACT_FQN = 'org.accordproject.contract@0.2.0.Contract';
// The same base types in org.accordproject.runtime@1.0.0, where a template's data and state
// extend org.accordproject.templatedata@1.0.0 TemplateData and StateData. A template uses
// one runtime or the other; the archive processor accepts either.
exports.RUNTIME_1_REQUEST_FQN = 'org.accordproject.runtime@1.0.0.Request';
exports.RUNTIME_1_RESPONSE_FQN = 'org.accordproject.runtime@1.0.0.Response';
exports.TEMPLATE_DATA_FQN = 'org.accordproject.templatedata@1.0.0.TemplateData';
exports.STATE_DATA_FQN = 'org.accordproject.templatedata@1.0.0.StateData';
/**
 * Returns the concrete (non-abstract) class declarations assignable to baseFqn: the base
 * type itself (when concrete) plus every subclass of it. Returns an empty array when
 * baseFqn is not present in the model. This is the single source of truth for the runtime
 * type hierarchy — used both to build the compile-time unions (TypeScriptCompilationContext)
 * and to check payloads at runtime (TemplateArchiveProcessor).
 *
 * TODO: migrate to a Concerto-provided helper once available — see
 * https://github.com/accordproject/concerto/issues/1281
 * @param {ModelManager} modelManager - the model manager to resolve types against
 * @param {string} baseFqn - the fully-qualified name of the runtime base type
 * @returns {ClassDeclaration[]} the concrete assignable declarations (base + subclasses)
 */
function getAssignableConcreteTypes(modelManager, baseFqn) {
    let baseType;
    try {
        baseType = modelManager.getType(baseFqn);
    }
    catch {
        // The base type is not loaded in this model (e.g. a text-only template with no logic).
        return [];
    }
    return baseType.getAssignableClassDeclarations().filter((decl) => !decl.isAbstract());
}
/**
 * Returns true when the type identified by fqn is, or extends, baseFqn (restricted to
 * concrete types). Used to enforce the runtime class hierarchy against a payload's $class.
 * @param {ModelManager} modelManager - the model manager to resolve types against
 * @param {string} fqn - the fully-qualified name of the candidate type
 * @param {string} baseFqn - the fully-qualified name of the runtime base type
 * @returns {boolean} true if fqn is, or extends, baseFqn
 */
function isAssignableTo(modelManager, fqn, baseFqn) {
    return getAssignableConcreteTypes(modelManager, baseFqn)
        .some((decl) => decl.getFullyQualifiedName() === fqn);
}
function ensureDirSync(path) {
    if (!(0, fs_1.existsSync)(path)) {
        (0, fs_1.mkdirSync)(path, { recursive: true });
    }
}
function removeSync(path) {
    (0, fs_1.rmSync)(path, { recursive: true, force: true });
}
function writeFunctionToString(templateClass, functionName, returnType, code) {
    let result = '';
    result += '/// ---cut---\n';
    result += `export function ${functionName}(data:TemplateModel.I${templateClass.getName()}, library:any, options:GenerationOptions) : ${returnType} {\n`;
    result += '   const now = dayjs(options?.now);\n';
    result += '   const locale = options?.locale;\n';
    templateClass.getProperties().forEach((p) => {
        result += `   const ${p.getName()} = data.${p.getName()};\n`;
    });
    result += '   ' + code.trim() + '\n';
    result += '}\n';
    result += '\n';
    return result;
}
function nameUserCode(templateMarkDom) {
    return (0, traverse_1.default)(templateMarkDom).map(function (x) {
        if (x && ((x.$class === `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ConditionalDefinition` && x.condition) ||
            (x.$class === `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ClauseDefinition` && x.condition))) {
            x.functionName = `condition_${this.path.join('_')}`;
        }
        this.update(x);
    });
}
function getTemplateClassDeclaration(modelManager, templateConceptFqn) {
    const introspector = new concerto_core_1.Introspector(modelManager);
    try {
        return markdown_template_1.templatemarkutil.findTemplateConcept(introspector, 'clause', templateConceptFqn);
    }
    catch (err) {
        console.log(err);
        throw err;
    }
}
//# sourceMappingURL=utils.js.map