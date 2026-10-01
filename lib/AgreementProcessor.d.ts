import { Template } from '@accordproject/cicero-core';
import { ModelManager } from '@accordproject/concerto-core';
import type { IRequest } from './agreement/logic';
import { AgreementJson, DocumentJson, Initialised, Outcome, StateJson } from './agreement/execute';
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
export declare class AgreementProcessor {
    /** The templates, by templateId. */
    readonly templates: ReadonlyMap<string, Template>;
    /** Every template's models in one model manager, against which everything is validated. */
    readonly models: ModelManager;
    private logic?;
    /**
     * @param {Template[]} templates - the templates the agreement's instances are instances of
     */
    constructor(templates: Template[]);
    /**
     * One model manager holding every template's models. A namespace several templates
     * load must be identical in each.
     * @param {Template[]} templates - the templates
     * @returns {ModelManager} the models
     */
    static mergeModels(templates: Template[]): ModelManager;
    /**
     * Validates a value against every template's models: an Agreement, an
     * AgreementDocument, an AgreementState, or any other instance of their types.
     * @param {object} value - the value, as JSON
     * @throws {Error} if the value is not valid
     */
    validate(value: object): void;
    /**
     * Each template's logic, by templateId; templates without logic are stateless.
     * @returns {Promise<LogicRegistry>} the logic
     */
    private loadLogic;
    /**
     * Initialises every instance in the agreement, as revision 0.
     * @param {AgreementJson} agreement - the agreement
     * @param {DocumentJson[]} documents - its documents
     * @param {string} effectiveAt - when it takes effect
     * @returns {Promise<Initialised>} its state, and the events init emitted
     */
    initialise(agreement: AgreementJson, documents: DocumentJson[], effectiveAt: string): Promise<Initialised>;
    /**
     * Runs `request` against a document's logic, from `state`.
     * @param {object} snapshot - the agreement, its documents and its state
     * @param {string} documentId - the document whose logic handles the request
     * @param {IRequest} request - the request
     * @returns {Promise<Outcome>} the response, the events emitted, and the next state
     */
    execute(snapshot: {
        agreement: AgreementJson;
        documents: DocumentJson[];
        state: StateJson;
    }, documentId: string, request: IRequest): Promise<Outcome>;
}
