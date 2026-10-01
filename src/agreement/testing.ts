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


// Test helpers for template logic written against ./logic.ts, shipped as
// '@accordproject/template-engine/testing'. They run on the same Session and Transaction
// as ./execute.ts, so buffering, read-your-writes and validation behave exactly as they
// do in the engine.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ModelManager } from '@accordproject/concerto-core';
import type { Clause, Handles, IEvent, IRequest, IResponse, IStateData, ITemplateData, ITemplateReference, Self } from './logic';
import {
    AGREEMENT_DOCUMENT_FQN, AGREEMENT_FQN, AgreementJson, DocumentJson, relationship, SelfView, Session, Transaction,
} from './execute';

type DataOf<S> = S extends Self<infer D, any, any> ? D : never;
type StateOf<S> = S extends Self<any, infer St, any> ? St : never;
type ClausesOf<S> = S extends Self<any, any, infer C> ? C : never;

export const TEST_AGREEMENT = 'test-agreement';
export const TEST_DOCUMENT = 'test-document';

/**
 * A placeholder org.accordproject.template@1.0.0 TemplateReference, for documents a test
 * makes up.
 * @param {string} templateId - the template's id
 * @returns {ITemplateReference} the reference
 */
export function testTemplate(templateId: string): ITemplateReference {
    return {
        $class: 'org.accordproject.template@1.0.0.TemplateReference',
        templateId,
        version: '0.0.0',
        archiveHash: {
            $class: 'org.accordproject.crypto@1.0.0.ContentHash',
            algorithm: { $class: 'org.accordproject.crypto@1.0.0.HashAlgorithm', type: 'SHA_256' },
            value: '0'.repeat(64),
            encoding: 'HEX',
        },
    } as ITemplateReference;
}

/**
 * A test document: an AgreementDocument of `data`, under a placeholder template.
 * @param {string} documentId - the document's id
 * @param {ITemplateData} data - its data
 * @param {string} [templateId] - its template's id
 * @returns {DocumentJson} the document
 */
export function testDocument(documentId: string, data: ITemplateData, templateId: string = documentId): DocumentJson {
    return { $class: AGREEMENT_DOCUMENT_FQN, documentId, template: testTemplate(templateId), data };
}

export type TestSelf<S> = S & {
    /** What the engine would commit if the handler returned now. */
    readonly committed: { state: StateOf<S> | undefined; events: IEvent[] };
};

/**
 * A `self` for unit-testing a template's logic: a document of its own (`test-document`,
 * in agreement `test-agreement`), alongside any other `documents` given, with `clauses`
 * standing in for its composed clauses (see `stubClause`). Pass `models` to validate
 * everything written.
 * @param {object} options - the instance's data, state, clauses, cousin documents and models
 * @returns {TestSelf} the instance
 */
export function testInstance<S extends Self<any, any, any>>(options: {
    data: DataOf<S>;
    state?: StateOf<S>;
    clauses?: Partial<ClausesOf<S>>;
    documents?: DocumentJson[];
    models?: ModelManager;
}): TestSelf<S> {
    const documents = [testDocument(TEST_DOCUMENT, options.data as ITemplateData, 'test'), ...(options.documents ?? [])];
    const agreement: AgreementJson = {
        $class: AGREEMENT_FQN,
        agreementId: TEST_AGREEMENT,
        documents: documents.map(d => relationship(AGREEMENT_DOCUMENT_FQN, d.documentId)),
        parties: [],
    };
    const session = new Session(agreement, documents, 0, {}, { models: options.models });
    const root = session.tree.documents.get(TEST_DOCUMENT)!.root;
    const tx = new Transaction({ read: id => (id === root.id ? options.state as IStateData | undefined : undefined) });
    const self = new SelfView(session, root, tx, (options.clauses ?? {}) as Record<string, unknown>);
    Object.defineProperty(self, 'committed', {
        get: () => ({ state: tx.read(root.id), events: tx.events }),
    });
    return self as unknown as TestSelf<S>;
}

type Responses<A extends Handles> = {
    [C in A['$class']]?: Extract<A, { $class: C }>['response']
        | ((request: Extract<A, { $class: C }>['request']) => Extract<A, { $class: C }>['response']);
};

export type StubClause<A extends Handles> = Clause<A> & { readonly calls: IRequest[] };

/**
 * A stand-in for a composed clause, answering each request type it is triggered with from
 * `responses` (keyed by request `$class`) and recording the requests. Typed by the
 * clause's API, so a stubbed response of the wrong type doesn't compile.
 * @param {Responses} responses - the response to each request type
 * @returns {StubClause} the stub
 */
export function stubClause<A extends Handles>(responses: Responses<A>): StubClause<A> {
    const calls: IRequest[] = [];
    const unavailable = () => { throw new Error('Not available on a stub clause.'); };
    return {
        calls,
        trigger: async (request: IRequest): Promise<IResponse> => {
            calls.push(request);
            const response = (responses as Record<string, unknown>)[request.$class];
            if (response === undefined) {
                throw new Error(`The stub clause has no response for ${request.$class}.`);
            }
            return (typeof response === 'function' ? response(request) : structuredClone(response)) as IResponse;
        },
        id: 'stub-clause',
        path: 'stub',
        template: testTemplate('stub'),
        data: {} as ITemplateData,
        state: undefined,
        parent: undefined,
        clauses: new Map(),
        get document() { return unavailable(); },
        reference: unavailable,
    } as unknown as StubClause<A>;
}
