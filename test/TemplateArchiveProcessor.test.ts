import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor, InitResponse, TriggerResponse } from '../src/TemplateArchiveProcessor';
import { mockExternalModelFetches } from './support/externalModels';

const data = {
    "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
    "forceMajeure": true,
    "penaltyDuration": {
        "$class": "org.accordproject.time@0.3.0.Duration",
        "amount": 2,
        "unit": "days"
    },
    "penaltyPercentage": 10.5,
    "capPercentage": 55,
    "termination": {
        "$class": "org.accordproject.time@0.3.0.Duration",
        "amount": 15,
        "unit": "days"
    },
    "fractionalPart": "days",
    "clauseId": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
    "$identifier": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8"
};

const request = {
    goodsValue: 100
};

async function createTemplateArchiveProcessor() {
    const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
    return new TemplateArchiveProcessor(template);
}

describe('template archive processor', () => {
    beforeEach(() => {
        mockExternalModelFetches();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should draft a template', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        const result = await templateArchiveProcessor.draft(data, 'markdown', {});
        expect(result).toMatchSnapshot();
    });

    test('should init a template', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        const response: InitResponse = await templateArchiveProcessor.init(data);
        const payload = response.state as { count?: number };
        expect(payload.count).toBe(0);
    });

    test('should compile logic', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        const compiledCode = await templateArchiveProcessor.compileLogic();
        expect(compiledCode['logic/logic.ts']).toBeDefined();
        expect(compiledCode['logic/logic.ts'].code).toContain('LateDeliveryAndPenalty');
    });

    test('should trigger a template', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();

        const stateResponse = await templateArchiveProcessor.init(data);
        const response: TriggerResponse = await templateArchiveProcessor.trigger(data, request, stateResponse.state);

        const resultPayload = response.result as { penalty?: number };
        expect(resultPayload.penalty).toBe(2625);

        const statePayload = response.state as { count?: number };
        expect(statePayload.count).toBe(1);

        const eventPayload = response.events[0] as { penaltyCalculated?: boolean };
        expect(eventPayload.penaltyCalculated).toBe(true);
    });
});
