import {Template} from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';
import { JavaScriptEvaluator } from '../src/JavaScriptEvaluator';

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
    const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
    return new TemplateArchiveProcessor(template);
}

describe('template archive processor', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should draft a template', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        const options = {};
        const result = await templateArchiveProcessor.draft(data, 'markdown', options);
        expect(result).toMatchSnapshot();
    });

    test('should init a template', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        const response = await templateArchiveProcessor.init(data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload:any = response.state;
        expect(payload.count).toBe(0);
    });

    test('should trigger a template', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();

        // first we init the template
        const stateResponse = await templateArchiveProcessor.init(data);

        // then we trigger the template
        const response = await templateArchiveProcessor.trigger(data, request, stateResponse.state);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload:any = response;

        // we should have a result
        expect(payload.result.penalty).toBe(2625);

        // the state should have been updated
        expect(payload.state.count).toBe(1);

        // the events should have been emitted
        expect(payload.events[0].penaltyCalculated).toBe(true);
    });

    test.each([
        [{ state: {}, events: [] }, 'Invalid trigger result: missing result object'],
        [{ result: {}, events: [] }, 'Invalid trigger result: missing state object'],
        [{ result: {}, state: {}, events: {} }, 'Invalid trigger result: events must be an array']
    ])('should validate malformed trigger result %j', async (triggerResult, errorMessage) => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        const stateResponse = await templateArchiveProcessor.init(data);
        jest.spyOn(JavaScriptEvaluator.prototype, 'evalDangerously').mockResolvedValueOnce({
            result: Promise.resolve(triggerResult)
        });

        await expect(templateArchiveProcessor.trigger(data, request, stateResponse.state)).rejects.toThrow(errorMessage);
    });

    test('should validate malformed init result', async () => {
        const templateArchiveProcessor = await createTemplateArchiveProcessor();
        jest.spyOn(JavaScriptEvaluator.prototype, 'evalDangerously').mockResolvedValueOnce({
            result: Promise.resolve({})
        });

        await expect(templateArchiveProcessor.init(data)).rejects.toThrow('Invalid init result: missing state object');
    });
});
