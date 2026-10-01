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
exports.NAVIGATION_NODES = exports.FOREACH_DEFINITION_RE = exports.CONTRACT_DEFINITION_RE = exports.CLAUSE_DEFINITION_RE = exports.OPTIONAL_DEFINITION_RE = exports.JOIN_DEFINITION_RE = exports.LISTBLOCK_DEFINITION_RE = exports.WITH_DEFINITION_RE = exports.FORMATTED_VARIABLE_DEFINITION_RE = exports.ENUM_VARIABLE_DEFINITION_RE = exports.CONDITIONAL_DEFINITION_RE = exports.VARIABLE_DEFINITION_RE = exports.FORMULA_DEFINITION_RE = exports.TEMPLATEMARK_RE = void 0;
const markdown_common_1 = require("@accordproject/markdown-common");
// use to create agreementmark from templatemark
exports.TEMPLATEMARK_RE = /^(org\.accordproject\.templatemark)@(.+)\.(\w+)Definition$/;
exports.FORMULA_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormulaDefinition$/;
exports.VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.VariableDefinition$/;
exports.CONDITIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ConditionalDefinition$/;
exports.ENUM_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.EnumVariableDefinition$/;
exports.FORMATTED_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormattedVariableDefinition$/;
exports.WITH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.WithDefinition$/;
exports.LISTBLOCK_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ListBlockDefinition$/;
exports.JOIN_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.JoinDefinition$/;
exports.OPTIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.OptionalDefinition$/;
exports.CLAUSE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ClauseDefinition$/;
exports.CONTRACT_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ContractDefinition$/;
exports.FOREACH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ForeachDefinition$/;
/**
 * TemplateMark nodes that implicitly change the data access scope
 * by specifying the name of a property on the node.
 */
exports.NAVIGATION_NODES = [
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ListBlockDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.WithDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.JoinDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.OptionalDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ContractDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ForeachBlockDefinition`
];
//# sourceMappingURL=TemplateMarkNodes.js.map