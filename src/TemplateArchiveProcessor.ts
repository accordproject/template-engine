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

import { Template } from '@accordproject/cicero-core';
import { TemplateMarkInterpreter } from './TemplateMarkInterpreter';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { transform } from '@accordproject/markdown-transform';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
import Script from '@accordproject/cicero-core/types/src/script';
import { TwoSlashReturn } from '@typescript/twoslash';
import { JavaScriptEvaluator } from './JavaScriptEvaluator';
import { SMART_LEGAL_CONTRACT_BASE64 } from './runtime/declarations';

// import LLM executor + config
import { LLMExecutor } from './llm/LLMExecutor';
import { LLMExecutorConfig } from './llm/LLMConfig';

export type State = object;
export type Response = object;
export type Event = object;

export type TriggerResponse = {
    result: Response;
    state: State;
    events: Event[];
};

export type InitResponse = {
    state: State;
};

/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive
 */
export class TemplateArchiveProcessor {
    template: Template;

    // optional LLM config
    llmConfig?: LLMExecutorConfig;

    /**
     * Creates a template archive processor
     * @param {Template} template - the template to be used by the processor
     * @param {LLMExecutorConfig} llmConfig - optional LLM fallback configuration
     */
    constructor(template: Template, llmConfig?: LLMExecutorConfig) {
        this.template = template;
        this.llmConfig = llmConfig;
    }

    /**
     * Drafts a template by merging it with data
     * @param {any} data the data to merge with the template
     * @param {string} format the output format
     * @param {any} options merge options
     * @param {[string]} currentTime the current value for 'now'
     * @returns {Promise} the drafted content
     */
    async draft(data: any, format: string, options: any, currentTime?: string): Promise<any> {
        const metadata = this.template.getMetadata();
        const templateKind = metadata.getTemplateType() !== 0 ? 'clause' : 'contract';

        const modelManager = this.template.getModelManager();
        const engine = new TemplateMarkInterpreter(modelManager, {});
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
            { content: this.template.getTemplate() }, modelManager, templateKind, { options }
        );
        const now = currentTime ? currentTime : new Date().toISOString();
        const ciceroMark = await engine.generate(templateMarkDom, data, { now });
        const result = transform(ciceroMark.toJSON(), 'ciceromark', ['ciceromark_unquoted', format], null, options);
        return result;
    }

    // helper to check if explicit TS logic exists
    private hasTypeScriptLogic(): boolean {
        const logicManager = this.template.getLogicManager();
        if (!logicManager) {
            return false;
        }

        if (logicManager.getLanguage() !== 'typescript') {
            return false;
        }

        const tsFiles: Array<Script> = logicManager.getScriptManager().getScriptsForTarget('typescript');
        return tsFiles.length > 0;
    }

    // helper to check if LLM fallback is enabled
    private shouldUseLLM(): boolean {
        return !!this.llmConfig && this.llmConfig.mode !== 'disabled';
    }

    // construct executor
    private makeLLMExecutor(): LLMExecutor {
        if (!this.llmConfig) {
            throw new Error('LLM fallback requested but llmConfig is missing');
        }
        return new LLMExecutor(this.template, this.llmConfig);
    }

    // extracted existing TS trigger flow into its own method
    private async executeTypeScriptTrigger(
        data: any,
        request: any,
        state?: any,
        currentTime?: string,
        utcOffset?: number
    ): Promise<TriggerResponse> {
        const logicManager = this.template.getLogicManager();
        const compiledCode: Record<string, TwoSlashReturn> = {};
        const tsFiles: Array<Script> = logicManager.getScriptManager().getScriptsForTarget('typescript');

        for (let n = 0; n < tsFiles.length; n++) {
            const tsFile = tsFiles[n];

            const compiler = new TypeScriptToJavaScriptCompiler(
                this.template.getModelManager(),
                this.template.getTemplateModel().getFullyQualifiedName()
            );

            await compiler.initialize();

            const code = `${Buffer.from(SMART_LEGAL_CONTRACT_BASE64, 'base64').toString()}
${tsFile.getContents()}`;

            const result = compiler.compile(code);
            compiledCode[tsFile.getIdentifier()] = result;
        }

        const evaluator = new JavaScriptEvaluator();
        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName: 'trigger',
            code: compiledCode['logic/logic.ts'].code, // existing assumption retained
            argumentNames: ['data', 'request', 'state'],
            arguments: [data, request, state, currentTime, utcOffset]
        });

        if (evalResponse.result) {
            return evalResponse.result;
        } else {
            throw new Error('Trigger failed with message: ' + evalResponse.message);
        }
    }

    // extracted existing TS init flow into its own method
    private async executeTypeScriptInit(
        data: any,
        currentTime?: string,
        utcOffset?: number
    ): Promise<InitResponse> {
        const logicManager = this.template.getLogicManager();
        const compiledCode: Record<string, TwoSlashReturn> = {};
        const tsFiles: Array<Script> = logicManager.getScriptManager().getScriptsForTarget('typescript');

        for (let n = 0; n < tsFiles.length; n++) {
            const tsFile = tsFiles[n];

            const compiler = new TypeScriptToJavaScriptCompiler(
                this.template.getModelManager(),
                this.template.getTemplateModel().getFullyQualifiedName()
            );

            await compiler.initialize();

            const code = `${Buffer.from(SMART_LEGAL_CONTRACT_BASE64, 'base64').toString()}
${tsFile.getContents()}`;

            const result = compiler.compile(code);
            compiledCode[tsFile.getIdentifier()] = result;
        }

        const evaluator = new JavaScriptEvaluator();
        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName: 'init',
            code: compiledCode['logic/logic.ts'].code, // existing assumption retained
            argumentNames: ['data'],
            arguments: [data, currentTime, utcOffset]
        });

        if (evalResponse.result) {
            return evalResponse.result;
        } else {
            throw new Error('Init failed with message: ' + evalResponse.message);
        }
    }

    /**
     * Trigger the logic of a template
     * @param {object} request - the request to send to the template logic
     * @param {object} state - the current state of the template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @returns {Promise} the response and any events
     */
    async trigger(
        data: any,
        request: any,
        state?: any,
        currentTime?: string,
        utcOffset?: number
    ): Promise<TriggerResponse> {

        console.log(`\n[TemplateArchiveProcessor.trigger]`);
        console.log(`Mode: ${this.llmConfig?.mode ?? 'disabled'}`);

        // FORCE mode
        if (this.llmConfig?.mode === 'force') {
            console.log("Using LLM executor (FORCE mode)");
            return this.makeLLMExecutor().trigger(data, request, state, currentTime, utcOffset);
        }

        // TypeScript logic path
        if (this.hasTypeScriptLogic()) {
            console.log("Using TypeScript logic executor");
            return this.executeTypeScriptTrigger(data, request, state, currentTime, utcOffset);
        }

        // Fallback to LLM
        if (this.shouldUseLLM()) {
            console.log("Using LLM executor (FALLBACK mode)");
            return this.makeLLMExecutor().trigger(data, request, state, currentTime, utcOffset);
        }

        console.log("No executor available");
        throw new Error('No TypeScript logic found and LLM fallback is disabled');
    }
    /**
     * Init the logic of a template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @returns {Promise} the response and any events
     */
    async init(
    data: any,
    currentTime?: string,
    utcOffset?: number
    ): Promise<InitResponse> {

        console.log(`\n[TemplateArchiveProcessor.init]`);
        console.log(`Mode: ${this.llmConfig?.mode ?? 'disabled'}`);

        // FORCE mode
        if (this.llmConfig?.mode === 'force') {
            console.log("Using LLM executor (FORCE mode)");
            return this.makeLLMExecutor().init(data, currentTime, utcOffset);
        }

        // TypeScript logic path
        if (this.hasTypeScriptLogic()) {
            console.log("Using TypeScript logic executor");
            return this.executeTypeScriptInit(data, currentTime, utcOffset);
        }

        // Fallback to LLM
        if (this.shouldUseLLM()) {
            console.log("Using LLM executor (FALLBACK mode)");
            return this.makeLLMExecutor().init(data, currentTime, utcOffset);
        }

        console.log("No executor available");
        throw new Error('No TypeScript logic found and LLM fallback is disabled');
    }
}
