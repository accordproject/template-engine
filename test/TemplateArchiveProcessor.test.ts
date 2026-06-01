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
        await templateArchiveProcessor.compileLogic();
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

    test('should throw error if init is called without compileLogic', async () => {
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
        await expect(templateArchiveProcessor.init(data)).rejects.toThrow(/must call compileLogic\(\)/);
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
            goodsValue: 100
        };

        // first we compile the logic
        await templateArchiveProcessor.compileLogic();

        // then we init the template
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
});
