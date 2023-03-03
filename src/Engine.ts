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
import { TemplateMarkModel } from './externalModels/TemplateMarkModel';
import { CommonMarkModel } from './externalModels/CommonMarkModel';
import { AgreementMarkModel } from './externalModels/AgreementMarkModel';
import { ConcertoMetaModel } from './externalModels/ConcertoMetaModel';

// used to migrate old template mark json to latest namespaces
const TEMPLATEMARK_OLD_RE = /^(org\.accordproject\.templatemark)\.(\w+)$/;
const COMMONMARK_OLD_RE = /^(org\.accordproject\.commonmark)\.(\w+)$/;
const CONCERTOMETAMODEL_OLD_RE = /^(concerto\.metamodel)\.(\w+)$/;

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

// TODO??
// ContractDefinition
// ClauseDefinition
// OptionalDefinition
// Document

type TemplateData = Record<string, unknown>;

/**
 * Evaluates a JS expression
 * @param {*} data the contract data
 * @param {string} expression the JS expression
 * @param {Date} now the current value for now
 * @returns {object} the result of evaluating the expression against the data
 */
function evaluateJavaScript(data: TemplateData, expression: string, now?: dayjs.Dayjs): object {
    if (!data || !expression) {
        throw new Error(`Cannot evaluate JS ${expression} against ${data}`);
    }
    data.now = now ? now : dayjs();
    const args = Object.keys(data);
    const values = Object.values(data);
    const types = values.map(v => typeof v);
    const DEBUG = false;
    if (DEBUG) {
        console.debug('**** ' + JSON.stringify(data, null, 2));
        console.debug('**** ' + expression);
        console.debug('**** ' + args);
        console.debug('**** ' + values);
        console.debug('**** ' + types);
    }
    const fun = new Function(...args, expression); // SECURITY!
    const result = fun(...values);
    if (DEBUG) {
        console.debug('**** ' + result);
    }
    return result;
}

/**
 * Calculates a JSON path to use to retrieve data, based on a TemplatemMark tree.
 * For example, if we hit a VariableDefinition {{city}} that is nested inside a
 * WithDefinition {{#with address}} then the JSON path returned should be '$.address.city'.
 * Similarly ListBlockDefinition and JoinDefinition also include property names that must
 * apply to their child nodes.
 * @param {*} rootData the root of the JSON document, typically this is a TemplateMark JSON
 * @param {*} currentNode the current TemplateMark node we are processing
 * @param {string[]} paths the traverse path to the current node
 * @returns {string} the JSON path to use to retrieve data
 */
function getJsonPath(rootData:any, currentNode:any, paths:string[]) : string {
    if(!currentNode) {
        throw new Error('Data must be supplied');
    }
    if(!currentNode.name) {
        throw new Error(`Data must have a name: ${JSON.stringify(currentNode)}`);
    }
    if(currentNode.name === 'this') { // TODO: is this what we want to do?!
        return '$.';
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
            if(obj.$class === 'org.accordproject.templatemark@1.0.0.ListBlockDefinition' ||
            obj.$class === 'org.accordproject.templatemark@1.0.0.WithDefinition' ||
            obj.$class === 'org.accordproject.templatemark@1.0.0.JoinDefinition' ||
            obj.$class === 'org.accordproject.templatemark@1.0.0.OptionalDefinition') {
                withPath.push(obj.name);
            }
        }
    }
    const path = withPath.length > 0 ? `${withPath.join('.')}.${currentNode.name}` : currentNode.name;
    return `$.${path}`;
}

/**
 * Generates an AgreementMark JSON document from a template plus data.
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @returns {*} the AgreementMark JSON
 */
function generateAgreement(templateMark: object, data: TemplateData): any {
    return traverse(templateMark).map(function (context: any) {
        let stopHere = false;
        if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;

            // rewrite node types, mapping from TemplateMark to AgreementMark
            const match = nodeClass.match(TEMPLATEMARK_RE);
            if (match && match.length > 1) {
                context.$class = `org.accordproject.agreementmark@${match[2]}.${match[3]}`;
            }

            // convert a WithDefinition to a Paragraph in the output
            // not 100% sure we want to do that ... we may need to process
            // the child variable nodes and reparent them?
            if (WITH_DEFINITION_RE.test(nodeClass)) {
                context.$class = 'org.accordproject.commonmark@1.0.0.Paragraph';
                delete context.name;
                delete context.elementType;
            }

            // add a 'value' property to FormulaDefinition
            // with the result of evaluating the JS code
            else if (FORMULA_DEFINITION_RE.test(nodeClass)) {
                if (context.code) {
                    context.value = JSON.stringify(evaluateJavaScript(data, context.code));
                }
                else {
                    throw new Error('Formula node is missing code.');
                }
            }

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
                        context.$class = 'org.accordproject.commonmark@1.0.0.List';
                        delete context.elementType;
                        delete context.name;
                        context.nodes = arrayData.map( arrayItem => {
                            // arrayItem is now the data for the nested traversal
                            const subResult = generateAgreement(context.nodes[0].nodes[0], arrayItem);
                            return {
                                $class: 'org.accordproject.commonmark@1.0.0.Item',
                                nodes: subResult.nodes ? subResult.nodes : []
                            };
                        });
                        stopHere = true; // do not process child nodes, we've already done it above...
                    }
                }
            }

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
                        context.$class = 'org.accordproject.commonmark@1.0.0.Text';
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
                const path = getJsonPath(templateMark, context, this.path);
                const variableValues = jp.query(data, path, 1);

                if (variableValues.length === 0) {
                    throw new Error(`No values found for path '${path}' in data ${data}.`);
                }
                else {
                    // convert the value to a string, optionally using the formatter
                    const variableValue = variableValues[0];
                    const drafter = draftingMap.get(context.elementType);
                    context.value = drafter ? drafter(variableValue, context.format) : variableValue as string;
                }
            }

            // add a 'isTrue' property to ConditionDefinition
            // with the result of evaluating the JS code
            else if (CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    context.isTrue = evaluateJavaScript(data, `return !!${context.condition}`) as unknown as boolean;
                    if(context.isTrue) {
                        delete context.whenFalse;
                    }
                    else {
                        delete context.whenTrue;
                    }
                }
                else {
                    throw new Error('Condition node is missing condition.');
                }
            }

            // add a 'hasSome' property to OptionalDefinition
            else if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path);
                const variableValues = jp.query(data, path, 1);
                if (variableValues && variableValues.length) {
                    if(variableValues.length === 1) {
                        context.hasSome = !!variableValues[0];
                        delete context.whenNone;
                    }
                    else {
                        throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
                    }
                }
                else {
                    context.hasSome = false;
                    delete context.whenSome;
                }
            }
        }
        this.update(context, stopHere);
    });
}

/**
 * Migrates a TemplateMark JSON document without namespace versions
 * to a document with namespace versions.
 * @param {*} templateMark - the TemplateMark JSON document
 * @returns {*} the TemplateMark JSON with namespace versions
 */
function migrateTemplateMark(templateMark: object): object {
    return traverse(templateMark).map(function (x: any) {
        if (typeof x === 'object' && x.$class && typeof x.$class === 'string') {
            const nodeClass = x.$class as string;
            {
                const match = nodeClass.match(TEMPLATEMARK_OLD_RE);
                if (match && match.length > 1) {
                    x.$class = `org.accordproject.templatemark@1.0.0.${match[2]}`;
                }
            }
            {
                const match = nodeClass.match(COMMONMARK_OLD_RE);
                if (match && match.length > 1) {
                    x.$class = `org.accordproject.commonmark@1.0.0.${match[2]}`;
                }
            }
            {
                const match = nodeClass.match(CONCERTOMETAMODEL_OLD_RE);
                if (match && match.length > 1) {
                    x.$class = `concerto.metamodel@1.0.0.${match[2]}`;
                }
            }
        }
        this.update(x);
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
     * Migrates a template mark JSON document
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON migrated to latest namespace version
     */
    migrate(templateMark: object): object {
        return migrateTemplateMark(templateMark);
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
        modelManager.addCTOModel(ConcertoMetaModel, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel, 'commonmark.cto');
        modelManager.addCTOModel(TemplateMarkModel, 'templatemark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        serializer.fromJSON(templateMark);
        return templateMark;
    }

    validateCiceroMark(ciceroMark: object) {
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(ConcertoMetaModel, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel, 'commonmark.cto');
        modelManager.addCTOModel(AgreementMarkModel, 'agreementmark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        serializer.fromJSON(ciceroMark);
        return true;
    }

    generate(templateMark: object, data: TemplateData): any {
        const factory = new Factory(this.modelManager);
        const serializer = new Serializer(factory, this.modelManager);
        const templateData = serializer.fromJSON(data);
        if (templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
            throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
        }
        const typedTemplateMark = this.checkTypes(templateMark, data);
        const ciceroMark = generateAgreement(typedTemplateMark, data);
        this.validateCiceroMark(ciceroMark);
        return ciceroMark;
    }
}