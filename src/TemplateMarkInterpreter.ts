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

/* eslint-disable @typescript-eslint/no-explicit-any */

import jp from 'jsonpath';
import traverse from 'traverse';
import { isBrowser } from 'browser-or-node';
import os from 'os';

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
    FOREACH_DEFINITION_RE,
    OPTIONAL_DEFINITION_RE,
    CLAUSE_DEFINITION_RE,
    CONTRACT_DEFINITION_RE,
    TemplateData,
    NAVIGATION_NODES
} from './TemplateMarkNodes';
import { TemplateMarkToJavaScriptCompiler, hasUserCode } from './TemplateMarkToJavaScriptCompiler';
import { CodeType, ICode } from './model-gen/org.accordproject.templatemark@0.5.0';
import { GenerationOptions, joinList } from './TypeScriptRuntime';
import { getTemplateClassDeclaration } from './utils';
import { EvalResponse, JavaScriptEvaluator } from './JavaScriptEvaluator';
import { CompiledUserLogic } from './UserLogic';

function checkCode(code: ICode) {
    if (code.type !== CodeType.ES_2020) {
        throw new Error(`Cannot run ${code.contents} as it is not ES_2020 JavaScript.`);
    }
}

// this is a global because we don't want the user
// to configure child processes at the TemplateMarkInterpreter instance level
const javaScriptEvaluator = isBrowser ? new JavaScriptEvaluator() : new JavaScriptEvaluator({
    maxWorkers: process.env.MAX_WORKERS ? Number.parseInt(process.env.MAX_WORKERS) : os.availableParallelism(), // how many child processes
    waitInterval: process.env.WAIT_INTERVAL ? Number.parseInt(process.env.WAIT_INTERVAL) : 50, // how long to wait before rescheduling work
    maxQueueDepth: process.env.MAX_QUEUE_DEPTH ? Number.parseInt(process.env.MAX_QUEUE_DEPTH) : 1000 // max requests to queue
});

const TEMPLATEMARK_ROOT_NODES = [
    'org.accordproject.templatemark@0.5.0.ClauseDefinition',
    'org.accordproject.templatemark@0.5.0.ContractDefinition'
];

const DOCUMENT_ROOT = 'org.accordproject.commonmark@0.5.0.Document';

/**
 * Determines whether a JS expression references any of the top-level symbols
 * declared by the template's logic/logic.ts. Only those expressions need the
 * (potentially large) logic prelude spliced into their function body.
 * @param {string} expression the JS expression
 * @param {CompiledUserLogic} userLogic the compiled user logic, if any
 * @returns {boolean} true if the expression references a user logic symbol
 */
function usesUserLogic(expression: string, userLogic: CompiledUserLogic | undefined): boolean {
    if (!userLogic || !userLogic.prelude || userLogic.symbols.length === 0) {
        return false;
    }
    return userLogic.symbols.some(name =>
        new RegExp(`(^|[^\\w$.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w$])`).test(expression));
}

/**
 * Evaluates a JS expression
 * @param {*} clauseLibrary the clause library
 * @param {*} data the contract data
 * @param {string} fn the JS function (including header)
 * @param {CompiledUserLogic} userLogic the compiled logic/logic.ts, whose prelude is spliced
 *   into the formula function body when the expression references one of its helpers
 *   (e.g. `monthlyPaymentFormula`), so they are in scope.
 * @param {GenerationOptions} options the generation options
 * @returns {object} the result of evaluating the expression against the data
 */
async function evaluateJavaScript(clauseLibrary: object, data: TemplateData, fn: string, userLogic: CompiledUserLogic | undefined, options?: GenerationOptions): Promise<EvalResponse> {
    if (options?.disableJavaScriptEvaluation) {
        throw new Error('JavaScript evaluation is disabled.');
    }
    if (!data || !fn) {
        throw new Error(`Cannot evaluate JS ${fn} against ${data}`);
    }
    const functionArgNames = new Array<string>();
    functionArgNames.push('data');
    functionArgNames.push('library');
    functionArgNames.push('options');

    const functionArgValues = new Array<any>();
    functionArgValues.push(data);
    functionArgValues.push(clauseLibrary);
    functionArgValues.push(options);

    // chop the function header and closing
    const expression = fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}'));
    if (expression.trim().length === 0) {
        throw new Error('Empty expression');
    }
    const codeWithPrelude = usesUserLogic(expression, userLogic) ? `${userLogic?.prelude}\n${expression}` : expression;
    try {
        const request = { code: codeWithPrelude, argumentNames: functionArgNames, arguments: functionArgValues };
        if (options?.childProcessJavaScriptEvaluation) {
            if (isBrowser) {
                throw new Error('Child process evaluation is not supported inside web browser');
            }
            const evalOptions = options?.timeout ? { timeout: options.timeout } : undefined;
            const r = await javaScriptEvaluator.evalChildProcess(request, evalOptions);
            return r;
        }
        else {
            const r = await javaScriptEvaluator.evalDangerously(request);
            return r;
        }
    }
    catch (err) {
        throw new Error(`Caught error ${JSON.stringify(err)} evaluating ${expression} with arguments ${JSON.stringify(functionArgValues)}`);
    }
}

/**
 * Returns true if an element type is a scalar (a primitive or an enum), i.e.
 * a type whose value is not an object that can be navigated into.
 * @param {ModelManager} [modelManager] the model manager used to resolve enums
 * @param {string} [elementType] the fully-qualified element type
 * @returns {boolean} true if the type is a primitive or an enum
 */
function isScalarType(modelManager: ModelManager | undefined, elementType: string | undefined): boolean {
    if (!elementType) {
        return false;
    }
    if ((ModelUtil as any).isPrimitiveType(elementType)) {
        return true;
    }
    if (!modelManager) {
        return false;
    }
    try {
        const type = new Introspector(modelManager).getClassDeclaration(elementType);
        return !!(type && type.isEnum());
    }
    catch {
        return false;
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
 * @param {ModelManager} [modelManager] the model manager, used to detect optionals guarding enums
 * @returns {string} the JSON path to use to retrieve data
 */
function getJsonPath(rootData: any, currentNode: any, paths: string[], modelManager?: ModelManager): string {
    if (!currentNode) {
        throw new Error('Node must be supplied');
    }
    if (!currentNode.name) {
        throw new Error(`Node must have a name: ${JSON.stringify(currentNode)}`);
    }
    if (currentNode.name.indexOf('.') >= 0) {
        // prevent JSON path injection
        throw new Error(`Invalid name property ${currentNode.name}`);
    }
    if (!paths || !paths.length || paths.length < 1) {
        throw new Error('Paths must be supplied');
    }
    const withPath = [];
    // the innermost enclosing optional that guards a scalar (primitive or enum) value, if
    // it is also the innermost enclosing navigation node
    let scalarOptional: string | null = null;
    for (let n = 1; n < paths.length; n++) {
        const sub = paths.slice(0, n);
        const obj = traverse.get(rootData, sub);
        // HACK
        // if(obj===undefined) {
        //     throw new Error(`Failed to find data with path ${sub} and data ${JSON.stringify(rootData, null, 2)}`);
        // }
        if (obj && obj.$class) {
            if (NAVIGATION_NODES.indexOf(obj.$class) >= 0) {
                if(obj.name !== 'top') { // HACK!!
                    // A scalar optional has no property scope to navigate into, so named
                    // variables inside it (e.g. {{age}} in {{#optional age}}) resolve from
                    // the parent data context rather than as $['age']['age']
                    if (OPTIONAL_DEFINITION_RE.test(obj.$class) && isScalarType(modelManager, obj.elementType)) {
                        scalarOptional = obj.name;
                    }
                    else {
                        withPath.push(`['${obj.name}']`);
                        scalarOptional = null;
                    }
                }
            }
        }
    }

    if (currentNode.name === 'this') {
        // {{this}} directly inside a scalar optional refers to the optional value itself
        if (scalarOptional) {
            withPath.push(`['${scalarOptional}']`);
        }
    }
    else if (currentNode.name !== 'top') {
        withPath.push(`['${currentNode.name}']`);
    }

    return withPath.length > 0 ? `$${withPath.join('')}` : '$';
}

// the key is a path[] joined with '/' from the traverse library
// the value is the evaluation result
type UserCodeResult = Record<string, any>;

/**
 * Evaluates all the user code in a template mark document
 * @param {*} clauseLibrary - the clause library
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @param {CompiledUserLogic} userLogic - the compiled logic/logic.ts, exposing its helpers
 * @param {[GenerationOptions]} options - the generation options
 * @returns {Promise<UserCodeResult>} a promise to a UserCodeResult
 */
async function evaluateUserCode(clauseLibrary: object, templateMark: object, data: TemplateData, userLogic: CompiledUserLogic | undefined, options?: GenerationOptions): Promise<UserCodeResult> {
    const result: UserCodeResult = {};
    const paths = traverse(templateMark).paths();
    for (let n = 0; n < paths.length; n++) {
        const path = paths[n];
        const context = traverse(templateMark).get(path);
        if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;
            if (FORMULA_DEFINITION_RE.test(nodeClass)) {
                if (context.code) {
                    checkCode(context.code);
                    const evalResponse = await evaluateJavaScript(clauseLibrary, data, context.code.contents, userLogic, options);
                    result[path.join('/')] = JSON.stringify(evalResponse.result);
                }
                else {
                    throw new Error('Formula node is missing code.');
                }
            }
            else if (CONDITIONAL_DEFINITION_RE.test(nodeClass) || CLAUSE_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    checkCode(context.condition);
                    const evalResponse = await evaluateJavaScript(clauseLibrary, data, context.condition.contents, userLogic, options);
                    result[path.join('/')] = JSON.stringify(evalResponse.result);
                }
            }
        }
    }
    return result;
}

// the key is a path[] joined with '/' from the traverse library
// the value is an array of agreementmark Item nodes for the recursive block
type RecursiveBlockResult = Record<string, any[]>;

// the key is a path[] joined with '/' from the traverse library
// the value is an array of agreementmark nodes for the optional block
type OptionalBlockResult = Record<string, any[]>;

/**
 * Generates agreementmark for all optional blocks with proper context switching
 * Warning: this is async and recursive
 * @param {ModelManager} modelManager - the template model
 * @param {*} clauseLibrary - the clause library
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @param {[GenerationOptions]} options - the generation options
 * @returns {*} the AgreementMark JSON for optional blocks
 */
async function generateOptionalBlocks(modelManager: ModelManager, clauseLibrary: object, templateMark: object, data: TemplateData, userLogic: CompiledUserLogic | undefined, options?: GenerationOptions): Promise<OptionalBlockResult> {
    const result: OptionalBlockResult = {};
    const paths = traverse(templateMark).paths();
    for (let n = 0; n < paths.length; n++) {
        const thisPath = paths[n];
        const context = traverse(templateMark).get(thisPath);
        if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;

            // evaluate optional blocks, processing the whenSome content with the optional property value as context
            if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, thisPath, modelManager);
                const variableValues = jp.query(data, path, 1);

                if (variableValues.length > 0) {
                    // Optional property exists, process whenSome with the property value as context
                    const optionalPropertyValue = variableValues[0];

                    // Scalar optional values (primitives and enums) are not pre-processed: the
                    // normal traverse handles them with the full parent data context, so that
                    // both {{this}} and named variables like {{age}} resolve inside
                    // {{#optional age}}...{{/optional}}.
                    if (typeof optionalPropertyValue !== 'object' || optionalPropertyValue === null) {
                        continue;
                    }

                    if (context.whenSome && context.whenSome.length > 0) {
                        // Create a paragraph wrapper for the whenSome content
                        const whenSomeParagraph = {
                            $class: 'org.accordproject.commonmark@0.5.0.Paragraph',
                            nodes: context.whenSome
                        };
                        // Process with the optional property value as the new data context
                        const subResult = await generateAgreement(modelManager, clauseLibrary, whenSomeParagraph, optionalPropertyValue, userLogic, options);
                        result[thisPath.join('/')] = subResult.nodes ? subResult.nodes : [];
                    } else {
                        result[thisPath.join('/')] = [];
                    }
                }
                // If optional property doesn't exist, we don't add anything to results
                // and the normal processing will handle whenNone
            }
        }
    }
    return result;
}

/**
 * Generates agreementmark for all recursive blocks (list, foreach)
 * Warning: this is async and recursive
 * @param {ModelManager} modelManager - the template model
 * @param {*} clauseLibrary - the clause library
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @param {RegExp} nodeRegExp - the regex used to match against $class of nodes
 * @param {string} childNodeClass - the $class to use for the node that wraps child items
 * @param {[GenerationOptions]} options - the generation options
 * @returns {*} the AgreementMark JSON for the list block
 */
async function generateRecursiveBlocks(modelManager: ModelManager, clauseLibrary: object, templateMark: object, data: TemplateData, nodeRegExp: RegExp, childNodeClass: string, userLogic: CompiledUserLogic | undefined, options?: GenerationOptions): Promise<RecursiveBlockResult> {
    const result: RecursiveBlockResult = {};
    const paths = traverse(templateMark).paths();
    for (let n = 0; n < paths.length; n++) {
        const thisPath = paths[n];
        const context = traverse(templateMark).get(thisPath);
        if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;

            // evaluate nodes, recursing on each child item
            if (nodeRegExp.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, thisPath, modelManager);
                const variableValues = jp.query(data, path, 1);

                if (variableValues.length === 0) {
                    throw new Error(`No values found for path '${path}' in data ${JSON.stringify(data)}.`);
                }
                else {
                    const arrayData = variableValues[0];
                    if (!Array.isArray(arrayData)) {
                        throw new Error(`Values found for path '${path}' in data ${data} is not an array: ${arrayData}.`);
                    }
                    else {
                        // The shape of the ListBlockDefinition's children depends on whether
                        // the markdown parser produced a CommonMark List/Item wrapping. That
                        // wrapping is only emitted when the items have leading list markers
                        // (e.g. `- ` for ulist, `1. ` for olist). When users put direct
                        // variable references inside `{{#ulist}}` / `{{#olist}}` with no
                        // leading marker (see #145), the body is parsed as a single Paragraph
                        // directly under the ListBlockDefinition.
                        const firstChild = context.nodes[0];
                        const hasListWrapper = firstChild &&
                            firstChild.$class === `${CommonMarkModel.NAMESPACE}.List` &&
                            Array.isArray(firstChild.nodes) &&
                            firstChild.nodes.length > 0;
                        // When wrapped, the per-iteration template is the first Item inside
                        // the List. Otherwise the ListBlockDefinition's first child IS the
                        // per-iteration template (typically a Paragraph).
                        const itemTemplate = hasListWrapper ? firstChild.nodes[0] : firstChild;
                        const nodes = [];
                        for (let n = 0; n < arrayData.length; n++) {
                            const arrayItem = arrayData[n];
                            // arrayItem is now the data for the nested generation
                            const subResult = await generateAgreement(modelManager, clauseLibrary, itemTemplate, arrayItem, userLogic, options);
                            // When the template had a List/Item wrapper, the processed Item's
                            // children (a Paragraph) become the children of the new output Item.
                            // Otherwise the processed block itself becomes the sole child of
                            // the new output node, preserving a valid block hierarchy.
                            const childNodes = hasListWrapper
                                ? (subResult.nodes ? subResult.nodes : [])
                                : [subResult];
                            nodes.push({
                                $class: childNodeClass,
                                nodes: childNodes
                            });
                        }
                        result[thisPath.join('/')] = nodes;
                    }
                }
            }
        }
    }
    return result;
}

/**
 * Builds the ordered list of locales to attempt when resolving a vocabulary
 * term: the requested locale, its base language when the locale is region
 * qualified, and finally 'en'.
 * @param {string} locale - the requested BCP-47 locale identifier
 * @returns {string[]} the fallback chain, most specific first
 */
function getLocaleFallbackChain(locale: string): string[] {
    const chain = [locale];
    const base = locale.split('-')[0];
    if (base && !chain.includes(base)) {
        chain.push(base);
    }
    if (!chain.includes('en')) {
        chain.push('en');
    }
    return chain;
}

/**
 * Resolves a localized term from the vocabulary carried by the generation
 * options, trying each locale in the fallback chain. Failures (for instance an
 * unknown declaration) are treated as 'no term' so that generation gracefully
 * falls back to the raw value.
 * @param {GenerationOptions | undefined} options - the generation options
 * @param {ModelManager} modelManager - the model manager
 * @param {string} namespace - the namespace of the declaration
 * @param {string} declarationName - the name of the concept or enum
 * @param {string} propertyName - the name of the property, or an enum value
 * @returns {string | undefined} the localized term, when the vocabulary has one
 */
function resolveVocabularyTerm(options: GenerationOptions | undefined, modelManager: ModelManager, namespace: string, declarationName: string, propertyName: string): string | undefined {
    const vocabularyManager = options?.vocabularyManager;
    if (!vocabularyManager || !options?.locale) {
        return undefined;
    }
    for (const locale of getLocaleFallbackChain(options.locale)) {
        try {
            const term = vocabularyManager.resolveTerm(modelManager, namespace, locale, declarationName, propertyName);
            if (term !== null && term !== undefined && term !== '') {
                return String(term);
            }
        }
        catch {
            // the declaration cannot be resolved: try the next locale
        }
    }
    return undefined;
}

/**
 * Resolves the localized label of a property by walking up from a template mark
 * node to the nearest enclosing declaration that declares a class element type
 * (issue #10). Returns undefined when no ancestor declaration carries a term.
 * @param {ModelManager} modelManager - the model manager
 * @param {Introspector} introspector - the introspector
 * @param {object} templateMark - the TemplateMark document
 * @param {Array<string | number>} path - the path of the current node
 * @param {string} propertyName - the name of the property to label
 * @param {GenerationOptions | undefined} options - the generation options
 * @returns {string | undefined} the localized label, when the vocabulary has one
 */
function resolvePropertyLabel(modelManager: ModelManager, introspector: Introspector, templateMark: object, path: Array<string | number>, propertyName: string, options?: GenerationOptions): string | undefined {
    if (!options?.vocabularyManager || !options?.locale) {
        return undefined;
    }
    let node: any = templateMark;
    const ancestors: any[] = [];
    for (let n = 0; n < path.length - 1; n++) {
        node = node?.[path[n]];
        if (node && typeof node === 'object') {
            ancestors.push(node);
        }
    }
    for (let n = ancestors.length - 1; n >= 0; n--) {
        const elementType = ancestors[n].elementType;
        if (typeof elementType !== 'string' || (ModelUtil as any).isPrimitiveType(elementType)) {
            continue;
        }
        let declaration: ClassDeclaration;
        try {
            declaration = introspector.getClassDeclaration(elementType);
        }
        catch {
            // the enclosing element type is not a class (e.g. a scalar): keep walking
            continue;
        }
        const label = resolveVocabularyTerm(options, modelManager, declaration.getNamespace(), declaration.getName(), propertyName);
        if (label) {
            return label;
        }
    }
    return undefined;
}

/**
 * Applies the vocabulary to a drafted value (issue #10). An enum value is
 * replaced by its localized term when the vocabulary defines one; otherwise the
 * localized label of the property, when found, is prepended to the drafted
 * value. The raw drafted value is returned when no vocabulary or no term is
 * available.
 * @param {ModelManager} modelManager - the model manager
 * @param {Introspector} introspector - the introspector
 * @param {object} templateMark - the TemplateMark document
 * @param {Array<string | number>} path - the path of the current node
 * @param {any} context - the current TemplateMark node
 * @param {ClassDeclaration | null} type - the declaration of the variable, when it is not a primitive type
 * @param {any} variableValue - the value read from the data
 * @param {string} draftedValue - the value after drafting
 * @param {GenerationOptions | undefined} options - the generation options
 * @returns {string} the value to render
 */
function applyVocabularyToValue(modelManager: ModelManager, introspector: Introspector, templateMark: object, path: Array<string | number>, context: any, type: ClassDeclaration | null, variableValue: any, draftedValue: string, options?: GenerationOptions): string {
    if (!options?.vocabularyManager || !options?.locale) {
        return draftedValue;
    }
    if (type && type.isEnum() && typeof variableValue === 'string') {
        const term = resolveVocabularyTerm(options, modelManager, type.getNamespace(), type.getName(), variableValue);
        if (term) {
            return term;
        }
    }
    if (context.name) {
        const label = resolvePropertyLabel(modelManager, introspector, templateMark, path, String(context.name), options);
        if (label) {
            return `${label}: ${draftedValue}`;
        }
    }
    return draftedValue;
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
async function generateAgreement(modelManager: ModelManager, clauseLibrary: object, templateMark: object, data: TemplateData, userLogic: CompiledUserLogic | undefined, options?: GenerationOptions): Promise<any> {
    const introspector = new Introspector(modelManager);
    // evaluate all the user code (async)
    const userCodeResults = await evaluateUserCode(clauseLibrary, templateMark, data, userLogic, options);
    // evaluate all recursive blocks (async)
    const listBlockResults = await generateRecursiveBlocks(modelManager, clauseLibrary, templateMark, data, LISTBLOCK_DEFINITION_RE, `${CommonMarkModel.NAMESPACE}.Item`, userLogic, options);
    const foreachBlockResults = await generateRecursiveBlocks(modelManager, clauseLibrary, templateMark, data, FOREACH_DEFINITION_RE, `${CommonMarkModel.NAMESPACE}.Paragraph`, userLogic, options);
    // evaluate all optional blocks (async)
    const optionalBlockResults = await generateOptionalBlocks(modelManager, clauseLibrary, templateMark, data, userLogic, options);
    // traverse the templatemark, creating an output agreementmark tree
    return traverse(templateMark).map(function (context: any) {
        let stopHere = false;
        if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
            const nodeClass = context.$class as string;

            // rewrite node types, mapping from TemplateMark namespace to CiceroMark
            const match = nodeClass.match(TEMPLATEMARK_RE);
            if (match && match.length > 1) {
                context.$class = `${CiceroMarkModel.NAMESPACE}.${match[3]}`;
            }

            // convert a contract node to a clause node (HACK)
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
                    const result = userCodeResults[this.path.join('/')];
                    if (result === undefined) {
                        // JSON.stringify(undefined) is undefined, which would leave the
                        // required `value` field unset and fail downstream validation.
                        throw new Error(`Formula '${context.name}' did not return a value. Formulas must be an expression or use 'return' to produce a value.`);
                    }
                    else if (result === null) {
                        context.value = '<null>';
                    }
                    else if (typeof result === 'string') {
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
                context.$class = `${CommonMarkModel.NAMESPACE}.List`;
                delete context.elementType;
                delete context.name;
                context.nodes = listBlockResults[this.path.join('/')];
                stopHere = true; // do not process child nodes, we've already done it above...
            }

            // map over an array of items, joining them into a Text node
            else if (JOIN_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path, modelManager);
                const variableValues = jp.query(data, path, 1);

                if (variableValues.length === 0) {
                    throw new Error(`No values found for path '${path}' in data ${JSON.stringify(data)}.`);
                }
                else {
                    const arrayData = variableValues[0];
                    if (!Array.isArray(arrayData)) {
                        throw new Error(`Values found for path '${path}' in data ${data} is not an array: ${arrayData}.`);
                    }
                    else {
                        context.$class = `${CommonMarkModel.NAMESPACE}.Text`;
                        const drafter = getDrafter(context.elementType);
                        // localized vocabulary terms for enum values (issue #10)
                        let enumDeclaration: ClassDeclaration | null = null;
                        if (options?.vocabularyManager && options?.locale &&
                            context.elementType && !(ModelUtil as any).isPrimitiveType(context.elementType)) {
                            try {
                                const declaration = introspector.getClassDeclaration(context.elementType);
                                if (declaration.isEnum()) {
                                    enumDeclaration = declaration;
                                }
                            }
                            catch {
                                // the element type is not a class: join the drafted values as-is
                            }
                        }
                        context.text = joinList(arrayData.map(arrayItem => {
                            const draftedValue = drafter ? drafter(arrayItem, context.format) : arrayItem as string;
                            if (enumDeclaration && typeof arrayItem === 'string') {
                                const term = resolveVocabularyTerm(options, modelManager, enumDeclaration.getNamespace(), enumDeclaration.getName(), arrayItem);
                                if (term) {
                                    return term;
                                }
                            }
                            return draftedValue;
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

            // map over an array of items, joining them into a Text node
            else if (FOREACH_DEFINITION_RE.test(nodeClass)) {
                context.$class = `${CommonMarkModel.NAMESPACE}.Foreach`;
                delete context.elementType;
                delete context.name;
                context.nodes = foreachBlockResults[this.path.join('/')];
                stopHere = true; // do not process child nodes, we've already done it above...
            }

            // add a 'value' property to VariableDefinition
            // with the value of the variable from 'data'
            else if (VARIABLE_DEFINITION_RE.test(nodeClass) ||
                ENUM_VARIABLE_DEFINITION_RE.test(nodeClass) ||
                FORMATTED_VARIABLE_DEFINITION_RE.test(nodeClass)) {
                if (typeof data === 'object') {
                    const path = getJsonPath(templateMark, context, this.path, modelManager);
                    const variableValues = jp.query(data, path, 1);
                    if (variableValues.length === 0) {
                        throw new Error(`No values found for path '${path}' in data ${JSON.stringify(data)}.`);
                    }
                    else {
                        // convert the value to a string, optionally using the formatter
                        const variableValue = variableValues[0];
                        const type = (ModelUtil as any).isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
                        // we want to draft Enums as strings, not objects
                        const drafter = getDrafter(type && type.isEnum() ? 'String' : context.elementType);
                        const draftedValue = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue) as string;
                        context.value = applyVocabularyToValue(modelManager, introspector, templateMark, this.path, context, type, variableValue, draftedValue, options);
                    }
                }
                else {
                    // a list of enum values or primitives brings us here
                    const variableValue = data;
                    const type = (ModelUtil as any).isPrimitiveType(context.elementType) ? null : introspector.getClassDeclaration(context.elementType);
                    // we want to draft Enums as strings, not objects
                    const drafter = getDrafter(type && type.isEnum() ? 'String' : context.elementType);
                    const draftedValue = drafter ? drafter(variableValue, context.format) : JSON.stringify(variableValue) as string;
                    context.value = applyVocabularyToValue(modelManager, introspector, templateMark, this.path, context, type, variableValue, draftedValue, options);
                }
            }

            // add a 'isTrue' property to ConditionDefinition
            // with the result of evaluating the JS code or a boolean property
            else if (CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
                if (context.condition) {
                    const key = this.path.join('/');
                    const resultStr = userCodeResults[key];
                    if (resultStr === undefined || resultStr === null) {
                        // Treat missing result as false (e.g., condition didn't return a value)
                        context.isTrue = false;
                    } else {
                        try {
                            // Parse the JSON-stringified result to get the actual boolean value
                            context.isTrue = !!JSON.parse(resultStr);
                        } catch (err) {
                            throw new Error(`Invalid JSON boolean result for condition '${key}': ${String(err)}`);
                        }
                    }
                }
                else {
                    const path = getJsonPath(templateMark, context, this.path, modelManager);
                    const variableValues = jp.query(data, path, 1);
                    if (variableValues && variableValues.length) {
                        if (variableValues.length === 1) {
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
                const path = getJsonPath(templateMark, context, this.path, modelManager);
                const variableValues = jp.query(data, path, 1);

                // If there's an explicit condition, evaluate it first (takes precedence over implicit check).
                // This allows conditions like "return address!==undefined" to work correctly when
                // the optional field is missing - the condition controls whether to render the clause.
                if (context.condition) {
                    checkCode(context.condition);
                    const key = this.path.join('/');
                    const resultStr = userCodeResults[key];
                    let result = false;
                    if (resultStr === undefined || resultStr === null) {
                        // Treat missing result as false (e.g., condition didn't return a value)
                        result = false;
                    } else {
                        try {
                            // Parse the JSON-stringified result to get the actual boolean value
                            result = !!JSON.parse(resultStr);
                        } catch (err) {
                            throw new Error(`Invalid JSON boolean result for condition '${key}': ${String(err)}`);
                        }
                    }
                    if (!result) {
                        delete context.nodes;
                        stopHere = true;
                    }
                }
                // Otherwise, apply implicit undefined check: skip clause block if scoped variable is undefined/null.
                // Skip this check for the root template clause (name === 'top') since its data IS the root object.
                else if (context.name !== 'top' && (variableValues.length === 0 || variableValues[0] === undefined || variableValues[0] === null)) {
                    delete context.nodes;
                    stopHere = true;
                }

                delete context.condition;
                delete context.functionName;
            }

            // add a 'hasSome' property to OptionalDefinition
            else if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
                const path = getJsonPath(templateMark, context, this.path, modelManager);
                const variableValues = jp.query(data, path, 1);
                if (variableValues && variableValues.length) {
                    if (variableValues.length === 1) {
                        context.hasSome = true;
                        context.whenNone = [];
                        // Check if we have processed optional blocks for this path
                        if (optionalBlockResults[this.path.join('/')]) {
                            context.nodes = optionalBlockResults[this.path.join('/')];
                            // Set whenSome to empty since we've processed it, but keep the field for validation
                            context.whenSome = [];
                            stopHere = true; // do not process child nodes, we've already done it above...
                        } else {
                            // scalar optionals are processed in place, with the parent data context
                            context.nodes = context.whenSome;
                            context.whenSome = [];
                        }
                    }
                    else {
                        throw new Error(`Multiple values found for path '${path}' in data ${data}.`);
                    }
                }
                else {
                    context.hasSome = false;
                    context.whenSome = [];
                    context.nodes = context.whenNone;
                }
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
    userLogic?: CompiledUserLogic;
    compilers: Map<string, Promise<TemplateMarkToJavaScriptCompiler>> = new Map();

    constructor(modelManager: ModelManager, clauseLibrary: object, templateConceptFqn?: string, userLogic?: CompiledUserLogic) {
        this.modelManager = modelManager;
        this.clauseLibrary = clauseLibrary;
        this.templateClass = getTemplateClassDeclaration(this.modelManager, templateConceptFqn);
        this.userLogic = userLogic;
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
        const modelManager = new ModelManager();
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(TemplateMarkModel.MODEL, 'templatemark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager, {});
        try {
            serializer.fromJSON(templateMark, {});
        }
        catch (err) {
            throw new Error(`Generated invalid agreement: ${err}: ${JSON.stringify(templateMark, null, 2)}`);
        }

        const errors: Array<{ propertyName: string, message: string }> = [];
        const templateClass = this.templateClass;
        const guardBlockPaths: Map<string, string> = new Map();

        traverse(templateMark).forEach(function (node: any) {
            if (!node || typeof node !== 'object' || !node.$class) return;

            const currentPath = this.path.join('/');
            if (OPTIONAL_DEFINITION_RE.test(node.$class) ||
                CONDITIONAL_DEFINITION_RE.test(node.$class) ||
                WITH_DEFINITION_RE.test(node.$class)) {
                guardBlockPaths.set(node.name, currentPath);
            }
            if (VARIABLE_DEFINITION_RE.test(node.$class) ||
                ENUM_VARIABLE_DEFINITION_RE.test(node.$class) ||
                FORMATTED_VARIABLE_DEFINITION_RE.test(node.$class)) {
                const propName = node.name;
                if (propName && propName !== 'this') {
                    try {
                        const property = templateClass.getProperty(propName);
                        if (property && property.isOptional()) {
                            const guardPath = guardBlockPaths.get(propName);
                            const isGuarded = guardPath !== undefined &&
                                (currentPath === guardPath || currentPath.startsWith(guardPath + '/'));
                            if (!isGuarded) {
                                errors.push({
                                    propertyName: propName,
                                    message: `Optional property '${propName}' is used without a guard. Wrap it in {{#optional ${propName}}}...{{/optional}} or {{#if ${propName}}}...{{/if}}.`
                                });
                            }
                        }
                    } catch {
                        // Property not found at root level, might be nested - skip
                    }
                }
            }
        });

        if (errors.length > 0) {
            const errorMessage = `Optional properties used without guards: ${errors.map(e => e.propertyName).join(', ')}`;
            const error = new Error(errorMessage);
            (error as any).errors = errors;
            throw error;
        }

        return templateMark;
    }



    /**
     * Compiles the code nodes containing TS to code nodes containing JS.
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON with JS nodes
     * @throws {Error} if the templateMark document is invalid
     */
    async compileTypeScriptToJavaScript(templateMark: object): Promise<object> {
        const clazz = (templateMark as any).$class;
        if(clazz !== DOCUMENT_ROOT) {
            throw new Error(`JSON is not CommonMark. $class is '${clazz}'. ${JSON.stringify(templateMark, null, 2)}`);
        }

        if(!(templateMark as any).nodes || !(templateMark as any).nodes.length || (templateMark as any).nodes.length < 1) {
            throw new Error(`CommonMark does not have nodes: ${JSON.stringify(templateMark, null, 2)}`);
        }
        const firstChild = (templateMark as any).nodes[0];
        const firstChildClazz = (firstChild as any).$class;

        if(!TEMPLATEMARK_ROOT_NODES.includes(firstChildClazz)) {
            throw new Error(`First child is not templatemark. $class is '${firstChildClazz}'. ${JSON.stringify(templateMark, null, 2)}`);
        }
        const templateConcept = (firstChild as any).elementType;
        if (!templateConcept) {
            throw new Error(`First child is not typed: ${JSON.stringify(templateMark, null, 2)}`);
        }
        if(firstChild.name !== 'top') {
            throw new Error('First child is not named "top"!');
        }
        if(!hasUserCode(templateMark)) {
            // nothing to compile, so don't load the TypeScript compiler
            return templateMark;
        }
        const compiler = await this.getCompiler(templateConcept);
        return compiler.compile(templateMark);
    }

    /**
     * Returns an initialized compiler for a template concept, creating it
     * on first use and reusing it for later calls.
     * @param {string} templateConcept the fully qualified name of the template concept
     * @returns {Promise<TemplateMarkToJavaScriptCompiler>} the compiler
     */
    getCompiler(templateConcept: string): Promise<TemplateMarkToJavaScriptCompiler> {
        let compiler = this.compilers.get(templateConcept);
        if(!compiler) {
            const created = new TemplateMarkToJavaScriptCompiler(this.modelManager, templateConcept, this.userLogic?.symbols ?? []);
            const initialized = created.initialize().then(() => created);
            initialized.catch(() => {
                // don't cache a failed initialization, so that a later call can retry
                if(this.compilers.get(templateConcept) === initialized) {
                    this.compilers.delete(templateConcept);
                }
            });
            this.compilers.set(templateConcept, initialized);
            compiler = initialized;
        }
        return compiler;
    }

    validateCiceroMark(ciceroMark: object): object {
        const modelManager = new ModelManager();
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(CiceroMarkModel.MODEL, 'ciceromark.cto');
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager, {});
        try {
            return serializer.fromJSON(ciceroMark, {});
        }
        catch (err) {
            throw new Error(`Generated invalid agreement: ${err}: ${JSON.stringify(ciceroMark, null, 2)}`);
        }
    }

    async generate(templateMark: object, data: TemplateData, options?: GenerationOptions): Promise<any> {
        const factory = new Factory(this.modelManager);
        const serializer = new Serializer(factory, this.modelManager, {});
        const templateData = serializer.fromJSON(data, {});
        if (templateData.getFullyQualifiedType() !== this.templateClass.getFullyQualifiedName()) {
            throw new Error(`Template data must be of type '${this.templateClass.getFullyQualifiedName()}'.`);
        }
        const typedTemplateMark = this.checkTypes(templateMark);
        const jsTemplateMark = await this.compileTypeScriptToJavaScript(typedTemplateMark);
        // console.log('Compiled JS: ' + JSON.stringify(jsTemplateMark, null, 2));
        const ciceroMark = await generateAgreement(this.modelManager, this.clauseLibrary, jsTemplateMark, data, this.userLogic, options);
        // console.log('Generated AgreementMark');
        return this.validateCiceroMark(ciceroMark);
    }
}
