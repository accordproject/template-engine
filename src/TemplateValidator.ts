export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export class TemplateValidator {

  static validate(template: string, model: Record<string, any>): ValidationResult {

    const errors: string[] = [];
    const warnings: string[] = [];

    // find variables like {{variable}}
    const variableRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

    const foundVariables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      foundVariables.add(match[1]);
    }

    // check if variables exist in model
    foundVariables.forEach(variable => {
      if (!(variable in model)) {
        errors.push(`Variable '${variable}' not defined in TemplateData model`);
      }
    });

    // optional: detect unused model fields
    Object.keys(model).forEach(field => {
      if (!foundVariables.has(field)) {
        warnings.push(`Field '${field}' defined but not used in template`);
      }
    });

    return {
      errors,
      warnings
    };
  }
}