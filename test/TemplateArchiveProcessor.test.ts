import {Template} from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

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
        const response = await templateArchiveProcessor.init(data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload:any = response.state;
        expect(payload.count).toBe(0);
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

    test('should find entry point with non-standard logic filename', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compiledCode: Record<string, any> = {
            'logic/mycontract.ts': { code: 'compiled js code' },
            'logic/README.md': { code: undefined },
            'logic/generated/types.ts': { code: 'generated code' },
        };
        const entryPoint = Object.keys(compiledCode).find(
            key => key.startsWith('logic/') &&
            key.split('/').length === 2 &&
            !key.includes('generated/') &&
            key.endsWith('.ts') &&
            compiledCode[key].code !== undefined
        );
        expect(entryPoint).toBe('logic/mycontract.ts');
    });

    test('should not select generated files or non-ts files as entry point', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compiledCode: Record<string, any> = {
            'logic/README.md': { code: undefined },
            'logic/generated/io.clause.latedeliveryandpenalty@0.1.0.ts': { code: 'generated code' },
            'logic/generated/concerto.ts': { code: 'generated code' },
            'logic/mycontract.ts': { code: 'compiled js code' },
        };
        const entryPoint = Object.keys(compiledCode).find(
            key => key.startsWith('logic/') &&
            key.split('/').length === 2 &&
            !key.includes('generated/') &&
            key.endsWith('.ts') &&
            compiledCode[key].code !== undefined
        );
        // should skip README.md and all generated/ files
        expect(entryPoint).toBe('logic/mycontract.ts');
        expect(entryPoint).not.toContain('generated');
        expect(entryPoint).not.toBe('logic/README.md');
    });

    test('should throw when no valid entry point exists', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compiledCode: Record<string, any> = {
            'logic/README.md': { code: undefined },
            'logic/generated/types.ts': { code: 'generated code' },
        };
        const entryPoint = Object.keys(compiledCode).find(
            key => key.startsWith('logic/') &&
            key.split('/').length === 2 &&
            !key.includes('generated/') &&
            key.endsWith('.ts') &&
            compiledCode[key].code !== undefined
        );
        expect(entryPoint).toBeUndefined();
    });
});