import { TemplateValidator } from '../src/TemplateValidator';

describe('TemplateValidator', () => {

  it('should detect missing variables', () => {

    const template = "Hello {{name}} {{age}}";

    const model = {
      name: "Alice"
    };

    const result = TemplateValidator.validate(template, model);

    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("age");

  });

});