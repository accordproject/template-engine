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
import { Factory, ModelManager, Serializer } from '@accordproject/concerto-core';
import { TemplateArchiveProcessor } from './TemplateArchiveProcessor';
import type { IRequest } from './agreement/logic';
import {
    AgreementJson, DocumentJson, execute, initialise, Initialised, LogicRegistry, Outcome, StateJson,
} from './agreement/execute';

/**
 * Runs an org.accordproject.agreement@1.0.0 Agreement: one tree of template instances,
 * each document the root instance and each composed clause an instance of its own, over
 * the templates they are instances of. Each instance's TemplateReference.templateId names
 * its template (the template's package name).
 *
 * Logic must be written with the logic API ('@accordproject/template-engine/logic'). Both
 * entry points are functions from JSON to JSON: the agreement, its documents and its
 * org.accordproject.runtime@1.0.0 AgreementState in, the next state and the events out.
 */
export class AgreementProcessor {
    /** The templates, by templateId. */
    readonly templates: ReadonlyMap<string, Template>;
    /** Every template's models in one model manager, against which everything is validated. */
    readonly models: ModelManager;

    private logic?: Promise<LogicRegistry>;

    /**
     * @param {Template[]} templates - the templates the agreement's instances are instances of
     */
    constructor(templates: Template[]) {
        const byId = new Map<string, Template>();
        for (const template of templates) {
            const templateId = template.getMetadata().getName();
            if (byId.has(templateId)) {
                throw new Error(`Two templates are named '${templateId}'.`);
            }
            byId.set(templateId, template);
        }
        this.templates = byId;
        this.models = AgreementProcessor.mergeModels(templates);
    }

    /**
     * One model manager holding every template's models. A namespace several templates
     * load must be identical in each.
     * @param {Template[]} templates - the templates
     * @returns {ModelManager} the models
     */
    static mergeModels(templates: Template[]): ModelManager {
        const models = new ModelManager();
        const sources = new Map<string, { definitions: string, template: string }>();
        for (const template of templates) {
            const name = template.getMetadata().getName();
            for (const modelFile of template.getModelManager().getModelFiles()) {
                const namespace = modelFile.getNamespace();
                const definitions = modelFile.getDefinitions();
                const seen = sources.get(namespace);
                if (seen) {
                    if (seen.definitions !== definitions) {
                        throw new Error(`Templates '${seen.template}' and '${name}' define ${namespace} differently.`);
                    }
                    continue;
                }
                sources.set(namespace, { definitions, template: name });
                models.addCTOModel(definitions, modelFile.getName(), true);
            }
        }
        models.validateModelFiles();
        return models;
    }

    /**
     * Validates a value against every template's models: an Agreement, an
     * AgreementDocument, an AgreementState, or any other instance of their types.
     * @param {object} value - the value, as JSON
     * @throws {Error} if the value is not valid
     */
    validate(value: object): void {
        new Serializer(new Factory(this.models), this.models).fromJSON(structuredClone(value));
    }

    /**
     * Each template's logic, by templateId; templates without logic are stateless.
     * @returns {Promise<LogicRegistry>} the logic
     */
    private loadLogic(): Promise<LogicRegistry> {
        if (!this.logic) {
            this.logic = (async () => {
                const registry: Record<string, any> = {};
                for (const [templateId, template] of this.templates) {
                    if (!template.hasLogic()) {
                        continue;
                    }
                    const processor = new TemplateArchiveProcessor(template);
                    if (!processor.usesLogicApi()) {
                        throw new Error(`Template '${templateId}' has TemplateLogic logic; an agreement needs logic written with '@accordproject/template-engine/logic'.`);
                    }
                    registry[templateId] = await processor.loadLogic();
                }
                return registry;
            })();
            this.logic.catch(() => { this.logic = undefined; });
        }
        return this.logic;
    }

    /**
     * Initialises every instance in the agreement, as revision 0.
     * @param {AgreementJson} agreement - the agreement
     * @param {DocumentJson[]} documents - its documents
     * @param {string} effectiveAt - when it takes effect
     * @returns {Promise<Initialised>} its state, and the events init emitted
     */
    async initialise(agreement: AgreementJson, documents: DocumentJson[], effectiveAt: string): Promise<Initialised> {
        return initialise(agreement, documents, effectiveAt, await this.loadLogic(), { models: this.models });
    }

    /**
     * Runs `request` against a document's logic, from `state`.
     * @param {object} snapshot - the agreement, its documents and its state
     * @param {string} documentId - the document whose logic handles the request
     * @param {IRequest} request - the request
     * @returns {Promise<Outcome>} the response, the events emitted, and the next state
     */
    async execute(
        snapshot: { agreement: AgreementJson; documents: DocumentJson[]; state: StateJson },
        documentId: string,
        request: IRequest,
    ): Promise<Outcome> {
        return execute(snapshot, documentId, request, await this.loadLogic(), { models: this.models });
    }
}
