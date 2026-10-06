import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

describe('TemplateArchiveProcessor - no logic template', () => {

    const data = {
        $class: 'org.example@0.0.1.TemplateModel',
        clauseId: 'test',
        $identifier: 'test',
        name: 'Test'
    };

    let processor: TemplateArchiveProcessor;

    beforeAll(async () => {
        const template = await Template.fromDirectory(
            'test/archives/no-logic-template',
            { offline: true }
        );
        processor = new TemplateArchiveProcessor(template);
    });

    test('should throw an explicit error on trigger if template has no TypeScript logic', async () => {
        await expect(processor.trigger(data, null))
            .rejects.toThrow('No executable logic found and LLM fallback is disabled');
    });

    test('should throw an explicit error on init if template has no TypeScript logic', async () => {
        await expect(processor.init(data))
            .rejects.toThrow('No executable logic found and LLM fallback is disabled');
    });

});
