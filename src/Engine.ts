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

// TODO??
// ListBlockDefinition
// ContractDefinition
// ClauseDefinition
// WithDefinition
// OptionalDefinition
// JoinDefinition
// Document

type TemplateData = Record<string,unknown>;

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
 * Generates an AgreementMark JSON document from a template plus data.
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @returns {*} the AgreementMark JSON
 */
function generateAgreement(templateMark:object, data:TemplateData) : object {
    return traverse(templateMark).map(function (context:any) {
        if(typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;

            // rewrite node types, mapping from TemplateMark to AgreementMark
            const match = nodeClass.match(TEMPLATEMARK_RE);
            if(match && match.length > 1) {
                context.$class = `org.accordproject.agreementmark@${match[2]}.${match[3]}`;
            }

            // convert a WithDefinition to a Paragraph in the output
            if(WITH_DEFINITION_RE.test(nodeClass)) {
                context.$class = 'org.accordproject.commonmark@1.0.0.Paragraph';
                delete context.name;
                delete context.elementType;
            }

            // add a 'value' property to FormulaDefinition
            // with the result of evaluating the JS code
            else if(FORMULA_DEFINITION_RE.test(nodeClass)) {
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
                const withPath = [];
                for(let n=1; n < this.path.length; n++) {
                    const sub = this.path.slice(0, n);
                    const obj = traverse.get(templateMark, sub);
                    if(obj.$class && obj.$class === 'org.accordproject.templatemark@1.0.0.WithDefinition') {
                        withPath.push(obj.name);
                    }
                }
                const path = withPath.length > 0 ? `${withPath.join('.')}.${context.name}` : context.name;
                const variableValues = jp.query(data, `$.${path}`, 1);

                if(variableValues.length === 0) {
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
            else if(CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
                if(context.condition) {
                    context.isTrue = evaluateJavaScript(data, `return !!${context.condition}`) as unknown as boolean;
                }
                else {
                    throw new Error('Condition node is missing condition.');
                }
            }
        }
        this.update(context);
    });
}

/**
 * Migrates a TemplateMark JSON document without namespace versions
 * to a document with namespace versions.
 * @param {*} templateMark - the TemplateMark JSON document
 * @returns {*} the TemplateMark JSON with namespace versions
 */
function migrateTemplateMark(templateMark:object) : object {
    return traverse(templateMark).map(function (x:any) {
        if(typeof x === 'object' && x.$class && typeof x.$class === 'string') {
            const nodeClass = x.$class as string;
            {
                const match = nodeClass.match(TEMPLATEMARK_OLD_RE);
                if(match && match.length > 1) {
                    x.$class = `org.accordproject.templatemark@1.0.0.${match[2]}`;
                }
            }
            {
                const match = nodeClass.match(COMMONMARK_OLD_RE);
                if(match && match.length > 1) {
                    x.$class = `org.accordproject.commonmark@1.0.0.${match[2]}`;
                }
            }
            {
                const match = nodeClass.match(CONCERTOMETAMODEL_OLD_RE);
                if(match && match.length > 1) {
                    x.$class = `concerto.metamodel@1.0.0.${match[2]}`;
                }
            }
        }
        this.update(x);
    });
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
     * Migrates a template mark JSON document
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON migrated to latest namespace version
     */
    migrate(templateMark:object) : object {
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
    checkTypes(templateMark:object, templateData:object) : object {
        const modelManager = new ModelManager({strict:true});
        modelManager.addCTOModel(ConcertoMetaModel, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel, 'commonmark.cto');
        modelManager.addCTOModel(TemplateMarkModel, 'templatemark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        serializer.fromJSON(templateMark);
        return templateMark;
    }

    validateCiceroMark(ciceroMark:object) {
        const modelManager = new ModelManager({strict:true});
        modelManager.addCTOModel(ConcertoMetaModel, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel, 'commonmark.cto');
        modelManager.addCTOModel(AgreementMarkModel, 'agreementmark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);
        serializer.fromJSON(ciceroMark);
        return true;
    }

    generate(templateMark:object, data:TemplateData) : any {
        const factory = new Factory(this.modelManager);
        const serializer = new Serializer(factory, this.modelManager);
        const templateData = serializer.fromJSON(data);
        if(templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
            throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
        }
        const typedTemplateMark = this.checkTypes(templateMark, data);
        const ciceroMark = generateAgreement(typedTemplateMark, data);
        this.validateCiceroMark(ciceroMark);
        return ciceroMark;
    }
}