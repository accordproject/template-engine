import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

describe('TemplateArchiveProcessor - no logic template', () => {

    test('should throw if template has no TypeScript logic on trigger', async () => {

        const template = await Template.fromDirectory(
            'test/archives/no-logic-template',
            { offline: true }
        );

        const processor = new TemplateArchiveProcessor(template);

        const data = {
            $class: 'org.example.TemplateModel',
            $identifier: 'test'
        };

        const request = {};

        await expect(
            processor.trigger(data, request)).rejects.toThrow('No TypeScript logic files found');

    });

});