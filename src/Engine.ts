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

const TM_RE = /^(org\.accordproject\.templatemark)@(.+)\.(\w+)Definition$/;
const FORMULA_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormulaDefinition$/;
const VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.VariableDefinition$/;
const CONDITIONAL_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.ConditionalDefinition$/;
const ENUM_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.EnumVariableDefinition$/;
const FORMATTED_VARIABLE_DEFINITION_RE = /^(org\.accordproject\.templatemark)@(.+)\.FormattedVariableDefinition$/;

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

function reviver(context: any, data:TemplateData, key:string, value:object) {

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
            if(!Object.keys(data).includes(context.name)) {
                throw new Error(`Missing variable value '${context.name}'.`);
            }
            if(data[context.name] !== null) {
                const val = data[context.name];
                context.value = typeof val === 'string' ? val : JSON.stringify(data[context.name]);
            }
            else {
                throw new Error(`Variable value '${context.name}' is null.`);
            }
        }

        // add a 'isTrue' property to ConditionDefinition
        // with the result of evaluating the JS code
        else if(CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
            if(context.condition) {
                context.isTrue = evaluateJavaScript(data, `return !!${context.condition}`);
            }
            else {
                throw new Error('Condition node is missing condition.');
            }
        }

        // rewrite node types, mapping from TemplateMark to AgreementMark
        const match = nodeClass.match(TM_RE);
        if(match && match.length > 1) {
            return `org.accordproject.ciceromark@${match[2]}.${match[3]}`;
        }
    }

    return value;
}

export function generateAgreement(templateMark:object, data:TemplateData) : object {
    const f = function(this:any, key:string,value:any) {
        return reviver(this, data,key, value);
    };
    return JSON.parse(JSON.stringify(templateMark), f);
}