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

import { ModelManager } from '@accordproject/concerto-core';
import { Template } from '@accordproject/cicero-core';
import { TemplateMarkInterpreter } from './TemplateMarkInterpreter';

/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive
 */
export class TemplateArchiveProcessor {
    template: Template;

    constructor(template: Template) {
        this.template = template;
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
    async draft(data: any, format: string, options: any, currentTime?: string, utcOffset?: number): Promise<any> {
        // Setup
        const metadata = this.template.getMetadata();
        const templateKind = metadata.getTemplateType() !== 0 ? 'clause' : 'contract';

        // Get the data
        const modelManager = this.template.getModelManager();
        const engine = new TemplateMarkInterpreter(modelManager, {});
        const templateMarkTransformer = new TemplateMarkTransformer();
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
            { content: this.template.getTemplate() }, modelManager, templateKind, options);
        const now = currentTime ? currentTime : new Date().toISOString();
        const ciceroMark = await engine.generate(templateMarkDom, data, { now });
        console.log(JSON.stringify(ciceroMark));
        const result = transform(ciceroMark.toJSON(), 'ciceromark', ['ciceromark_unquoted', format], null, options);
        console.log(result);
        return result;

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
    async trigger(request: any, state: any, currentTime?: string, utcOffset?: number): Promise<any> {
    }
}