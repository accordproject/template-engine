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
        await expect(templateArchiveProcessor.init(invalidData)).rejects.toThrow(/Invalid or missing identifier for Type/i);
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

        await expect(templateArchiveProcessor.trigger(validData, invalidRequest, stateResponse.state)).rejects.toThrow(/Namespace is not defined/i);
    });

    const RUNTIME_REQUEST_FQN = 'org.accordproject.runtime@0.2.0.Request';

    it('compileLogic accepts trigger logic when the model declares a valid request type', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        // The archive declares `transaction LateDeliveryAndPenaltyRequest extends Request`.
        // The base Request is concrete, so the base-inclusive query always lists it - which
        // is exactly why the check must use the base-excluding query instead.
        expect(template.getRequestTypes()).toContain(RUNTIME_REQUEST_FQN);
        expect(template.findConcreteSubclassNames(RUNTIME_REQUEST_FQN, true).length).toBeGreaterThan(0);
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        await expect(templateArchiveProcessor.compileLogic()).resolves.toBeDefined();
    });

    it('compileLogic rejects trigger logic when no request type extends the runtime Request', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', {offline: true});
        // Simulate a template whose "request" is a plain concept rather than a transaction
        // extending Request: the base-excluding subclass query then returns an empty list
        // (an achievable value - unlike the base-inclusive getRequestTypes, which always
        // lists the concrete base). This cannot be caught at compile time because the
        // request only appears in the bivariant `trigger` parameter position.
        jest.spyOn(template, 'findConcreteSubclassNames').mockReturnValue([]);
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        await expect(templateArchiveProcessor.compileLogic())
            .rejects.toThrow(/requires a request that extends the runtime Request type/i);
    });
});
