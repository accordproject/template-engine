import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';
import type { LLMExecutor } from '../src/llm/LLMExecutor';

const LDP_DIR = 'test/archives/latedeliveryandpenalty-typescript';
const STATELESS_DIR = 'test/archives/inherited-init';
const OBLIGATION_DIR = 'test/archives/llm-obligation-event';
const NS = 'io.clause.latedeliveryandpenalty@0.1.0';
const STATELESS_NS = 'org.example@0.0.1';

const LDP_DATA = {
    $class: `${NS}.TemplateModel`,
    forceMajeure: true,
    penaltyDuration: { $class: 'org.accordproject.time@0.3.0.Duration', amount: 2, unit: 'days' },
    penaltyPercentage: 10.5,
    capPercentage: 55,
    termination: { $class: 'org.accordproject.time@0.3.0.Duration', amount: 15, unit: 'days' },
    fractionalPart: 'days',
    clauseId: 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8',
    $identifier: 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8',
};

const LDP_REQUEST = {
    $class: `${NS}.LateDeliveryAndPenaltyRequest`,
    forceMajeure: false,
    agreedDelivery: 'December 17, 2017 03:24:00',
    deliveredAt: null,
    goodsValue: 200.00,
};

const LDP_INIT_STATE = { $class: `${NS}.LateDeliveryAndPenaltyState`, count: 0 };
const LDP_RESULT = { $class: `${NS}.LateDeliveryAndPenaltyResponse`, penalty: 5250, buyerMayTerminate: true };
const LDP_STATE = { $class: `${NS}.LateDeliveryAndPenaltyState`, count: 1 };

/**
 * Creates a processor whose LLM lane is driven by a canned (stubbed) reasoner,
 * so no network or API key is involved. The internal LLM executor is memoized
 * on a private field; the seam injects the fake into that instance, so every
 * init()/trigger() on the processor consumes the next canned answer.
 */
async function makeProcessor(templateDir: string, cannedAnswers: unknown[]): Promise<TemplateArchiveProcessor> {
    const template = await Template.fromDirectory(templateDir, { offline: true });
    const processor = new TemplateArchiveProcessor(template, {
        mode: 'force',
        provider: { provider: 'openai', apiKey: 'sk-test', model: 'test-model' },
    });
    const executor = (processor as unknown as { makeLLMExecutor(): LLMExecutor }).makeLLMExecutor();
    let call = 0;
    (executor as unknown as { reasoner?: unknown }).reasoner = {
        complete: async () => ({
            content: JSON.stringify(cannedAnswers[Math.min(call++, cannedAnswers.length - 1)]),
        }),
    };
    return processor;
}

describe('TemplateArchiveProcessor LLM lane', () => {
    test('runs a conforming LLM response through output validation', async () => {
        const processor = await makeProcessor(LDP_DIR, [
            { state: LDP_INIT_STATE },
            { result: LDP_RESULT, state: LDP_STATE, events: [] },
        ]);
        const init = await processor.init(LDP_DATA);
        await expect(processor.trigger(LDP_DATA, LDP_REQUEST, init.state)).resolves.toBeDefined();
    });

    test('rejects an LLM result with a primitive of the wrong type', async () => {
        const processor = await makeProcessor(LDP_DIR, [
            { state: LDP_INIT_STATE },
            {
                result: { $class: `${NS}.LateDeliveryAndPenaltyResponse`, penalty: '5250.00', buyerMayTerminate: true },
                state: LDP_STATE,
                events: [],
            },
        ]);
        const init = await processor.init(LDP_DATA);
        await expect(processor.trigger(LDP_DATA, LDP_REQUEST, init.state))
            .rejects.toThrow(/Expected value at path `\$\.penalty` to be of type `Double`/);
    });

    test('rejects an LLM result with an undeclared (invented) field', async () => {
        const processor = await makeProcessor(LDP_DIR, [
            { state: LDP_INIT_STATE },
            {
                result: { $class: `${NS}.LateDeliveryAndPenaltyResponse`, penalty: 5250, buyerMayTerminate: true, inventedNote: 'made up' },
                state: LDP_STATE,
                events: [],
            },
        ]);
        const init = await processor.init(LDP_DATA);
        await expect(processor.trigger(LDP_DATA, LDP_REQUEST, init.state))
            .rejects.toThrow(/Unexpected properties.*inventedNote/);
    });

    test('rejects an LLM state violating its model on the init path', async () => {
        const processor = await makeProcessor(LDP_DIR, [
            { state: { $class: `${NS}.LateDeliveryAndPenaltyState`, count: 'not-a-number' } },
        ]);
        await expect(processor.init(LDP_DATA))
            .rejects.toThrow(/Expected value at path `\$\.count` to be of type `Integer`/);
    });

    test('rejects an LLM state whose $class the model does not declare', async () => {
        const processor = await makeProcessor(LDP_DIR, [
            { state: LDP_INIT_STATE },
            {
                result: LDP_RESULT,
                state: { $class: 'ns.entirelyOther@1.0.0.NotAState', count: 1 },
                events: [],
            },
        ]);
        const init = await processor.init(LDP_DATA);
        await expect(processor.trigger(LDP_DATA, LDP_REQUEST, init.state))
            .rejects.toThrow(/Namespace is not defined/i);
    });

    test('keeps the empty state placeholder on a stateless template', async () => {
        const processor = await makeProcessor(STATELESS_DIR, [
            { state: {} },
            { result: { $class: `${STATELESS_NS}.GreetingResponse`, message: 'hello Fred' }, state: {}, events: [] },
        ]);
        const data = { $class: `${STATELESS_NS}.TemplateModel`, clauseId: 'clause-1', name: 'Fred' };
        const request = { $class: `${STATELESS_NS}.GreetingRequest`, greeting: 'hello' };
        const init = await processor.init(data);
        await expect(processor.trigger(data, request, init.state)).resolves.toBeDefined();
    });

    test('rejects a non-empty state on a stateless template that is not a State', async () => {
        const processor = await makeProcessor(STATELESS_DIR, [
            { state: {} },
            {
                result: { $class: `${STATELESS_NS}.GreetingResponse`, message: 'hello' },
                state: { $class: `${STATELESS_NS}.GreetingResponse`, message: 'not a state' },
                events: [],
            },
        ]);
        const data = { $class: `${STATELESS_NS}.TemplateModel`, clauseId: 'clause-1', name: 'Fred' };
        const request = { $class: `${STATELESS_NS}.GreetingRequest`, greeting: 'hello' };
        await processor.init(data);
        await expect(processor.trigger(data, request, {}))
            .rejects.toThrow(/must be, or extend, the runtime state type/i);
    });

    test('populates the missing contract back-reference on an LLM-emitted Obligation event', async () => {
        const processor = await makeProcessor(OBLIGATION_DIR, [
            { state: {} },
            {
                result: { $class: `${STATELESS_NS}.GreetingResponse`, message: 'obligation created' },
                state: {},
                events: [{ $class: `${STATELESS_NS}.FulfillmentObligationEvent` }],
            },
        ]);
        const data = { $class: `${STATELESS_NS}.TemplateModel`, contractId: 'contract-1', name: 'Fred' };
        const request = { $class: `${STATELESS_NS}.GreetingRequest`, greeting: 'hello' };
        await processor.init(data);
        const response = await processor.trigger(data, request, {});
        expect(response.events).toHaveLength(1);
        expect((response.events![0] as { contract?: string }).contract).toBe('contract-1');
    });
});
