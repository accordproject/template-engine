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
    TemplateData
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

interface Scope {
    data: any;                 // current data context
    parent?: Scope;            // optional, for fall-back name lookup
    elementType?: string;      // concerto type of `data`, for typing / scalar detection
    thisValue?: any;           // for scalar optionals, binds `this`
}

interface EvaluationContext {
    modelManager: ModelManager;
    introspector: Introspector;
    clauseLibrary: object;
    userLogic?: CompiledUserLogic;
    options?: GenerationOptions;
}

/**
 * Prepares the data object passed to evaluateJavaScript so that formulas
 * have access to local properties on scope.data, as well as parent/root properties
 * required by the compiled TypeScript function prelude.
 */
function getEvaluationData(scope: Scope): any {
    let current: Scope | undefined = scope;
    const scopes: Scope[] = [];
    while (current) {
        scopes.unshift(current);
        current = current.parent;
    }
    const merged: any = {};
    for (const s of scopes) {
        if (s.data !== null && typeof s.data === 'object' && !Array.isArray(s.data)) {
            Object.assign(merged, s.data);
        }
    }
    if (scope.thisValue !== undefined) {
        merged.this = scope.thisValue;
    } else if (typeof scope.data !== 'object' || scope.data === null) {
        merged.this = scope.data;
    }
    return merged;
}

/**
 * Resolves a variable name within the given scope, checking local properties,
 * `this`, and falling back to parent scopes.
 */
function resolveVariableValue(name: string, scope: Scope): any {
    if (name === 'this') {
        if (scope.thisValue !== undefined) {
            return scope.thisValue;
        }
        return scope.data;
    }
    if (scope.data !== null && typeof scope.data === 'object' && name in scope.data && scope.data[name] !== undefined) {
        return scope.data[name];
    }
    if (scope.parent) {
        return resolveVariableValue(name, scope.parent);
    }
    if (scope.data !== null && typeof scope.data === 'object' && name in scope.data) {
        return scope.data[name];
    }
    throw new Error(`No values found for path '$['${name}']' in data ${JSON.stringify(scope.data)}.`);
}

/**
 * Resolves the value for an optional block.
 */
function resolveOptionalValue(name: string, scope: Scope): any {
    if (name === 'this') {
        if (scope.thisValue !== undefined) {
            return scope.thisValue;
        }
        return scope.data;
    }
    if (scope.data !== null && typeof scope.data === 'object' && name in scope.data) {
        return scope.data[name];
    }
    return undefined;
}

/**
 * Determines the item template for a ListBlockDefinition based on whether
 * its body is wrapped in a CommonMark List/Item, multi-block, or a single block.
 */
function itemTemplate(listDef: any): { template: any; isUnwrappedSingleBlock: boolean } {
    if (!Array.isArray(listDef.nodes) || listDef.nodes.length === 0) {
        return { template: undefined, isUnwrappedSingleBlock: false };
    }
    const firstChild = listDef.nodes[0];
    const hasListWrapper = firstChild &&
        firstChild.$class === `${CommonMarkModel.NAMESPACE}.List` &&
        Array.isArray(firstChild.nodes) &&
        firstChild.nodes.length > 0;
    const hasMultiBlockListBody = !hasListWrapper && listDef.nodes.length > 1;

    if (hasListWrapper) {
        return { template: firstChild.nodes[0], isUnwrappedSingleBlock: false };
    }
    if (hasMultiBlockListBody) {
        return {
            template: {
                $class: `${CommonMarkModel.NAMESPACE}.Item`,
                nodes: listDef.nodes
            },
            isUnwrappedSingleBlock: false
        };
    }
    return { template: firstChild, isUnwrappedSingleBlock: true };
}

/**
 * Recursively evaluates a TemplateMark AST node in the given Scope.
 */
async function evaluate(node: any, scope: Scope, ctx: EvaluationContext): Promise<any> {
    if (!node || typeof node !== 'object') {
        return node;
    }

    if (Array.isArray(node)) {
        const evaluated = await Promise.all(node.map((child: any) => evaluate(child, scope, ctx)));
        return evaluated.flat();
    }

    const nodeClass = node.$class;
    if (!nodeClass || typeof nodeClass !== 'string') {
        const out: any = {};
        for (const key of Object.keys(node)) {
            out[key] = await evaluate(node[key], scope, ctx);
        }
        return out;
    }

    // ContractDefinition
    if (CONTRACT_DEFINITION_RE.test(nodeClass)) {
        const childScope: Scope = {
            data: scope.data,
            parent: scope,
            elementType: node.elementType
        };
        const childNodes = Array.isArray(node.nodes)
            ? (await Promise.all(node.nodes.map((child: any) => evaluate(child, childScope, ctx)))).flat()
            : [];
        const out: any = { ...node };
        out.$class = `${CommonMarkModel.NAMESPACE}.Paragraph`;
        delete out.name;
        delete out.elementType;
        out.nodes = childNodes;
        return out;
    }

    // ClauseDefinition
    if (CLAUSE_DEFINITION_RE.test(nodeClass)) {
        let includeClause = true;
        if (node.condition) {
            checkCode(node.condition);
            const evalData = getEvaluationData(scope);
            const evalResponse = await evaluateJavaScript(ctx.clauseLibrary, evalData, node.condition.contents, ctx.userLogic, ctx.options);
            includeClause = !!evalResponse.result;
        } else if (node.name !== 'top') {
            const clauseData = (scope.data !== null && typeof scope.data === 'object') ? scope.data[node.name] : undefined;
            if (clauseData === undefined || clauseData === null) {
                includeClause = false;
            }
        }

        const out: any = { ...node };
        out.$class = `${CiceroMarkModel.NAMESPACE}.Clause`;
        delete out.condition;
        delete out.functionName;

        if (!includeClause) {
            delete out.nodes;
            return out;
        }

        const childData = node.name === 'top'
            ? scope.data
            : ((scope.data !== null && typeof scope.data === 'object') ? scope.data[node.name] : undefined);
        const childScope: Scope = {
            data: childData,
            parent: scope,
            elementType: node.elementType
        };
        const childNodes = Array.isArray(node.nodes)
            ? (await Promise.all(node.nodes.map((child: any) => evaluate(child, childScope, ctx)))).flat()
            : [];
        out.nodes = childNodes;
        return out;
    }

    // WithDefinition
    if (WITH_DEFINITION_RE.test(nodeClass)) {
        const childData = (scope.data !== null && typeof scope.data === 'object') ? scope.data[node.name] : undefined;
        const childScope: Scope = {
            data: childData,
            parent: scope,
            elementType: node.elementType
        };
        const childNodes = Array.isArray(node.nodes)
            ? (await Promise.all(node.nodes.map((child: any) => evaluate(child, childScope, ctx)))).flat()
            : [];
        const out: any = { ...node };
        out.$class = `${CommonMarkModel.NAMESPACE}.Paragraph`;
        delete out.name;
        delete out.elementType;
        out.nodes = childNodes;
        return out;
    }

    // OptionalDefinition
    if (OPTIONAL_DEFINITION_RE.test(nodeClass)) {
        const rawVal = resolveOptionalValue(node.name, scope);
        const hasSome = rawVal !== undefined && rawVal !== null;
        const isScalar = isScalarType(ctx.modelManager, node.elementType) ||
            (hasSome && (typeof rawVal !== 'object'));

        const out: any = { ...node };
        out.$class = `${CiceroMarkModel.NAMESPACE}.Optional`;
        out.hasSome = hasSome;

        if (hasSome) {
            const childScope: Scope = isScalar ? {
                data: scope.data,
                parent: scope,
                elementType: node.elementType,
                thisValue: rawVal
            } : {
                data: rawVal,
                parent: scope,
                elementType: node.elementType
            };

            const evaluatedNodes = Array.isArray(node.whenSome)
                ? (await Promise.all(node.whenSome.map((child: any) => evaluate(child, childScope, ctx)))).flat()
                : [];
            out.nodes = evaluatedNodes;
            out.whenSome = [];
            out.whenNone = [];
        } else {
            const evaluatedNodes = Array.isArray(node.whenNone)
                ? (await Promise.all(node.whenNone.map((child: any) => evaluate(child, scope, ctx)))).flat()
                : [];
            out.nodes = evaluatedNodes;
            out.whenSome = [];
            out.whenNone = evaluatedNodes;
        }
        return out;
    }

    // ListBlockDefinition
    if (LISTBLOCK_DEFINITION_RE.test(nodeClass)) {
        if (scope.data === null || typeof scope.data !== 'object' || !(node.name in scope.data)) {
            throw new Error(`No values found for path '$['${node.name}']' in data ${JSON.stringify(scope.data)}.`);
        }
        const arrayData = scope.data[node.name];
        if (!Array.isArray(arrayData)) {
            throw new Error(`Values found for path '$['${node.name}']' in data ${scope.data} is not an array: ${arrayData}.`);
        }

        const { template, isUnwrappedSingleBlock } = itemTemplate(node);
        const itemNodes: any[] = [];
        if (template) {
            for (let n = 0; n < arrayData.length; n++) {
                const arrayItem = arrayData[n];
                const itemScope: Scope = {
                    data: arrayItem,
                    parent: scope,
                    elementType: node.elementType
                };
                const subResult = await evaluate(template, itemScope, ctx);
                const childNodes = isUnwrappedSingleBlock
                    ? [subResult]
                    : (subResult && subResult.nodes ? subResult.nodes : []);
                itemNodes.push({
                    $class: `${CommonMarkModel.NAMESPACE}.Item`,
                    nodes: childNodes
                });
            }
        }

        const out: any = { ...node };
        out.$class = `${CommonMarkModel.NAMESPACE}.List`;
        delete out.elementType;
        delete out.name;
        out.nodes = itemNodes;
        return out;
    }

    // ForeachDefinition
    if (FOREACH_DEFINITION_RE.test(nodeClass)) {
        if (scope.data === null || typeof scope.data !== 'object' || !(node.name in scope.data)) {
            throw new Error(`No values found for path '$['${node.name}']' in data ${JSON.stringify(scope.data)}.`);
        }
        const arrayData = scope.data[node.name];
        if (!Array.isArray(arrayData)) {
            throw new Error(`Values found for path '$['${node.name}']' in data ${scope.data} is not an array: ${arrayData}.`);
        }

        const itemTmpl = node.nodes && node.nodes[0];
        const itemNodes: any[] = [];
        if (itemTmpl) {
            for (let n = 0; n < arrayData.length; n++) {
                const arrayItem = arrayData[n];
                const itemScope: Scope = {
                    data: arrayItem,
                    parent: scope,
                    elementType: node.elementType
                };
                const subResult = await evaluate(itemTmpl, itemScope, ctx);
                itemNodes.push({
                    $class: `${CommonMarkModel.NAMESPACE}.Paragraph`,
                    nodes: [subResult]
                });
            }
        }

        const out: any = { ...node };
        out.$class = `${CommonMarkModel.NAMESPACE}.Foreach`;
        delete out.elementType;
        delete out.name;
        out.nodes = itemNodes;
        return out;
    }

    // JoinDefinition
    if (JOIN_DEFINITION_RE.test(nodeClass)) {
        if (scope.data === null || typeof scope.data !== 'object' || !(node.name in scope.data)) {
            throw new Error(`No values found for path '$['${node.name}']' in data ${JSON.stringify(scope.data)}.`);
        }
        const arrayData = scope.data[node.name];
        if (!Array.isArray(arrayData)) {
            throw new Error(`Values found for path '$['${node.name}']' in data ${scope.data} is not an array: ${arrayData}.`);
        }

        const out: any = { ...node };
        out.$class = `${CommonMarkModel.NAMESPACE}.Text`;
        const drafter = getDrafter(node.elementType);
        out.text = joinList(arrayData.map((arrayItem: any) => {
            return drafter ? drafter(arrayItem, node.format) : arrayItem as string;
        }), node, ctx.options);
        delete out.elementType;
        delete out.name;
        delete out.separator;
        delete out.locale;
        delete out.type;
        delete out.style;
        delete out.nodes;
        return out;
    }

    // FormulaDefinition
    if (FORMULA_DEFINITION_RE.test(nodeClass)) {
        if (!node.code) {
            throw new Error('Formula node is missing code.');
        }
        checkCode(node.code);
        const evalData = getEvaluationData(scope);
        const evalResponse = await evaluateJavaScript(ctx.clauseLibrary, evalData, node.code.contents, ctx.userLogic, ctx.options);
        const rawResult = evalResponse.result;

        const out: any = { ...node };
        if (rawResult === undefined) {
            throw new Error(`Formula '${node.name}' did not return a value. Formulas must be an expression or use 'return' to produce a value.`);
        } else if (rawResult === null) {
            out.value = '<null>';
        } else {
            out.value = JSON.stringify(rawResult);
        }
        delete out.code;
        out.$class = `${CiceroMarkModel.NAMESPACE}.Formula`;
        return out;
    }

    // ConditionalDefinition
    if (CONDITIONAL_DEFINITION_RE.test(nodeClass)) {
        let isTrue = false;
        if (node.condition) {
            checkCode(node.condition);
            const evalData = getEvaluationData(scope);
            const evalResponse = await evaluateJavaScript(ctx.clauseLibrary, evalData, node.condition.contents, ctx.userLogic, ctx.options);
            if (evalResponse.result !== undefined && evalResponse.result !== null) {
                isTrue = !!evalResponse.result;
            }
        } else {
            if (scope.data !== null && typeof scope.data === 'object' && node.name in scope.data) {
                isTrue = !!scope.data[node.name];
            } else {
                isTrue = false;
            }
        }

        const chosenBranch = isTrue ? node.whenTrue : node.whenFalse;
        const evaluatedNodes = Array.isArray(chosenBranch)
            ? (await Promise.all(chosenBranch.map((child: any) => evaluate(child, scope, ctx)))).flat()
            : [];

        const out: any = { ...node };
        out.$class = `${CiceroMarkModel.NAMESPACE}.Conditional`;
        out.isTrue = isTrue;
        out.nodes = evaluatedNodes;
        delete out.condition;
        delete out.dependencies;
        delete out.functionName;
        return out;
    }

    // VariableDefinition, EnumVariableDefinition, FormattedVariableDefinition
    if (VARIABLE_DEFINITION_RE.test(nodeClass) ||
        ENUM_VARIABLE_DEFINITION_RE.test(nodeClass) ||
        FORMATTED_VARIABLE_DEFINITION_RE.test(nodeClass)) {
        const variableValue = resolveVariableValue(node.name, scope);
        const type = (ModelUtil as any).isPrimitiveType(node.elementType) ? null : ctx.introspector.getClassDeclaration(node.elementType);
        const drafter = getDrafter(type && type.isEnum() ? 'String' : node.elementType);
        const value = drafter ? drafter(variableValue, node.format) : JSON.stringify(variableValue) as string;

        const out: any = { ...node };
        out.value = value;
        const match = nodeClass.match(TEMPLATEMARK_RE);
        if (match && match.length > 1) {
            out.$class = `${CiceroMarkModel.NAMESPACE}.${match[3]}`;
        }
        return out;
    }

    // Generic TemplateMark or CommonMark node (e.g. Document, Paragraph, Heading, etc.)
    const match = nodeClass.match(TEMPLATEMARK_RE);
    const out: any = { ...node };
    if (match && match.length > 1) {
        out.$class = `${CiceroMarkModel.NAMESPACE}.${match[3]}`;
    }
    if (Array.isArray(node.nodes)) {
        const evaluatedChildren = await Promise.all(node.nodes.map((child: any) => evaluate(child, scope, ctx)));
        out.nodes = evaluatedChildren.flat();
    }
    return out;
}

/**
 * Generates an AgreementMark JSON document from a template plus data.
 * @param {ModelManager} modelManager - the template model
 * @param {*} clauseLibrary - the clause library
 * @param {*} templateMark - the TemplateMark JSON document
 * @param {*} data - the template data JSON
 * @param {CompiledUserLogic} userLogic - the compiled logic/logic.ts, exposing its helpers
 * @param {[GenerationOptions]} options - the generation options
 * @returns {*} the AgreementMark JSON
 */
async function generateAgreement(modelManager: ModelManager, clauseLibrary: object, templateMark: object, data: TemplateData, userLogic: CompiledUserLogic | undefined, options?: GenerationOptions): Promise<any> {
    const introspector = new Introspector(modelManager);
    const ctx: EvaluationContext = {
        modelManager,
        introspector,
        clauseLibrary,
        userLogic,
        options
    };
    const rootScope: Scope = {
        data
    };
    return evaluate(templateMark, rootScope, ctx);
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
