import type { ModelManager } from '@accordproject/concerto-core';
import type { Clause, Handles, IEvent, IRequest, ITemplateData, ITemplateReference, Self } from './logic';
import { DocumentJson } from './execute';
type DataOf<S> = S extends Self<infer D, any, any> ? D : never;
type StateOf<S> = S extends Self<any, infer St, any> ? St : never;
type ClausesOf<S> = S extends Self<any, any, infer C> ? C : never;
export declare const TEST_AGREEMENT = "test-agreement";
export declare const TEST_DOCUMENT = "test-document";
/**
 * A placeholder org.accordproject.template@1.0.0 TemplateReference, for documents a test
 * makes up.
 * @param {string} templateId - the template's id
 * @returns {ITemplateReference} the reference
 */
export declare function testTemplate(templateId: string): ITemplateReference;
/**
 * A test document: an AgreementDocument of `data`, under a placeholder template.
 * @param {string} documentId - the document's id
 * @param {ITemplateData} data - its data
 * @param {string} [templateId] - its template's id
 * @returns {DocumentJson} the document
 */
export declare function testDocument(documentId: string, data: ITemplateData, templateId?: string): DocumentJson;
export type TestSelf<S> = S & {
    /** What the engine would commit if the handler returned now. */
    readonly committed: {
        state: StateOf<S> | undefined;
        events: IEvent[];
    };
};
/**
 * A `self` for unit-testing a template's logic: a document of its own (`test-document`,
 * in agreement `test-agreement`), alongside any other `documents` given, with `clauses`
 * standing in for its composed clauses (see `stubClause`). Pass `models` to validate
 * everything written.
 * @param {object} options - the instance's data, state, clauses, cousin documents and models
 * @returns {TestSelf} the instance
 */
export declare function testInstance<S extends Self<any, any, any>>(options: {
    data: DataOf<S>;
    state?: StateOf<S>;
    clauses?: Partial<ClausesOf<S>>;
    documents?: DocumentJson[];
    models?: ModelManager;
}): TestSelf<S>;
type Responses<A extends Handles> = {
    [C in A['$class']]?: Extract<A, {
        $class: C;
    }>['response'] | ((request: Extract<A, {
        $class: C;
    }>['request']) => Extract<A, {
        $class: C;
    }>['response']);
};
export type StubClause<A extends Handles> = Clause<A> & {
    readonly calls: IRequest[];
};
/**
 * A stand-in for a composed clause, answering each request type it is triggered with from
 * `responses` (keyed by request `$class`) and recording the requests. Typed by the
 * clause's API, so a stubbed response of the wrong type doesn't compile.
 * @param {Responses} responses - the response to each request type
 * @returns {StubClause} the stub
 */
export declare function stubClause<A extends Handles>(responses: Responses<A>): StubClause<A>;
export {};
