import { ModelManager } from '@accordproject/concerto-core';
import { TemplateValidator } from '../src';

describe('TemplateValidator', () => {
    let modelManager: ModelManager;
    let validator: TemplateValidator;

    beforeAll(async () => {
        modelManager = new ModelManager();
        await modelManager.addCTOModel(`
        namespace test@1.0.0

        concept TemplateData {
            o String name
            o Integer age
        }
        `);
        validator = new TemplateValidator(modelManager, 'test@1.0.0.TemplateData');
        await validator.initialize();
    });

    test('detects missing variable', async () => {
        const template = 'Hello {{name}}! You are {{age}} years old.';
        const data = { name: 'World' };

        const result = await validator.validate(template, data);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].type).toBe('missing_variable');
        expect(result.errors[0].variable).toBe('age');
    });

    test('passes with valid data', async () => {
        const template = 'Hello {{name}}!';
        const data = { name: 'World', age: 30 };

        const result = await validator.validate(template, data);

        expect(result.isValid).toBe(true);
    });

    test('catches formula errors', async () => {
        const template = 'Result: {{% INVALID CODE %}}';
        const data = { name: 'World' };

        const result = await validator.validate(template, data);

        expect(result.isValid).toBe(false);
        // check if we got a formula error
        const hasFormulaError = result.errors.some(e => e.type === 'invalid_formula');
        expect(hasFormulaError).toBe(true);
    });

    test('works with debug mode enabled', async () => {
        const template = 'Hello {{name}}!';
        const data = { name: 'World', age: 30 };

        const debugValidator = new TemplateValidator(modelManager, 'test@1.0.0.TemplateData', { debug: true });
        await debugValidator.initialize();

        const result = await debugValidator.validate(template, data);

        expect(result.isValid).toBe(true);
    });
});