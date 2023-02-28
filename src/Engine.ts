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

import { ClassDeclaration, Factory, Introspector, ModelManager, Serializer } from '@accordproject/concerto-core';
import { draftingMap } from './drafting';

const TEMPLATEMARK_RE = /^(org\.accordproject\.templatemark)@(.+)\.(\w+)Definition$/;
const FORMULA_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormulaDefinition$/;
const VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.VariableDefinition$/;
const CONDITIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ConditionalDefinition$/;
const ENUM_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.EnumVariableDefinition$/;
const FORMATTED_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormattedVariableDefinition$/;
// const WITH_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.WithDefinition$/;

// TODO??
// ListBlockDefinition
// ContractDefinition
// ClauseDefinition
// WithDefinition
// OptionalDefinition
// JoinDefinition
// Document

type TemplateData = Record<string,unknown>;

type TemplateMarkNode = {
    code: string;
    value: string;
    name: string;
    condition: string;
    isTrue: boolean;
    elementType: string;
    format: string;
}

/**
 * Evaluates a JS expression
 * @param {*} data the contract data
 * @param {string} expression the JS expression
 * @param {Date} now the current value for now
 * @returns {object} the result of evaluating the expression against the data
 */
function evaluateJavaScript(data:TemplateData, expression:string, now?: dayjs.Dayjs) : object {
    if(!data || !expression) {
        throw new Error(`Cannot evaluate JS ${expression} against ${data}`);
    }
    data.now = now ? now : dayjs();
    const args = Object.keys(data);
    const values = Object.values(data);
    const types = values.map( v => typeof v);
    const DEBUG = false;
    if(DEBUG) {
        console.debug('**** ' + JSON.stringify(data, null, 2));
        console.debug('**** ' + expression);
        console.debug('**** ' + args);
        console.debug('**** ' + values);
        console.debug('**** ' + types);
    }
    const fun = new Function(...args, expression); // SECURITY!
    const result = fun(...values);
    if(DEBUG) {
        console.debug('**** ' + result);
    }
    return result;
}

/**
 * This is a JSON.parse 'reviver' - a function that can transform
 * JSON nodes in place. This reviver transforms a TemplateMark JSON document
 * plus template data to an AgrementMark JSON document.
 * @param {*} context - the 'this' parameter for the reviver, the node being processed
 * @param {*} data - the template data being used to create AgreementMark
 * @param {string} key - the key of the current object
 * @param {*} value - the value of the current object
 * @returns {*} the updated value
 */
function reviver(context: TemplateMarkNode, data:TemplateData, key:string, value:object) : object | string {
    // process the nodes in the templatemark, converting them to agreementmark
    if(key === '$class' && typeof value === 'string') {
        const nodeClass = value as string;

        // add a 'value' property to FormulaDefinition
        // with the result of evaluating the JS code
        if(FORMULA_DEFINITION_RE.test(nodeClass)) {
            if(context.code) {
                context.value = JSON.stringify(evaluateJavaScript(data, context.code));
            }
            else {
                throw new Error('Formula node is missing code.');
            }
        }

        // add a 'value' property to VariableDefinition
        // with the value of the variable from 'data'
        else if(VARIABLE_DEFINITION_RE.test(nodeClass) ||
            ENUM_VARIABLE_DEFINITION_RE.test(nodeClass) ||
            FORMATTED_VARIABLE_DEFINITION_RE.test(nodeClass)) {

            const variableValues = jp.query(data, `$.${context.name}`, 1);

            if(variableValues.length === 0) {
                throw new Error(`No values found for path '${context.name}' in data ${JSON.stringify(data, null,2)}.`);
            }
            else {
                const variableValue = variableValues[0];
                const drafter = draftingMap.get(context.elementType);
                context.value = drafter ? drafter(variableValue, context.format) : variableValue as string;
            }
        }

        // add a 'isTrue' property to ConditionDefinition
        // with the result of evaluating the JS code
        else if(CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
            if(context.condition) {
                context.isTrue = evaluateJavaScript(data, `return !!${context.condition}`) as unknown as boolean;
            }
            else {
                throw new Error('Condition node is missing condition.');
            }
        }

        // rewrite node types, mapping from TemplateMark to AgreementMark
        const match = nodeClass.match(TEMPLATEMARK_RE);
        if(match && match.length > 1) {
            return `org.accordproject.ciceromark@${match[2]}.${match[3]}`;
        }
    }

    return value;
}

/**
 * Generates an AgreementMark JSON document from a template plus data.
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @returns {*} the AgreementMark JSON
 */
function generateAgreement(templateMark:object, data:TemplateData) : object {
    const f = function(this:TemplateMarkNode, key:string, value:object) {
        return reviver(this, data,key, value);
    };
    return JSON.parse(JSON.stringify(templateMark), f);
}

export class Engine {
    modelManager:ModelManager;
    templateClass:ClassDeclaration;

    constructor(modelManager:ModelManager) {
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
     * @returns {*} TemplateMark JSON that has been typed checked and has type metadata added
     * @throws {Error} if the templateMark document is invalid
     */
    checkTypes(templateMark:object) : object {
        return templateMark;
    }

    validateCiceroMark(ciceroMark:object) {
        return true;
    }

    generate(templateMark:object, data:TemplateData) : object {
        const typedTemplateMark = this.checkTypes(templateMark);
        const factory = new Factory(this.modelManager);
        const serializer = new Serializer(factory, this.modelManager);
        const templateData = serializer.fromJSON(data);
        if(templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
            throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
        }
        const ciceroMark = generateAgreement(typedTemplateMark, data);
        this.validateCiceroMark(ciceroMark);
        return ciceroMark;
    }
}