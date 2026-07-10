import {Template} from '@accordproject/cicero-core';
import { TemplateArchiveProcessor, InitResponse, TriggerResponse } from '../src/TemplateArchiveProcessor';

describe('template archive processor', () => {
    test('should draft a template', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
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
        const options = {};
        const result = await templateArchiveProcessor.draft(data, 'markdown', options);
        expect(result).toMatchSnapshot();
    });

    test('should init a template', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
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
        const response: InitResponse = await templateArchiveProcessor.init(data);
        const payload = response.state as { count?: number };
        expect(payload.count).toBe(0);
    });

    test('should compile logic', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const compiledCode = await templateArchiveProcessor.compileLogic();
        expect(compiledCode['logic/logic.ts']).toBeDefined();
        expect(compiledCode['logic/logic.ts'].code).toContain('LateDeliveryAndPenalty');
    });

    test('should trigger a template', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
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
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest",
            "forceMajeure": false,
            "agreedDelivery": "2017-10-07T16:38:01.412Z",
            "goodsValue": 100,
            "$timestamp": "2017-10-07T16:38:01.412Z"
        };

        // first we init the template
        const stateResponse = await templateArchiveProcessor.init(data);

        // then we trigger the template
        const response: TriggerResponse = await templateArchiveProcessor.trigger(data, request, stateResponse.state);

        // we should have a result
        const resultPayload = response.result as { penalty?: number };
        expect(resultPayload.penalty).toBe(2625);

        // the state should have been updated
        const statePayload = response.state as { count?: number };
        expect(statePayload.count).toBe(1);

        // the events should have been emitted
        const eventPayload = response.events[0] as { penaltyCalculated?: boolean };
        expect(eventPayload.penaltyCalculated).toBe(true);
    });

    it('should throw a validation error on invalid init data', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const invalidData = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            // missing mandatory fields like forceMajeure
        };
        await expect(templateArchiveProcessor.init(invalidData)).rejects.toThrow();
    });

    it('should throw a validation error on invalid trigger request', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const validData = {
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
        const invalidRequest = {
            "$class": "invalid.class.Name", // invalid class
            "goodsValue": "not a number" // type mismatch
        };

        const stateResponse = await templateArchiveProcessor.init(validData);

        await expect(templateArchiveProcessor.trigger(validData, invalidRequest, stateResponse.state)).rejects.toThrow();
    });
});
