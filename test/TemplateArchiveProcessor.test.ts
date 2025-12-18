import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

dayjs.extend(duration);

describe('template archive processor', () => {
    test('should draft a template', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
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
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
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
        const response = await templateArchiveProcessor.init(data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = response.state;
        expect(payload.count).toBe(0);
    });

    test('should trigger a template', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const data = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            "forceMajeure": false,
            "penaltyDuration": {
                "$class": "org.accordproject.time@0.3.0.Duration",
                "amount": 1,
                "unit": "days"
            },
            "penaltyPercentage": 10,
            "capPercentage": 25,
            "termination": {
                "$class": "org.accordproject.time@0.3.0.Duration",
                "amount": 15,
                "unit": "days"
            },
            "fractionalPart": "days",
            "clauseId": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
            "$identifier": "c88e5ed7-c3e0-4249-a99c-ce9278684ac8"
        };
        const threeDays = dayjs.duration(3, "days");
        const agreed = dayjs().subtract(threeDays);
        const request = {
            $timestamp: dayjs().toISOString(),
            goodsValue: 100,
            agreedDelivery: agreed.toISOString()
        };

        // first we init the template
        const stateResponse = await templateArchiveProcessor.init(data);

        // then we trigger the template
        const response = await templateArchiveProcessor.trigger(data, request, stateResponse.state);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = response;

        // we should have a result
        // three days late, 10% per day, but it is capped at 25% of goods value
        expect(payload.result.penalty).toBe(25);

        // the state should have been updated
        expect(payload.state.count).toBe(1);

        // the events should have been emitted
        expect(payload.events[0].penaltyCalculated).toBe(true);
    });

    test('should transpile a template', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const compilation = await templateArchiveProcessor.transpileLogicToJavaScript();
        expect(compilation.code).toBeDefined();
    });

    test('should transpile a template and save output', async () => {
        const template = await Template.fromDirectory('test/archives/latedeliveryandpenalty-typescript', { offline: true });
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const tmpobj = tmp.dirSync();
        await templateArchiveProcessor.transpileLogicToJavaScript(tmpobj.name);
        expect(fs.statSync(path.join(tmpobj.name, 'package.json')).isFile()).toBeTruthy();
        expect(fs.statSync(path.join(tmpobj.name, 'logic.js')).isFile()).toBeTruthy();
    });
});
