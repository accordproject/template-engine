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
import traverse from 'traverse';

import { ClassDeclaration, Factory, Introspector, ModelManager, Serializer } from '@accordproject/concerto-core';
import { draftingMap } from './drafting';
import { TemplateMarkModel, CommonMarkModel, CiceroMarkModel, ConcertoMetaModel } from '@accordproject/markdown-common';
import { ModelUtil } from '@accordproject/concerto-core';

// use to create agreementmark from templatemark
const TEMPLATEMARK_RE = /^(org\.accordproject\.templatemark)@(.+)\.(\w+)Definition$/;
const FORMULA_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormulaDefinition$/;
const VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.VariableDefinition$/;
const CONDITIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ConditionalDefinition$/;
const ENUM_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.EnumVariableDefinition$/;
const FORMATTED_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormattedVariableDefinition$/;
const WITH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.WithDefinition$/;
const LISTBLOCK_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ListBlockDefinition$/;
const JOIN_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.JoinDefinition$/;
const OPTIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.OptionalDefinition$/;
const CLAUSE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ClauseDefinition$/;
const CONTRACT_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ContractDefinition$/;

type TemplateData = Record<string, unknown>;

/**
 * TemplateMark nodes that implicity change the data access scope
 * by specifying the name of a property on the node.
 */
const NAVIGATION_NODES = [
    `${TemplateMarkModel.NAMESPACE}.ListBlockDefinition`,
    `${TemplateMarkModel.NAMESPACE}.WithDefinition`,
    `${TemplateMarkModel.NAMESPACE}.JoinDefinition`,
    `${TemplateMarkModel.NAMESPACE}.OptionalDefinition`,
    `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`
];

/**
 * Evaluates a JS expression
 * @param {ClassDeclaration} templateClass the Concerto class for the template data
 * @param {*} data the contract data
 * @param {string} expression the JS expression
 * @param {Date} now the current value for now
 * @returns {object} the result of evaluating the expression against the data
 */
function evaluateJavaScript(templateClass:ClassDeclaration, data: TemplateData, expression: string, now?: dayjs.Dayjs): object {
    if (!data || !expression || !templateClass) {
        throw new Error(`Cannot evaluate JS ${expression} against ${data}`);
    }
    data.now = now ? now : dayjs();
    const args = templateClass.getOwnProperties().map(p => p.name);
    args.push('now');
    const values = args.map(p => data[p]);
    const types = values.map(v => typeof v);
    const DEBUG = false;
    if (DEBUG) {
        console.debug('**** ' + JSON.stringify(data, null, 2));
        console.debug('**** ' + expression);
        console.debug('**** ' + args);
        console.debug('**** ' + values);
        console.debug('**** ' + types);
    }
    try {
        const fun = new Function(...args, expression); // SECURITY!
        const result = fun(...values);
        if (DEBUG) {
            console.debug('**** ' + result);
        }
        return result;
    }
    catch(err) {
        throw new Error(`Caught error ${err} evaluting ${expression} with data ${JSON.stringify(data,null,2)}`);
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
        if(!obj) {
            throw new Error(`Failed to find data with path ${sub} and data ${JSON.stringify(rootData)}`);
        }
        if (obj.$class) {
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
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @returns {*} the AgreementMark JSON
 */
function generateAgreement(modelManager:ModelManager, templateMark: object, data: TemplateData): any {
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
                    const templateClass = introspector.getClassDeclaration(data.$class as string);
                    const result = evaluateJavaScript(templateClass, data, context.code.contents);
                    context.value = typeof result === 'string' ? result : JSON.stringify(result);
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
                            const subResult = generateAgreement(modelManager, context.nodes[0].nodes[0], arrayItem);
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
                        const drafter = draftingMap.get(context.elementType);
                        context.text = arrayData.map( arrayItem => {
                            return drafter ? drafter(arrayItem, context.format) : arrayItem as string;
                        }).join(context.separator);
                        delete context.elementType;
                        delete context.name;
                        delete context.separator;
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
                        const drafter = draftingMap.get(context.elementType);
                        context.value = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue) as string;
                    }
                }
                else {
                    // a list of enum values or primitives brings us here
                    const variableValue = data;
                    const type = (ModelUtil as any).isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
                    // we want to draft Enums as strings, not objects
                    const drafter = draftingMap.get(type && type.isEnum() ? 'String' : context.elementType);
                    context.value = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue) as string;
                }
            }

            // add a 'isTrue' property to ConditionDefinition
            // with the result of evaluating the JS code or a boolean property
            else if (CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    const templateClass = introspector.getClassDeclaration(data.$class as string);
                    context.isTrue = evaluateJavaScript(templateClass, data, `return !!${context.condition.contents}`) as unknown as boolean;
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
            }

            // only include the children of a clause if its condition is true
            else if (CLAUSE_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    const templateClass = introspector.getClassDeclaration(data.$class as string);
                    const result = evaluateJavaScript(templateClass, data, `return !!${context.condition.contents}`) as unknown as boolean;
                    if(!result) {
                        delete context.nodes;
                        stopHere = true;
                    }
                }
                else {
                    // context.isTrue = true; // TODO
                }
                delete context.condition;
            }

            // add a 'hasSome' property to OptionalDefinition
            else if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path);
                const variableValues = jp.query(data, path, 1);
                if (variableValues && variableValues.length) {
                    if(variableValues.length === 1) {
                        context.hasSome = true;
                    }
                    else {
                        throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
                    }
                }
                else {
                    context.hasSome = false;
                }
                context.nodes = [];
            }
        }
        this.update(context, stopHere);
    });
}

/**
 * A template engine: merges the markup and logic of a template with
 * JSON data to produce JSON data.
 */
export class Engine {
    modelManager: ModelManager;
    templateClass: ClassDeclaration;

    constructor(modelManager: ModelManager) {
        this.modelManager = modelManager;
        const introspector = new Introspector(this.modelManager);
        const templateModels = introspector.getClassDeclarations().filter((item) => {
            return !item.isAbstract() && item.getDecorator('template');
        });
        if (templateModels.length > 1) {
            throw new Error('Found multiple concepts with @template decorator. The model for the template must contain a single concept with the @template decorator.');
        } else if (templateModels.length === 0) {
            throw new Error('Failed to find a concept with the @template decorator. The model for the template must contain a single concept with the @template decoratpr.');
        } else {
            this.templateClass = templateModels[0];
        }
    }

    /**
     * Checks that a TemplateMark JSON document is valid with respect to the
     * TemplateMark model, as well as the template model.
     *
     * Checks:
     * 1. Variable names are valid properties in the template model
     * 2. Optional properties have guards
     * @param {*} templateMark the TemplateMark JSON object
     * @param {*} templateData the agreement data
     * @returns {*} TemplateMark JSON that has been typed checked and has type metadata added
     * @throws {Error} if the templateMark document is invalid
     */
    checkTypes(templateMark: object, templateData: object): object {
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

    generate(templateMark: object, data: TemplateData): any {
        const factory = new Factory(this.modelManager);
        const serializer = new Serializer(factory, this.modelManager);
        const templateData = serializer.fromJSON(data);
        if (templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
            throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
        }
        const typedTemplateMark = this.checkTypes(templateMark, data);
        const ciceroMark = generateAgreement(this.modelManager, typedTemplateMark, data);
        return this.validateCiceroMark(ciceroMark);
    }
}