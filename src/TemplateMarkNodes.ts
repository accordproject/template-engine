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

import { TemplateMarkModel } from '@accordproject/markdown-common';

// use to create agreementmark from templatemark
export const TEMPLATEMARK_RE = /^(org\.accordproject\.templatemark)@(.+)\.(\w+)Definition$/;
export const FORMULA_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormulaDefinition$/;
export const VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.VariableDefinition$/;
export const CONDITIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ConditionalDefinition$/;
export const ENUM_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.EnumVariableDefinition$/;
export const FORMATTED_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormattedVariableDefinition$/;
export const WITH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.WithDefinition$/;
export const LISTBLOCK_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ListBlockDefinition$/;
export const JOIN_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.JoinDefinition$/;
export const OPTIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.OptionalDefinition$/;
export const CLAUSE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ClauseDefinition$/;
export const CONTRACT_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ContractDefinition$/;
export const FOREACH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ForeachDefinition$/;

export type TemplateData = Record<string, unknown>;

/**
 * TemplateMark nodes that implicity change the data access scope
 * by specifying the name of a property on the node.
 */
export const NAVIGATION_NODES = [
    `${TemplateMarkModel.NAMESPACE}.ListBlockDefinition`,
    `${TemplateMarkModel.NAMESPACE}.WithDefinition`,
    `${TemplateMarkModel.NAMESPACE}.JoinDefinition`,
    `${TemplateMarkModel.NAMESPACE}.OptionalDefinition`,
    `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
    `${TemplateMarkModel.NAMESPACE}.ForeachBlockDefinition`
];