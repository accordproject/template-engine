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
exports.TemplateMarkToJavaScriptCompiler = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const traverse_1 = __importDefault(require("traverse"));
const markdown_common_1 = require("@accordproject/markdown-common");
const TypeScriptToJavaScriptCompiler_1 = require("./TypeScriptToJavaScriptCompiler");
const org_accordproject_templatemark_0_5_0_1 = require("./model-gen/org.accordproject.templatemark@0.5.0");
const utils_1 = require("./utils");
const CODE_NODES = [
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.FormulaDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ConditionalDefinition`,
    `${markdown_common_1.TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
];
function checkCode(code) {
    if (code.type !== org_accordproject_templatemark_0_5_0_1.CodeType.TYPESCRIPT) {
        throw new Error(`Cannot compile ${code.contents} as it is not Typescript.`);
    }
}
/**
 * Compiles all the Typescript nodes in a TemplateMark JSON
 * to ES_2020 and returns a modified TemplateMark JSON.
 */
class TemplateMarkToJavaScriptCompiler {
    constructor(modelManager, templateConceptFqn) {
        this.modelManager = modelManager;
        this.compiler = new TypeScriptToJavaScriptCompiler_1.TypeScriptToJavaScriptCompiler(modelManager, templateConceptFqn);
        this.templateClass = (0, utils_1.getTemplateClassDeclaration)(modelManager, templateConceptFqn);
    }
    async initialize() {
        await this.compiler.initialize();
    }
    compile(templateJson) {
        const namedTemplateMark = (0, utils_1.nameUserCode)(templateJson);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;
        const errors = Array();
        const compiled = (0, traverse_1.default)(namedTemplateMark).map(function (x) {
            if (x && CODE_NODES.includes(x.$class)) {
                if (x.code) { // formula
                    checkCode(x.code);
                    const result = that.compiler.compile((0, utils_1.writeFunctionToString)(that.templateClass, x.name, 'any', x.code.contents));
                    if (result.errors.length === 0) {
                        x.code.contents = result.code;
                        x.code.type = org_accordproject_templatemark_0_5_0_1.CodeType.ES_2020;
                        this.update(x);
                    }
                    else {
                        errors.push({
                            nodeId: x.name,
                            code: x.code.contents,
                            errors: result.errors
                        });
                    }
                }
                else if (x.condition) { // condition or clause (boolean condition)
                    checkCode(x.condition);
                    const result = that.compiler.compile((0, utils_1.writeFunctionToString)(that.templateClass, x.functionName, 'boolean', x.condition.contents));
                    if (result.errors.length === 0) {
                        x.condition.contents = result.code;
                        x.condition.type = org_accordproject_templatemark_0_5_0_1.CodeType.ES_2020;
                        this.update(x);
                    }
                    else {
                        errors.push({
                            nodeId: x.functionName,
                            code: x.condition.contents,
                            errors: result.errors
                        });
                    }
                }
            }
        });
        if (errors.length === 0) {
            return compiled;
        }
        else {
            throw errors;
        }
    }
}
exports.TemplateMarkToJavaScriptCompiler = TemplateMarkToJavaScriptCompiler;
//# sourceMappingURL=TemplateMarkToJavaScriptCompiler.js.map