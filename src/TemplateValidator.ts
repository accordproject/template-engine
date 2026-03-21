import jp from 'jsonpath';
import traverse from 'traverse';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { ModelManager, ClassDeclaration } from '@accordproject/concerto-core';
import { TemplateMarkModel } from '@accordproject/markdown-common';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
import { getTemplateClassDeclaration, writeFunctionToString } from './utils';
import { CodeType } from './model-gen/org.accordproject.templatemark@0.5.0';

export interface ValidationError {
    type: 'missing_variable' | 'invalid_formula' | 'type_mismatch' | 'syntax_error';
    message: string;
    line?: number;
    column?: number;
    context?: string;
    variable?: string;
    expectedType?: string;
    actualType?: string;
    formula?: string;
}

export interface ValidationOptions {
    debug?: boolean;
    strict?: boolean;
    errorRecovery?: boolean;
}

export interface ValidationResult {
    errors: ValidationError[];
    warnings: ValidationError[];
    isValid: boolean;
}

export class TemplateValidator {
    private modelManager: ModelManager;
    private options: ValidationOptions;
    private templateClass?: ClassDeclaration;
    private compiler?: TypeScriptToJavaScriptCompiler;

    constructor(modelManager: ModelManager, templateConceptFqn?: string, options: ValidationOptions = {}) {
        this.modelManager = modelManager;
        this.options = { debug: false, strict: false, errorRecovery: true, ...options };
        this.templateClass = getTemplateClassDeclaration(modelManager, templateConceptFqn);
        this.compiler = new TypeScriptToJavaScriptCompiler(modelManager, templateConceptFqn);
    }

    async initialize(): Promise<void> {
        if (this.compiler) {
            await this.compiler.initialize();
        }
    }

    /**
     * Validate a template against data and model
     * @param template - Template markdown string or parsed JSON
     * @param data - Template data object
     * @returns Validation result with errors and warnings
     */
    async validate(template: string | any, data: any): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        try {
            if (this.options.debug) console.log('Starting template validation...');

            const templateJson = typeof template === 'string' ? this.parseTemplate(template) : template;

            if (this.options.debug) console.log('Template parsed successfully');

            const variables = this.extractVariables(templateJson);
            const formulas = this.extractFormulas(templateJson);

            if (this.options.debug) {
                console.log(`Found ${variables.length} variables and ${formulas.length} formulas`);
            }

            const variableErrors = this.validateVariables(variables, data);
            errors.push(...variableErrors);

            const formulaErrors = await this.validateFormulas(formulas);
            errors.push(...formulaErrors);

        } catch (error) {
            if (this.options.debug) console.error('Validation error:', error);
            const err = error as Error;
            errors.push({
                type: 'syntax_error',
                message: `Template parsing failed: ${err.message}`,
                context: err.stack
            });
        }

        const isValid = errors.length === 0;

        if (this.options.debug) {
            console.log(`Validation complete. Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);
        }

        return { errors, warnings, isValid };
    }

    private parseTemplate(template: string): any {
        const transformer = new TemplateMarkTransformer();
        return transformer.fromMarkdown(template, this.modelManager);
    }

    private extractVariables(templateJson: any): Array<{name: string, path: string, location?: any}> {
        const variables: Array<{name: string, path: string, location?: any}> = [];

        traverse(templateJson).forEach((x) => {
            if (x && x.$class === `${TemplateMarkModel.NAMESPACE}.VariableDefinition`) {
                variables.push({
                    name: x.name,
                    path: x.name,
                    location: x.location
                });
            }
        });

        return variables;
    }

    private extractFormulas(templateJson: any): Array<{code: string, location?: any, nodeId?: string}> {
        const formulas: Array<{code: string, location?: any, nodeId?: string}> = [];

        traverse(templateJson).forEach((x) => {
            if (x && x.$class === `${TemplateMarkModel.NAMESPACE}.FormulaDefinition` && x.code) {
                formulas.push({
                    code: x.code.contents,
                    location: x.location,
                    nodeId: x.name
                });
            }
        });

        return formulas;
    }

    private validateVariables(variables: Array<{name: string, path: string, location?: any}>, data: any): ValidationError[] {
        const errors: ValidationError[] = [];

        for (const variable of variables) {
            if (!this.hasVariable(data, variable.path)) {
                errors.push({
                    type: 'missing_variable',
                    message: `Variable '${variable.name}' is missing from template data`,
                    line: variable.location?.start?.line,
                    column: variable.location?.start?.column,
                    variable: variable.name,
                    context: this.getLineContext(variable.location)
                });
            } else {
                const expectedType = this.getExpectedType(variable.name);
                const actualType = this.getActualType(data, variable.path);

                if (expectedType && actualType && !this.typesCompatible(expectedType, actualType)) {
                    const error: ValidationError = {
                        type: 'type_mismatch',
                        message: `Variable '${variable.name}' has type '${actualType}', expected '${expectedType}'`,
                        line: variable.location?.start?.line,
                        column: variable.location?.start?.column,
                        variable: variable.name,
                        expectedType,
                        actualType,
                        context: this.getLineContext(variable.location)
                    };

                    if (this.options.errorRecovery) {
                        errors.push(error);
                    } else {
                        errors.push(error);
                    }
                }
            }
        }

        return errors;
    }

    private async validateFormulas(formulas: Array<{code: string, location?: any, nodeId?: string}>): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        if (!this.compiler || !this.templateClass) {
            return errors; // Skip if no compiler
        }

        for (const formula of formulas) {
            try {
                const result = this.compiler.compile(writeFunctionToString(this.templateClass, formula.nodeId || 'formula', 'any', formula.code));

                if (result.errors && result.errors.length > 0) {
                    for (const tsError of result.errors) {
                        errors.push({
                            type: 'invalid_formula',
                            message: `Formula error: ${tsError.renderedMessage}`,
                            line: formula.location?.start?.line,
                            column: tsError.start,
                            formula: formula.code,
                            context: this.getLineContext(formula.location)
                        });
                    }
                }
            } catch (error) {
                const err = error as Error;
                errors.push({
                    type: 'invalid_formula',
                    message: `Formula compilation failed: ${err.message}`,
                    line: formula.location?.start?.line,
                    formula: formula.code,
                    context: this.getLineContext(formula.location)
                });
            }
        }

        return errors;
    }

    private hasVariable(data: any, path: string): boolean {
        try {
            const value = jp.value(data, `$.${path}`);
            return value !== undefined;
        } catch {
            return false;
        }
    }

    private getExpectedType(variableName: string): string | null {
        return null;
    }

    private getActualType(data: any, path: string): string | null {
        try {
            const value = jp.value(data, `$.${path}`);
            return typeof value;
        } catch {
            return null;
        }
    }

    private typesCompatible(expected: string, actual: string): boolean {
        if (expected === actual) return true;
        return false;
    }

    private getLineContext(location?: any): string | undefined {
        if (!location) return undefined;
        return `Line ${location.start?.line || 'unknown'}`;
    }
}

export async function validateTemplate(
    template: string | any,
    data: any,
    modelManager: ModelManager,
    templateConceptFqn?: string,
    options?: ValidationOptions
): Promise<ValidationResult> {
    const validator = new TemplateValidator(modelManager, templateConceptFqn, options);
    await validator.initialize();
    return validator.validate(template, data);
}