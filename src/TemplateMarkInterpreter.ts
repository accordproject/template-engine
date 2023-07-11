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

import jp from 'jsonpath';
import traverse from 'traverse';

import { ClassDeclaration, Factory, Introspector, ModelManager, Serializer } from '@accordproject/concerto-core';
import { getDrafter } from './drafting';
import { TemplateMarkModel, CommonMarkModel, CiceroMarkModel, ConcertoMetaModel } from '@accordproject/markdown-common';
import { ModelUtil } from '@accordproject/concerto-core';

import {
    TEMPLATEMARK_RE,
    FORMULA_DEFINITION_RE,
    VARIABLE_DEFINITION_RE,
    CONDITIONAL_DEFINITION_RE,
    ENUM_VARIABLE_DEFINITION_RE,
    FORMATTED_VARIABLE_DEFINITION_RE,
    WITH_DEFINITION_RE,
    LISTBLOCK_DEFINITION_RE,
    JOIN_DEFINITION_RE,
    OPTIONAL_DEFINITION_RE,
    CLAUSE_DEFINITION_RE,
    CONTRACT_DEFINITION_RE,
    TemplateData,
    NAVIGATION_NODES,
    getTemplateClassDeclaration
} from './Common';
import { TemplateMarkToJavaScriptCompiler } from './TemplateMarkToJavaScriptCompiler';
import { CodeType, ICode } from './model-gen/org.accordproject.templatemark@0.5.0';
import { GenerationOptions, joinList } from './TypeScriptRuntime';
import dayjs from 'dayjs';

function checkCode(code:ICode) {
    if(code.type !== CodeType.ES_2020) {
        throw new Error(`Cannot run ${code.contents} as it is not ES_2020 JavaScript.`);
    }
}

/**
 * Evaluates a JS expression
 * @param {*} clauseLibrary the clause library
 * @param {*} data the contract data
 * @param {string} fn the JS function (including header)
 * @param {GenerationOptions} options the generation options
 * @returns {object} the result of evaluating the expression against the data
 */
function evaluateJavaScript(clauseLibrary:object, data: TemplateData, fn: string, options?: GenerationOptions): object {
    if (!data || !fn) {
        throw new Error(`Cannot evaluate JS ${fn} against ${data}`);
    }
    const functionArgNames = new Array<string>();
    functionArgNames.push('data');
    functionArgNames.push('library');
    functionArgNames.push('options');
    functionArgNames.push('dayjs');
    functionArgNames.push('jp');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionArgValues = new Array<any>();
    functionArgValues.push(data);
    functionArgValues.push(clauseLibrary);
    functionArgValues.push(options);
    functionArgValues.push(dayjs);
    functionArgValues.push(jp);

    // chop the function header and closing
    const expression = fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}'));
    if(expression.trim().length === 0) {
        throw new Error('Empty expression');
    }
    try {
        const fun = new Function(...functionArgNames, expression); // SECURITY!
        const result = fun(...functionArgValues);
        return result;
    }
    catch(err) {
        throw new Error(`Caught error ${err} evaluating ${expression} with arguments ${functionArgValues}`);
    }
}

/**
 * Calculates a JSON path to use to retrieve data, based on a TemplatemMark tree.
 * For example, if we hit a VariableDefinition {{city}} that is nested inside a
 * WithDefinition {{#with address}} then the JSON path returned should be '$.address.city'.
 * Similarly ListBlockDefinition, JoinDefinition and OptionalDefinition also include
 * property names that must apply to their child nodes.
 * @param {*} rootData the root of the JSON document, typically this is a TemplateMark JSON
 * @param {*} currentNode the current TemplateMark node we are processing
 * @param {string[]} paths the traverse path to the current node
 * @returns {string} the JSON path to use to retrieve data
 */
function getJsonPath(rootData:any, currentNode:any, paths:string[]) : string {
    if(!currentNode) {
        throw new Error('Node must be supplied');
    }
    if(!currentNode.name) {
        throw new Error(`Node must have a name: ${JSON.stringify(currentNode)}`);
    }
    if(currentNode.name.indexOf('.') >=0) {
        // prevent JSON path injection
        throw new Error(`Invalid name property ${currentNode.name}`);
    }
    if(!paths || !paths.length || paths.length <1 ) {
        throw new Error('Paths must be supplied');
    }
    const withPath = [];
    for (let n = 1; n < paths.length; n++) {
        const sub = paths.slice(0, n);
        const obj = traverse.get(rootData, sub);
        // HACK
        // if(obj===undefined) {
        //     throw new Error(`Failed to find data with path ${sub} and data ${JSON.stringify(rootData, null, 2)}`);
        // }
        if (obj && obj.$class) {
            if(NAVIGATION_NODES.indexOf(obj.$class) >= 0) {
                withPath.push(`['${obj.name}']`);
            }
        }
    }

    if(currentNode.name !== 'this') {
        withPath.push(`['${currentNode.name}']`);
    }

    return withPath.length > 0 ? `$${withPath.join('')}` : '$';
}

/**
 * Generates an AgreementMark JSON document from a template plus data.
 * @param {ModelManager} modelManager - the template model
 * @param {*} clauseLibrary - the clause library
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @param {[GenerationOptions]} options - the generation options
 * @returns {*} the AgreementMark JSON
 */
function generateAgreement(modelManager:ModelManager, clauseLibrary:object, templateMark: object, data: TemplateData, options?:GenerationOptions): any {
    const introspector = new Introspector(modelManager);
    return traverse(templateMark).map(function (context: any) {
        let stopHere = false;
        if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;

            // rewrite node types, mapping from TemplateMark namespace to CiceroMark
            const match = nodeClass.match(TEMPLATEMARK_RE);
            if (match && match.length > 1) {
                context.$class = `${CiceroMarkModel.NAMESPACE}.${match[3]}`;
            }

            // convert a contract node to a clause note HACK
            if (CONTRACT_DEFINITION_RE.test(nodeClass)) {
                context.$class = `${CommonMarkModel.NAMESPACE}.Paragraph`;
                delete context.name;
                delete context.elementType;
            }

            // convert a WithDefinition to a Paragraph in the output
            // not 100% sure we want to do that ... we may need to process
            // the child variable nodes and reparent them?
            if (WITH_DEFINITION_RE.test(nodeClass)) {
                context.$class = `${CommonMarkModel.NAMESPACE}.Paragraph`;
                delete context.name;
                delete context.elementType;
            }

            // add a 'value' property to FormulaDefinition
            // with the result of evaluating the JS code
            else if (FORMULA_DEFINITION_RE.test(nodeClass)) {
                if (context.code) {
                    checkCode(context.code);
                    const result = evaluateJavaScript(clauseLibrary, data, context.code.contents, options);
                    if(result === null) {
                        context.value = '<null>';
                    }
                    else if(typeof result === 'string') {
                        context.value = result;
                    }
                    else {
                        context.value = JSON.stringify(result);
                    }
                    delete context.code;
                }
                else {
                    throw new Error('Formula node is missing code.');
                }
            }

            // evaluate lists, recursing on each list item
            else if (LISTBLOCK_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path);
                const variableValues = jp.query(data, path, 1);

                if (variableValues.length === 0) {
                    throw new Error(`No values found for path '${path}' in data ${data}.`);
                }
                else {
                    const arrayData = variableValues[0];
                    if(!Array.isArray(arrayData)) {
                        throw new Error(`Values found for path '${path}' in data ${data} is not an array: ${arrayData}.`);
                    }
                    else {
                        context.$class = `${CommonMarkModel.NAMESPACE}.List`;
                        delete context.elementType;
                        delete context.name;
                        context.nodes = arrayData.map( arrayItem => {
                            // arrayItem is now the data for the nested traversal
                            const subResult = generateAgreement(modelManager, clauseLibrary, context.nodes[0].nodes[0], arrayItem);
                            return {
                                $class: `${CommonMarkModel.NAMESPACE}.Item`,
                                nodes: subResult.nodes ? subResult.nodes : []
                            };
                        });
                        stopHere = true; // do not process child nodes, we've already done it above...
                    }
                }
            }

            // map over an array of items, joining them into a Text node
            else if (JOIN_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path);
                const variableValues = jp.query(data, path, 1);

                if (variableValues.length === 0) {
                    throw new Error(`No values found for path '${path}' in data ${data}.`);
                }
                else {
                    const arrayData = variableValues[0];
                    if(!Array.isArray(arrayData)) {
                        throw new Error(`Values found for path '${path}' in data ${data} is not an array: ${arrayData}.`);
                    }
                    else {
                        context.$class = `${CommonMarkModel.NAMESPACE}.Text`;
                        const drafter = getDrafter(context.elementType);
                        context.text = joinList(arrayData.map( arrayItem => {
                            return drafter ? drafter(arrayItem, context.format) : arrayItem as string;
                        }), context, options);
                        delete context.elementType;
                        delete context.name;
                        delete context.separator;
                        delete context.locale;
                        delete context.type;
                        delete context.style;
                        delete context.nodes;
                        stopHere = true; // do not process child nodes, we've already done it above...
                    }
                }
            }

            // add a 'value' property to VariableDefinition
            // with the value of the variable from 'data'
            else if (VARIABLE_DEFINITION_RE.test(nodeClass) ||
                ENUM_VARIABLE_DEFINITION_RE.test(nodeClass) ||
                FORMATTED_VARIABLE_DEFINITION_RE.test(nodeClass)) {
                if(typeof data === 'object') {
                    const path = getJsonPath(templateMark, context, this.path);
                    const variableValues = jp.query(data, path, 1);
                    if (variableValues.length === 0) {
                        throw new Error(`No values found for path '${path}' in data ${data}.`);
                    }
                    else {
                        // convert the value to a string, optionally using the formatter
                        const variableValue = variableValues[0];
                        const type = (ModelUtil as any).isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
                        // we want to draft Enums as strings, not objects
                        const drafter = getDrafter(type && type.isEnum() ? 'String' : context.elementType);
                        context.value = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue) as string;
                    }
                }
                else {
                    // a list of enum values or primitives brings us here
                    const variableValue = data;
                    const type = (ModelUtil as any).isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
                    // we want to draft Enums as strings, not objects
                    const drafter = getDrafter(type && type.isEnum() ? 'String' : context.elementType);
                    context.value = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue) as string;
                }
            }

            // add a 'isTrue' property to ConditionDefinition
            // with the result of evaluating the JS code or a boolean property
            else if (CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    checkCode(context.condition);
                    context.isTrue = !!evaluateJavaScript(clauseLibrary, data, context.condition.contents, options) as unknown as boolean;
                }
                else {
                    const path = getJsonPath(templateMark, context, this.path);
                    const variableValues = jp.query(data, path, 1);
                    if (variableValues && variableValues.length) {
                        if(variableValues.length === 1) {
                            context.isTrue = !!variableValues[0];
                        }
                        else {
                            throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
                        }
                    }
                    else {
                        context.isTrue = false;
                    }
                }
                context.nodes = context.isTrue ? context.whenTrue : context.whenFalse;
                delete context.condition;
                delete context.dependencies;
                delete context.functionName;
            }

            // only include the children of a clause if its condition is true
            else if (CLAUSE_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    checkCode(context.condition);
                    const result = !!evaluateJavaScript(clauseLibrary, data, context.condition.contents, options) as unknown as boolean;
                    if(!result) {
                        delete context.nodes;
                        stopHere = true;
                    }
                }
                delete context.condition;
                delete context.functionName;
            }

            // add a 'hasSome' property to OptionalDefinition
            else if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path);
                const variableValues = jp.query(data, path, 1);
                if (variableValues && variableValues.length) {
                    if(variableValues.length === 1) {
                        context.hasSome = true;
                        context.whenNone = [];
                    }
                    else {
                        throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
                    }
                }
                else {
                    context.hasSome = false;
                    context.whenSome = [];
                }
                context.nodes = context.hasSome ? context.whenSome : context.whenNone;
            }
        }
        this.update(context, stopHere);
    });
}

/**
 * A template engine: merges the markup and logic of a template with
 * JSON data to produce JSON data.
 */
export class TemplateMarkInterpreter {
    modelManager: ModelManager;
    templateClass: ClassDeclaration;
    clauseLibrary: object;

    constructor(modelManager: ModelManager, clauseLibrary:object, templateConceptFqn?: string) {
        this.modelManager = modelManager;
        this.clauseLibrary = clauseLibrary;
        this.templateClass = getTemplateClassDeclaration(this.modelManager,templateConceptFqn);
    }

    /**
     * Checks that a TemplateMark JSON document is valid with respect to the
     * TemplateMark model, as well as the template model.
     *
     * Checks:
     * 1. Variable names are valid properties in the template model
     * 2. Optional properties have guards
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON that has been typed checked and has type metadata added
     * @throws {Error} if the templateMark document is invalid
     */
    checkTypes(templateMark: object): object {
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(TemplateMarkModel.MODEL, 'templatemark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        try {
            serializer.fromJSON(templateMark);
            return templateMark;
        }
        catch(err) {
            throw new Error(`Generated invalid agreement: ${err}: ${JSON.stringify(templateMark, null, 2)}`);
        }
    }

    /**
     * Compiles the code nodes containing TS to code nodes containing JS.
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON with JS nodes
     * @throws {Error} if the templateMark document is invalid
     */
    compileTypeScriptToJavaScript(templateMark: object) : object {
        const templateConcept = (templateMark as any).nodes[0].elementType;
        if(!templateConcept) {
            throw new Error('TemplateMark is not typed');
        }
        const compiler = new TemplateMarkToJavaScriptCompiler(this.modelManager, templateConcept);
        return compiler.compile(templateMark);
    }

    validateCiceroMark(ciceroMark: object) {
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(CiceroMarkModel.MODEL, 'ciceromark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        try {
            return serializer.fromJSON(ciceroMark);
        }
        catch(err) {
            throw new Error(`Generated invalid agreement: ${err}: ${JSON.stringify(ciceroMark, null, 2)}`);
        }
    }

    async generate(templateMark: object, data: TemplateData, options?:GenerationOptions): Promise<any> {
        const factory = new Factory(this.modelManager);
        const serializer = new Serializer(factory, this.modelManager);
        const templateData = serializer.fromJSON(data);
        if (templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
            throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
        }
        const typedTemplateMark = this.checkTypes(templateMark);
        const jsTemplateMark = this.compileTypeScriptToJavaScript(typedTemplateMark);
        const ciceroMark = generateAgreement(this.modelManager, this.clauseLibrary, jsTemplateMark, data, options);
        return this.validateCiceroMark(ciceroMark);
    }
}