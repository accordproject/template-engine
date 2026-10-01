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

// An agreement of three templates (test/archives/agreement), compiled and run by the
// engine: a copyright licence with an inline payment clause and a composed late payment
// clause, and a stateless schedule alongside it.
import { Template } from '@accordproject/cicero-core';
import { readFileSync } from 'fs';
import path from 'path';
import { AgreementProcessor } from '../src/AgreementProcessor';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';
import { testTemplate } from '../src/agreement/testing';
import { logicTypes } from '../src/agreement/codegen';
import { rewriteImports } from '../src/agreement/loader';
import ts from 'typescript';

const ARCHIVES = path.join(__dirname, 'archives', 'agreement');
const LICENCE = 'copyright-license-agreement-poc';
const LATE_PAYMENT = 'late-payment-poc';
const SCHEDULE = 'licensed-work-schedule-poc';
const EFFECTIVE_AT = '2018-01-01T00:00:00.000Z';

const load = (name: string) => Template.fromDirectory(path.join(ARCHIVES, name), { offline: true });
const sample = (name: string) => JSON.parse(readFileSync(path.join(ARCHIVES, name, 'sample.json'), 'utf8'));
const at = (seconds: number) => new Date(Date.UTC(2018, 0, 1, 0, 0, seconds)).toISOString();
const amount = (unscaledValue: string) => ({
    $class: 'org.accordproject.money@1.0.0.PreciseAmount',
    unscaledValue,
    unit: { $class: 'org.accordproject.money@1.0.0.Unit', code: 'USD', scheme: 'iso4217', scale: 2 },
});
const paymentRequest = (seconds: number) => ({ $class: 'poc.accordproject.copyrightlicense@0.1.0.PaymentRequest', $timestamp: at(seconds) });
const paymentReceived = (unscaledValue: string, seconds: number) => ({
    $class: 'poc.accordproject.copyrightlicense@0.1.0.PaymentReceived', $timestamp: at(seconds), amount: amount(unscaledValue),
});

function licenceAgreement({ withLatePaymentClause = true } = {}) {
    const latePayment = {
        $class: 'org.accordproject.agreement@1.0.0.Clause',
        clauseId: 'licence/late-payment',
        template: testTemplate(LATE_PAYMENT),
        data: sample(LATE_PAYMENT),
    };
    const documents: any[] = [
        {
            $class: 'org.accordproject.agreement@1.0.0.AgreementDocument',
            documentId: 'licence',
            template: testTemplate(LICENCE),
            data: sample(LICENCE),
            ...(withLatePaymentClause ? { clauses: { latePayment } } : {}),
        },
        {
            $class: 'org.accordproject.agreement@1.0.0.AgreementDocument',
            documentId: 'schedule-1',
            template: testTemplate(SCHEDULE),
            data: sample(SCHEDULE),
        },
    ];
    const party = (id: string, role: string) => ({
        $class: 'org.accordproject.agreement@1.0.0.AgreementParty',
        party: `resource:org.accordproject.party@1.0.0.Party#${id}`,
        role,
    });
    const agreement = {
        $class: 'org.accordproject.agreement@1.0.0.Agreement',
        agreementId: 'licence-001',
        documents: documents.map(d => `resource:org.accordproject.agreement@1.0.0.AgreementDocument#${d.documentId}`),
        parties: [party('me', 'licensee'), party('myself', 'licensor')],
    };
    return { agreement, documents };
}

describe('AgreementProcessor', () => {
    let processor: AgreementProcessor;
    let agreement: any;
    let documents: any[];

    beforeAll(async () => {
        processor = new AgreementProcessor(await Promise.all([LICENCE, LATE_PAYMENT, SCHEDULE].map(load)));
    }, 60_000);

    beforeEach(() => {
        ({ agreement, documents } = licenceAgreement());
    });

    const start = () => processor.initialise(agreement, documents, EFFECTIVE_AT);
    const trigger = (state: any, documentId: string, request: any) => processor.execute({ agreement, documents, state }, documentId, request);

    it('holds an agreement of documents and a composed clause, as valid instances of the models', () => {
        expect(() => processor.validate(agreement)).not.toThrow();
        documents.forEach(d => expect(() => processor.validate(d)).not.toThrow());
    });

    it('initialises one state entry per stateful instance, and none for the stateless schedule', async () => {
        const { state, events } = await start();

        expect(Object.keys(state.states!)).toEqual(['licence', 'licence/late-payment']);
        expect(state.states!['licence/late-payment']).toMatchObject({ remindersSent: 0, discharged: false });
        expect(state.revision).toBe(0);
        expect(events.map(e => e.$class)).toEqual(['org.accordproject.obligation@1.0.0.ObligationIssued']);
        expect(() => processor.validate(state)).not.toThrow();
    }, 60_000);

    it('lets the licence read its cousin, the schedule, when it issues the obligation', async () => {
        const { events } = await start();

        const { obligation } = events[0] as any;
        expect(obligation.description).toBe('Me should pay the licence fee for "Other Stuff" to Myself');
        expect(obligation.agreement).toEqual({
            $class: 'org.accordproject.agreement@1.0.0.AgreementReference',
            agreementId: 'licence-001',
            documentId: 'licence',
            clausePath: 'paymentTerms',
        });
    });

    it('delegates a chase to the composed clause, committing only the clause\'s new state', async () => {
        const { state: initial } = await start();
        const { state: requested } = await trigger(initial, 'licence', paymentRequest(1));

        const chased = await trigger(requested, 'licence', paymentRequest(2));

        expect(chased.state.revision).toBe(2);
        expect(chased.state.states!['licence']).toEqual(requested.states!['licence']);
        expect(chased.state.states!['licence/late-payment']).toMatchObject({ remindersSent: 1 });
        expect(chased.events).toEqual([expect.objectContaining({
            $class: 'poc.accordproject.latepayment@0.1.0.PaymentReminder', reminderNumber: 1, gracePeriodDays: 14,
        })]);
    });

    it('commits the licence and its composed clause together when payment in full discharges the clause', async () => {
        const { state: initial } = await start();
        const { state: requested } = await trigger(initial, 'licence', paymentRequest(1));

        const paid = await trigger(requested, 'licence', paymentReceived('10000', 2));

        expect(paid.state.states!['licence']).toMatchObject({ paymentTerms: { amountPaid: { unscaledValue: '10000' } } });
        expect(paid.state.states!['licence/late-payment']).toMatchObject({ discharged: true });
        expect(paid.events).toEqual([expect.objectContaining({ fromStatus: 'DUE', toStatus: 'FULFILLED' })]);
        expect(() => processor.validate(paid.state)).not.toThrow();
    });

    it('commits nothing when the licence logic rejects a request', async () => {
        const { state: initial } = await start();
        const before = structuredClone(initial);

        await expect(trigger(initial, 'licence', paymentReceived('10001', 1))).rejects.toThrow('would exceed the licence fee');
        expect(initial).toEqual(before);
    });

    it('has nothing to trigger in the stateless schedule', async () => {
        const { state } = await start();

        await expect(trigger(state, 'schedule-1', paymentRequest(1))).rejects.toThrow("Instance 'schedule-1' has no logic to trigger.");
    });

    it('runs the same licence logic unchanged when no late payment clause is composed into it', async () => {
        ({ agreement, documents } = licenceAgreement({ withLatePaymentClause: false }));
        const { state: initial } = await start();
        const { state: requested } = await trigger(initial, 'licence', paymentRequest(1));

        const chased = await trigger(requested, 'licence', paymentRequest(2));

        expect(Object.keys(initial.states!)).toEqual(['licence']);
        expect(chased.events).toEqual([]);
    });

    it('is deterministic: replaying the same requests reproduces every outcome exactly', async () => {
        const replay = async () => {
            const outcomes: any[] = [await start()];
            for (const request of [paymentRequest(1), paymentRequest(2), paymentReceived('4000', 3), paymentReceived('6000', 4)]) {
                outcomes.push(await trigger(outcomes.at(-1).state, 'licence', request));
            }
            return outcomes;
        };

        expect(await replay()).toEqual(await replay());
    });

    it('refuses templates that define a shared namespace differently', async () => {
        const [licence, schedule] = await Promise.all([load(LICENCE), load(SCHEDULE)]);
        const modelFile = schedule.getModelManager().getModelFile('poc.accordproject.licensedwork@0.1.0');
        (modelFile as any).definitions = `${modelFile.getDefinitions()}\n// changed\n`;

        expect(() => new AgreementProcessor([licence, schedule]))
            .toThrow(`Templates '${LICENCE}' and '${SCHEDULE}' define poc.accordproject.licensedwork@0.1.0 differently.`);
    });
});

describe('TemplateArchiveProcessor, for logic written with the logic API', () => {
    it('drafts a template whose models hold several TemplateData types, by its named template model', async () => {
        const processor = new TemplateArchiveProcessor(await load(LICENCE));

        const text = await processor.draft(sample(LICENCE), 'markdown', {}, EFFECTIVE_AT);

        expect(text).toContain('This COPYRIGHT LICENSE AGREEMENT');
        expect(text).toContain('Me ("Licensee")');
    }, 60_000);

    it('initialises and triggers one instance, as the one document of an agreement', async () => {
        const processor = new TemplateArchiveProcessor(await load(LATE_PAYMENT));
        const data = sample(LATE_PAYMENT);

        const { state, events } = await processor.init(data, EFFECTIVE_AT);
        const response = await processor.trigger(data, { $class: 'poc.accordproject.latepayment@0.1.0.PaymentOverdue', $timestamp: at(1) }, state);

        expect(state).toEqual({ $class: 'poc.accordproject.latepayment@0.1.0.LatePaymentState', remindersSent: 0, discharged: false });
        expect(events).toEqual([]);
        expect(response.result).toEqual({ $class: 'poc.accordproject.latepayment@0.1.0.ReminderSent', $timestamp: at(1), remindersSent: 1 });
        expect(response.state).toMatchObject({ remindersSent: 1 });
        expect(response.events).toHaveLength(1);
    }, 60_000);

    it('requires the state init() returned to trigger stateful logic', async () => {
        const processor = new TemplateArchiveProcessor(await load(LATE_PAYMENT));

        await expect(processor.trigger(sample(LATE_PAYMENT), { $class: 'poc.accordproject.latepayment@0.1.0.PaymentOverdue', $timestamp: at(1) }))
            .rejects.toThrow('Stateful templates require priorState');
    }, 60_000);

    it('rejects a request that is not one of the models\' Request types', async () => {
        const processor = new TemplateArchiveProcessor(await load(LATE_PAYMENT));
        const data = sample(LATE_PAYMENT);
        const { state } = await processor.init(data, EFFECTIVE_AT);

        await expect(processor.trigger(data, { $class: 'poc.accordproject.latepayment@0.1.0.ReminderSent', $timestamp: at(1), remindersSent: 1 }, state))
            .rejects.toThrow("Invalid request: 'poc.accordproject.latepayment@0.1.0.ReminderSent' must be, or extend, org.accordproject.runtime@1.0.0.Request.");
    }, 60_000);

    it('generates the factories logic imports, alongside Concerto\'s interfaces', async () => {
        const files = logicTypes(await load(LATE_PAYMENT), true);

        expect(Object.keys(files)).toEqual(expect.arrayContaining(['types.ts', 'poc.accordproject.latepayment@0.1.0.ts']));
        expect(files['types.ts']).toContain("import { conceptType, identifiedType } from '@accordproject/template-engine/logic';");
        expect(files['types.ts']).toContain("export const PaymentOverdue = conceptType<IPaymentOverdue>()('poc.accordproject.latepayment@0.1.0.PaymentOverdue');");
        expect(files['types.ts']).toContain("export const Agreement = identifiedType<IAgreement>()('org.accordproject.agreement@1.0.0.Agreement', 'agreementId');");
    }, 60_000);

    it('lets logic import values only from the modules the engine supplies', () => {
        const supplied = new Set(['./generated/types']);
        const code = "import { A, B as C } from './generated/types';\nexport default A;\n";

        expect(rewriteImports(ts, code, 'k', supplied)).toContain('const C = __import("./generated/types", "B");');
        expect(() => rewriteImports(ts, "import fs from 'fs';\n", 'k', supplied))
            .toThrow("Template logic may import only types from 'fs'.");
    });
});
