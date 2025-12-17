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
import Script from '@accordproject/cicero-core/types/src/script';
import { JavaScriptEvaluator } from './JavaScriptEvaluator';

export type State = object;
export type Response = object;
export type Event = object;

export type TriggerResponse = {
    result: Response;
    state: State;
    events: Event[];
}

export type InitResponse = {
    state: State;
}

/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive
 */
export class TemplateArchiveProcessor {
    template: Template;

    /**
     * Creates a template archive processor
     * @param {Template} template - the template to be used by the processor
     */
    constructor(template: Template) {
        this.template = template;
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
        // Setup
        const metadata = this.template.getMetadata();
        const templateKind = metadata.getTemplateType() !== 0 ? 'clause' : 'contract';

        // Get the data
        const modelManager = this.template.getModelManager();
        const engine = new TemplateMarkInterpreter(modelManager, {});
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
            { content: this.template.getTemplate() }, modelManager, templateKind, {options});
        const now = currentTime ? currentTime : new Date().toISOString();
        // console.log(JSON.stringify(templateMarkDom, null, 2));
        const ciceroMark = await engine.generate(templateMarkDom, data, { now });
        // console.log(JSON.stringify(ciceroMark));
        const result = transform(ciceroMark.toJSON(), 'ciceromark', ['ciceromark_unquoted', format], null, options);
        // console.log(result);
        return result;

    }

    /**
     * Trigger the logic of a template
     * @param {object} request - the request to send to the template logic
     * @param {object} state - the current state of the template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offer, defaults to zero
     * @returns {Promise} the response and any events
     */
    async trigger(data: any, request: any, state?: any, currentTime?: string, utcOffset?: number): Promise<TriggerResponse> {
        const logicManager = this.template.getLogicManager();
        if(logicManager.getLanguage() === 'es6') {
            const jsFiles:Array<Script> = logicManager.getScriptManager().getScriptsForTarget('es6');
            const main = jsFiles.find((script) => script.getIdentifier() === 'logic/logic.js');
            if(!main) {
                throw new Error('Failed to find logic.js');
            }
            
            const evaluator = new JavaScriptEvaluator();
            const evalResponse = await evaluator.evalDangerously( {
                templateLogic: true,
                verbose: false,
                functionName: 'trigger',
                code: main.contents,
                argumentNames: ['data', 'request', 'state'],
                arguments: [data, request, state, currentTime, utcOffset]
            });
            if(evalResponse.result) {
                return evalResponse.result;
            }
            else {
                throw new Error('Trigger failed with message: ' + evalResponse.message);
            }
        }
        else {
            throw new Error('Only JavaScript is supported at this time');
        }
    }

    /**
     * Init the logic of a template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offer, defaults to zero
     * @returns {Promise} the response and any events
     */
    async init(data: any, currentTime?: string, utcOffset?: number): Promise<InitResponse> {
        const logicManager = this.template.getLogicManager();
        if(logicManager.getLanguage() === 'es6') {
            const jsFiles:Array<Script> = logicManager.getScriptManager().getScriptsForTarget('es6');
            const main = jsFiles.find((script) => script.getIdentifier() === 'logic/logic.js');
            if(!main) {
                throw new Error('Failed to find logic.js');
            }
            const evaluator = new JavaScriptEvaluator();
            const evalResponse = await evaluator.evalDangerously( {
                templateLogic: true,
                verbose: false,
                functionName: 'init',
                code: main.contents,
                argumentNames: ['data'],
                arguments: [data, currentTime, utcOffset]
            });
            if(evalResponse.result) {
                return evalResponse.result;
            }
            else {
                throw new Error('Init failed with message: ' + evalResponse.message);
            }
        }
        else {
            throw new Error('Only JavaScript is supported at this time');
        }
    }
}
