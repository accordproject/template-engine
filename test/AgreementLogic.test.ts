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


/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck - toy logic with free-form state

// The logic API's transaction semantics (src/agreement/execute.ts), with toy logic so
// each behaviour is isolated. Only the last tests load models.
import { Template } from '@accordproject/cicero-core';
import path from 'path';
import { conceptType, defineLogic } from '../src/agreement/logic';
import { execute, initialise } from '../src/agreement/execute';
import { stubClause, testInstance, testTemplate } from '../src/agreement/testing';

const LATE_PAYMENT = path.join(__dirname, 'archives', 'agreement', 'late-payment-poc');
const at = (seconds: number) => new Date(Date.UTC(2018, 0, 1, 0, 0, seconds)).toISOString();

// Toy requests, borrowing the late payment clause's request types.
const Ping = conceptType()('poc.accordproject.latepayment@0.1.0.PaymentOverdue');
const Pong = conceptType()('poc.accordproject.latepayment@0.1.0.PaymentSettled');
const ReminderSent = conceptType()('poc.accordproject.latepayment@0.1.0.ReminderSent');
const Request = conceptType()('org.accordproject.runtime@1.0.0.Request');
const response = (request, extra = {}) => ({
    $class: 'poc.accordproject.latepayment@0.1.0.LatePaymentDischarged', $timestamp: request.$timestamp, ...extra,
});

// A counter that fails on request once its count reaches `failAt`.
const counter = defineLogic()
    .init(self => self.setState({ count: 0 }))
    .on(Ping, async (request, self) => {
        self.setState({ count: self.state.count + 1 });
        self.emit({ from: self.id, count: self.state.count });
        if (self.data.failAt === self.state.count) {
            throw new Error(`${self.id} failed`);
        }
        if (self.clauses.inner) {
            await self.clauses.inner.trigger(Ping.create({ $timestamp: request.$timestamp }));
        }
        return response(request, { count: self.state.count });
    });

// A parent that writes, triggers its clause, and catches the clause's error.
const parent = defineLogic()
    .init(self => self.setState({ calls: 0 }))
    .on(Ping, async (request, self) => {
        self.setState({ calls: self.state.calls + 1 });
        let seen;
        try {
            await self.clauses.counter.trigger(Ping.create({ $timestamp: request.$timestamp }));
            seen = self.clauses.counter.state.count;
        } catch (e) {
            seen = e.message;
        }
        return response(request, { seen });
    })
    .on(Pong, async (request, self) => {
        await self.clauses.counter.trigger(Ping.create({ $timestamp: request.$timestamp }));
        throw new Error('parent failed');
    });

const LOGIC = { parent, counter };

const clause = (clauseId, templateId, data = {}, clauses?) => ({ clauseId, template: testTemplate(templateId), data, ...(clauses ? { clauses } : {}) });

function agreementOf(documents) {
    return {
        agreement: {
            agreementId: 'a',
            parties: [],
            documents: documents.map(d => `resource:org.accordproject.agreement@1.0.0.AgreementDocument#${d.documentId}`),
        },
        documents,
    };
}

async function setUp(counterData = {}, innerClauses?) {
    const { agreement, documents } = agreementOf([
        { documentId: 'doc', template: testTemplate('parent'), data: {}, clauses: { counter: clause('doc/counter', 'counter', counterData, innerClauses) } },
        { documentId: 'other', template: testTemplate('other'), data: { title: 'Other' } },
    ]);
    const { state } = await initialise(agreement, documents, at(0), LOGIC);
    return {
        agreement, documents, state,
        run: (request, s = state, logic = LOGIC, options = {}) => execute({ agreement, documents, state: s }, 'doc', request, logic, options),
    };
}

describe('defineLogic', () => {
    it('registers one handler per request type, and one init', () => {
        const logic = defineLogic().init(() => undefined).on(Ping, async r => r);

        expect(logic.requestTypes).toEqual([Ping.$class]);
        expect(logic.hasInit).toBe(true);
        expect(() => logic.on(Ping, async r => r)).toThrow(`A handler is already registered for ${Ping.$class}.`);
        expect(() => logic.init(() => undefined)).toThrow('init() is already registered.');
    });

    it('makes values with their $class, and relationships to identified types', () => {
        expect(Ping.create({ $timestamp: at(1) })).toEqual({ $class: Ping.$class, $timestamp: at(1) });
        expect(Ping.is(Ping.create({ $timestamp: at(1) }))).toBe(true);
        expect(Ping.is(Pong.create({ $timestamp: at(1) }))).toBe(false);
    });
});

describe('the agreement runtime', () => {
    it('commits a clause\'s writes with its parent\'s, and the parent reads them straight after the trigger', async () => {
        const { run, state } = await setUp();

        const outcome = await run(Ping.create({ $timestamp: at(1) }));

        expect(state).toMatchObject({
            $class: 'org.accordproject.runtime@1.0.0.AgreementState',
            agreement: 'resource:org.accordproject.agreement@1.0.0.Agreement#a',
            revision: 0,
        });
        expect(outcome.result.seen).toBe(1);
        expect(outcome.state.revision).toBe(1);
        expect(outcome.state.states).toEqual({ 'doc': { calls: 1 }, 'doc/counter': { count: 1 } });
        expect(outcome.events).toEqual([{ from: 'doc/counter', count: 1 }]);
    });

    it('discards only the clause\'s writes when a clause throws and its parent catches', async () => {
        const { run } = await setUp({ failAt: 1 });

        const outcome = await run(Ping.create({ $timestamp: at(1) }));

        expect(outcome.result.seen).toBe('doc/counter failed');
        expect(outcome.state.states).toEqual({ 'doc': { calls: 1 }, 'doc/counter': { count: 0 } });
        expect(outcome.events).toEqual([]);
    });

    it('commits nothing at all when the parent throws after its clause succeeded', async () => {
        const { run } = await setUp();

        await expect(run(Pong.create({ $timestamp: at(1) }))).rejects.toThrow('parent failed');
    });

    it('runs clauses composed into composed clauses, each in its own nested transaction', async () => {
        const { run } = await setUp({}, { inner: clause('doc/counter/inner', 'counter', { failAt: 2 }) });

        const first = await run(Ping.create({ $timestamp: at(1) }));
        expect(first.state.states).toMatchObject({ 'doc/counter': { count: 1 }, 'doc/counter/inner': { count: 1 } });

        // The innermost clause fails: the middle one rethrows, and the parent catches it.
        const second = await run(Ping.create({ $timestamp: at(2) }), first.state);
        expect(second.result.seen).toBe('doc/counter/inner failed');
        expect(second.state.states).toMatchObject({ 'doc': { calls: 2 }, 'doc/counter': { count: 1 }, 'doc/counter/inner': { count: 1 } });
    });

    it('gives logic frozen, read-only views of everything but its own writes', async () => {
        const reader = defineLogic().on(Ping, async (request, self) => {
            const other = self.document.agreement.documents.get('other').root;
            expect(other.data.title).toBe('Other');
            expect(() => { other.data.title = 'Changed'; }).toThrow(TypeError);
            expect(() => { self.state.calls = 99; }).toThrow(TypeError);
            // Another instance's clauses, and the instance itself, can't be triggered.
            expect(other).not.toHaveProperty('trigger');
            expect(self.clauses.counter.parent.clauses.get('counter')).not.toHaveProperty('trigger');
            expect(self.clauses.counter.parent.id).toBe('doc');
            return response(request);
        });
        const { run } = await setUp();

        await run(Ping.create({ $timestamp: at(1) }), undefined, { ...LOGIC, parent: reader });
    });

    it('resolves a reference to the instance it points into, anywhere in the agreement', async () => {
        const resolver = defineLogic().on(Ping, async (request, self) => {
            const { agreement } = self.document;
            expect(self.clauses.counter.reference('amount')).toEqual({
                $class: 'org.accordproject.agreement@1.0.0.AgreementReference',
                agreementId: 'a',
                documentId: 'doc',
                clausePath: 'counter/amount',
            });
            expect(agreement.resolve(self.clauses.counter.reference()).id).toBe('doc/counter');
            expect(agreement.resolve(self.clauses.counter.reference('some/inline/path')).id).toBe('doc/counter');
            expect(agreement.resolve({ agreementId: 'a', documentId: 'other' }).data.title).toBe('Other');
            expect(agreement.resolve({ agreementId: 'elsewhere', documentId: 'other' })).toBeUndefined();
            return response(request);
        });
        const { run } = await setUp();

        await run(Ping.create({ $timestamp: at(1) }), undefined, { ...LOGIC, parent: resolver });
    });

    it('refuses to trigger logic with an init() before it has been initialised', async () => {
        const { run, state } = await setUp();

        await expect(run(Ping.create({ $timestamp: at(1) }), { ...state, states: {} }))
            .rejects.toThrow("Instance 'doc' has not been initialised.");
    });

    it('refuses an agreement whose instance ids are not unique', async () => {
        const { agreement, documents } = agreementOf([
            { documentId: 'doc', template: testTemplate('parent'), data: {}, clauses: { counter: clause('doc', 'counter') } },
        ]);

        await expect(initialise(agreement, documents, at(0), LOGIC)).rejects.toThrow("Instance id 'doc' is not unique in agreement 'a'.");
    });

    describe('with models', () => {
        let models;
        beforeAll(async () => {
            models = (await Template.fromDirectory(LATE_PAYMENT, { offline: true })).getModelManager();
        });

        it('dispatches a request to the handler for its nearest supertype when it has none of its own', async () => {
            const seen = [];
            const catchAll = defineLogic().on(Request, async (request) => {
                seen.push(request.$class);
                return response(request);
            });
            const { run, state } = await setUp();

            // Only valid states pass validation, so run without the toy ones.
            await run(Ping.create({ $timestamp: at(1) }), { ...state, states: {} }, { parent: catchAll }, { models });

            expect(seen).toEqual([Ping.$class]);
        });

        it('rejects logic registered for something that is not a Request type, before anything runs', async () => {
            const wrong = defineLogic().on(ReminderSent, async r => r);
            const { run } = await setUp();

            await expect(run(Ping.create({ $timestamp: at(1) }), undefined, { ...LOGIC, parent: wrong }, { models }))
                .rejects.toThrow('handles poc.accordproject.latepayment@0.1.0.ReminderSent, which is not a org.accordproject.runtime@1.0.0.Request');
        });

        it('rejects state that is not a StateData', async () => {
            const writer = defineLogic().on(Ping, async (request, self) => {
                self.setState({ $class: 'poc.accordproject.latepayment@0.1.0.LatePaymentData', gracePeriodDays: 1 });
                return response(request);
            });
            const { run, state } = await setUp();

            await expect(run(Ping.create({ $timestamp: at(1) }), { ...state, states: {} }, { parent: writer }, { models }))
                .rejects.toThrow("Invalid state: 'poc.accordproject.latepayment@0.1.0.LatePaymentData' must be, or extend, org.accordproject.templatedata@1.0.0.StateData.");
        });
    });
});

describe('the testing helpers', () => {
    it('run a handler against a test instance, buffering what it would commit', async () => {
        const self = testInstance({ data: {}, state: { calls: 0 }, clauses: { counter: stubClause({ [Ping.$class]: { count: 7 } }) } });

        const result = await parent.handle(Ping.create({ $timestamp: at(1) }), self);

        // A stub clause answers triggers but has no state of its own to read.
        expect(result.seen).toBe("Cannot read properties of undefined (reading 'count')");
        expect(self.clauses.counter.calls).toEqual([Ping.create({ $timestamp: at(1) })]);
        expect(self.committed).toEqual({ state: { calls: 1 }, events: [] });
        expect(self.document.agreement.id).toBe('test-agreement');
    });

    it('stub a clause that has no response for a request', async () => {
        const stub = stubClause({});

        await expect(stub.trigger(Ping.create({ $timestamp: at(1) }))).rejects.toThrow(`The stub clause has no response for ${Ping.$class}.`);
    });
});
