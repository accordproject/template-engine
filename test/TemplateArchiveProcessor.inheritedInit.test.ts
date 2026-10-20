import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

describe('TemplateArchiveProcessor - logic that only defines trigger', () => {

    const data = {
        $class: 'org.example@0.0.1.TemplateModel',
        clauseId: 'test',
        $identifier: 'test',
        name: 'World'
    };

    let processor: TemplateArchiveProcessor;

    beforeAll(async () => {
        const template = await Template.fromDirectory(
            'test/archives/inherited-init',
            { offline: true }
        );
        processor = new TemplateArchiveProcessor(template);
    });

    test('init returns an empty state when the logic inherits the default init', async () => {
        const response = await processor.init(data);
        expect(response).toEqual({ state: {} });
    });

    test('trigger works with the state returned by the inherited init', async () => {
        const { state } = await processor.init(data);
        const request = {
            $class: 'org.example@0.0.1.GreetingRequest',
            $timestamp: new Date().toISOString(),
            greeting: 'Hello'
        };
        const response = await processor.trigger(data, request, state);
        expect(response.result).toMatchObject({
            $class: 'org.example@0.0.1.GreetingResponse',
            message: 'Hello World'
        });
    });

});
