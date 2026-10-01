"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_DOCUMENT = exports.TEST_AGREEMENT = void 0;
exports.testTemplate = testTemplate;
exports.testDocument = testDocument;
exports.testInstance = testInstance;
exports.stubClause = stubClause;
const execute_1 = require("./execute");
exports.TEST_AGREEMENT = 'test-agreement';
exports.TEST_DOCUMENT = 'test-document';
/**
 * A placeholder org.accordproject.template@1.0.0 TemplateReference, for documents a test
 * makes up.
 * @param {string} templateId - the template's id
 * @returns {ITemplateReference} the reference
 */
function testTemplate(templateId) {
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
    };
}
/**
 * A test document: an AgreementDocument of `data`, under a placeholder template.
 * @param {string} documentId - the document's id
 * @param {ITemplateData} data - its data
 * @param {string} [templateId] - its template's id
 * @returns {DocumentJson} the document
 */
function testDocument(documentId, data, templateId = documentId) {
    return { $class: execute_1.AGREEMENT_DOCUMENT_FQN, documentId, template: testTemplate(templateId), data };
}
/**
 * A `self` for unit-testing a template's logic: a document of its own (`test-document`,
 * in agreement `test-agreement`), alongside any other `documents` given, with `clauses`
 * standing in for its composed clauses (see `stubClause`). Pass `models` to validate
 * everything written.
 * @param {object} options - the instance's data, state, clauses, cousin documents and models
 * @returns {TestSelf} the instance
 */
function testInstance(options) {
    const documents = [testDocument(exports.TEST_DOCUMENT, options.data, 'test'), ...(options.documents ?? [])];
    const agreement = {
        $class: execute_1.AGREEMENT_FQN,
        agreementId: exports.TEST_AGREEMENT,
        documents: documents.map(d => (0, execute_1.relationship)(execute_1.AGREEMENT_DOCUMENT_FQN, d.documentId)),
        parties: [],
    };
    const session = new execute_1.Session(agreement, documents, 0, {}, { models: options.models });
    const root = session.tree.documents.get(exports.TEST_DOCUMENT).root;
    const tx = new execute_1.Transaction({ read: id => (id === root.id ? options.state : undefined) });
    const self = new execute_1.SelfView(session, root, tx, (options.clauses ?? {}));
    Object.defineProperty(self, 'committed', {
        get: () => ({ state: tx.read(root.id), events: tx.events }),
    });
    return self;
}
/**
 * A stand-in for a composed clause, answering each request type it is triggered with from
 * `responses` (keyed by request `$class`) and recording the requests. Typed by the
 * clause's API, so a stubbed response of the wrong type doesn't compile.
 * @param {Responses} responses - the response to each request type
 * @returns {StubClause} the stub
 */
function stubClause(responses) {
    const calls = [];
    const unavailable = () => { throw new Error('Not available on a stub clause.'); };
    return {
        calls,
        trigger: async (request) => {
            calls.push(request);
            const response = responses[request.$class];
            if (response === undefined) {
                throw new Error(`The stub clause has no response for ${request.$class}.`);
            }
            return (typeof response === 'function' ? response(request) : structuredClone(response));
        },
        id: 'stub-clause',
        path: 'stub',
        template: testTemplate('stub'),
        data: {},
        state: undefined,
        parent: undefined,
        clauses: new Map(),
        get document() { return unavailable(); },
        reference: unavailable,
    };
}
//# sourceMappingURL=testing.js.map