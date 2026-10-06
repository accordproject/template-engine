import { cpSync, mkdtempSync, renameSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import {Template} from '@accordproject/cicero-core';
import { TemplateArchiveProcessor, InitResponse, TriggerResponse, resolveLogicEntryPoint } from '../src/TemplateArchiveProcessor';

const TEMPLATE_DIR = 'test/archives/latedeliveryandpenalty-typescript';

async function loadTemplate(logicSource?: string): Promise<Template> {
    if (!logicSource) {
        return Template.fromDirectory(TEMPLATE_DIR, {offline: true});
    }

    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'template-engine-logic-'));
    const tempDir = path.join(tempRoot, 'template');
    cpSync(TEMPLATE_DIR, tempDir, { recursive: true });
    writeFileSync(path.join(tempDir, 'logic', 'logic.ts'), logicSource);
    return Template.fromDirectory(tempDir, {offline: true});
}

async function loadTemplateWithLogicFile(logicFileName: string): Promise<Template> {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'template-engine-logic-'));
    const tempDir = path.join(tempRoot, 'template');
    cpSync(TEMPLATE_DIR, tempDir, { recursive: true });
    renameSync(path.join(tempDir, 'logic', 'logic.ts'), path.join(tempDir, 'logic', logicFileName));
    return Template.fromDirectory(tempDir, {offline: true});
}

describe('template archive processor', () => {
    test('should draft a template', async () => {
        const template = await loadTemplate();
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
        const template = await loadTemplate();
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
        const template = await loadTemplate();
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const compiledCode = await templateArchiveProcessor.compileLogic();
        expect(compiledCode['logic/logic.ts']).toBeDefined();
        expect(compiledCode['logic/logic.ts'].code).toContain('LateDeliveryAndPenalty');
    });

    test('should not revalidate cached logic', async () => {
        const template = await loadTemplate();
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const validationSpy = jest.spyOn(
            templateArchiveProcessor as unknown as { assertTemplateLogicSubclass: () => Promise<void> },
            'assertTemplateLogicSubclass'
        );

        await templateArchiveProcessor.compileLogic(true);
        await templateArchiveProcessor.compileLogic(true);

        expect(validationSpy).toHaveBeenCalledTimes(1);
    });

    test('should reject plain default-exported classes', async () => {
        const template = await loadTemplate(`
export default class PlainLogic {
    async init() {
        return { state: {} };
    }
}
`);
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        await expect(templateArchiveProcessor.compileLogic()).rejects.toThrow(/class extending TemplateLogic/i);
    });

    test('should trigger a template', async () => {
        const template = await loadTemplate();
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
        const template = await loadTemplate();
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const invalidData = {
            "$class": "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
            // missing mandatory fields like forceMajeure
        };
        await expect(templateArchiveProcessor.init(invalidData)).rejects.toThrow(/Invalid or missing identifier for Type/i);
    });

    it('should throw a validation error on invalid trigger request', async () => {
        const template = await loadTemplate();
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

    const VALID_DATA = {
        '$class': 'io.clause.latedeliveryandpenalty@0.1.0.TemplateModel',
        'forceMajeure': true,
        'penaltyDuration': { '$class': 'org.accordproject.time@0.3.0.Duration', 'amount': 2, 'unit': 'days' },
        'penaltyPercentage': 10.5,
        'capPercentage': 55,
        'termination': { '$class': 'org.accordproject.time@0.3.0.Duration', 'amount': 15, 'unit': 'days' },
        'fractionalPart': 'days',
        'clauseId': 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8',
        '$identifier': 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8'
    };

    test.each(['\u00e9', '\u4f60', '\ud83d\ude80'])('preserves Unicode in template logic: %s', async (text) => {
        const template = await loadTemplate(`
// @ts-expect-error TemplateLogic is imported by the runtime
class UnicodeLogic extends TemplateLogic {
    async init(data: { $identifier: string }) {
        return {
            state: {
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
                $identifier: data.$identifier,
                count: ${JSON.stringify(text)}.codePointAt(0)
            }
        };
    }
}
export default UnicodeLogic;
`);
        const processor = new TemplateArchiveProcessor(template);
        const response = await processor.init(VALID_DATA);
        expect((response.state as { count: number }).count).toBe(text.codePointAt(0));
    });

    it('rejects a request whose type does not extend the runtime Request', async () => {
        const template = await loadTemplate();
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const stateResponse = await templateArchiveProcessor.init(VALID_DATA);
        // A well-formed Response object is a valid Concerto instance (so it passes
        // serialization) but is not a Request - the runtime hierarchy check must reject it.
        // This is the case the type system cannot catch (bivariant `trigger` parameter).
        const responseAsRequest = {
            '$class': 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse',
            'penalty': 0,
            'buyerMayTerminate': false,
            '$timestamp': '2019-01-31T16:34:00-05:00'
        };
        await expect(templateArchiveProcessor.trigger(VALID_DATA, responseAsRequest, stateResponse.state))
            .rejects.toThrow(/Invalid request:.*must be, or extend, the runtime request type/i);
    });

    it('init does not throw for a stateless template (empty placeholder state)', async () => {
        const template = await loadTemplate();
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        // A stateless template (no compiled `init`) yields the empty placeholder `{ state: {} }`.
        // init() must not try to serialize/validate that classless placeholder.
        jest.spyOn(templateArchiveProcessor as unknown as { executeTypeScriptInit: () => Promise<InitResponse> },
            'executeTypeScriptInit').mockResolvedValue({ state: {} });
        const response = await templateArchiveProcessor.init(VALID_DATA);
        expect(response.state).toEqual({});
    });

    it('does not exempt a non-empty state that is missing $class (only {} is skipped)', async () => {
        const template = await loadTemplate();
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        // A non-empty classless object is not the stateless placeholder - it must still be
        // validated (and rejected), not silently skipped.
        jest.spyOn(templateArchiveProcessor as unknown as { executeTypeScriptInit: () => Promise<InitResponse> },
            'executeTypeScriptInit').mockResolvedValue({ state: { count: 1 } });
        await expect(templateArchiveProcessor.init(VALID_DATA)).rejects.toThrow();
    });

    describe('logic entry point resolution', () => {
        test('prefers logic/logic.ts', () => {
            expect(resolveLogicEntryPoint(['logic/README.md', 'logic/helpers.ts', 'logic/logic.ts'])).toBe('logic/logic.ts');
        });

        test('accepts a single non-standard logic file name', () => {
            expect(resolveLogicEntryPoint(['logic/mycontract.ts'])).toBe('logic/mycontract.ts');
        });

        test('ignores generated code, nested files and non-TypeScript files', () => {
            expect(resolveLogicEntryPoint([
                'logic/README.md',
                'logic/generated/concerto@1.0.0.ts',
                'logic/generated/io.clause.latedeliveryandpenalty@0.1.0.ts',
                'logic/utils/helpers.ts',
                'logic/mycontract.ts',
            ])).toBe('logic/mycontract.ts');
        });

        test('throws when there is no entry point', () => {
            expect(() => resolveLogicEntryPoint(['logic/README.md', 'logic/generated/concerto.ts']))
                .toThrow(/requires a TypeScript entry point/);
        });

        test('throws when the entry point is ambiguous', () => {
            expect(() => resolveLogicEntryPoint(['logic/a.ts', 'logic/b.ts']))
                .toThrow(/multiple candidate entry points \(logic\/a\.ts, logic\/b\.ts\)/);
        });

        test('should init and trigger a template whose logic is not named logic.ts', async () => {
            const template = await loadTemplateWithLogicFile('mycontract.ts');
            const templateArchiveProcessor = new TemplateArchiveProcessor(template);
            const request = {
                "$class": "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest",
                "forceMajeure": false,
                "agreedDelivery": "2017-10-07T16:38:01.412Z",
                "goodsValue": 100,
                "$timestamp": "2017-10-07T16:38:01.412Z"
            };

            const compiledCode = await templateArchiveProcessor.compileLogic();
            expect(compiledCode['logic/logic.ts']).toBeUndefined();
            expect(compiledCode['logic/mycontract.ts'].code).toContain('LateDeliveryAndPenalty');

            const stateResponse = await templateArchiveProcessor.init(VALID_DATA);
            const response = await templateArchiveProcessor.trigger(VALID_DATA, request, stateResponse.state);
            expect((response.result as { penalty?: number }).penalty).toBe(2625);
        });
    });
});
