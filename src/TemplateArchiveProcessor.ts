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
    async trigger(data: any, request: any, state?: any, currentTime?: string, utcOffset?: number): Promise<any> {
        const logicManager = this.template.getLogicManager();
        if(logicManager.getLanguage() === 'typescript') {
            const compiledCode:Record<string, TwoSlashReturn> = {};
            const tsFiles:Array<Script> = logicManager.getScriptManager().getScriptsForTarget('typescript');
            for(let n=0; n < tsFiles.length; n++) {
                const tsFile = tsFiles[n];
                // console.log(`Compiling ${tsFile.getIdentifier()}`);

                const compiler = new TypeScriptToJavaScriptCompiler(this.template.getModelManager(),
                    this.template.getTemplateModel().getFullyQualifiedName());

                await compiler.initialize();

                // add the runtime type definitions to all ts files??
                const code = `${Buffer.from(SMART_LEGAL_CONTRACT_BASE64, 'base64').toString()}
                ${tsFile.getContents()}`

                const result = compiler.compile(code);
                compiledCode[tsFile.getIdentifier()] = result;
            }
            // console.log(compiledCode['logic/logic.ts'].code);
            const evaluator = new JavaScriptEvaluator();
            const evalResponse = await evaluator.evalDangerously( {
                templateLogic: true,
                verbose: false,
                code: compiledCode['logic/logic.ts'].code, // TODO DCS - how to find the code to run?
                argumentNames: ['data', 'request', 'state'],
                arguments: [data, request, state, currentTime, utcOffset]
            });
            return evalResponse.result;
        }
        else {
            return -1;
        }
    }
}
