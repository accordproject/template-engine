/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import traverse from 'traverse';
import { ClassDeclaration, ModelManager, Property } from '@accordproject/concerto-core';
import { TemplateMarkModel } from '@accordproject/markdown-common';

/**
 * Represents a validation error with detailed context
 */
export interface ValidationError {
    code: string;
    severity: 'error' | 'warning';
    message: string;
    details?: string;
    path?: string;
    line?: number;
    column?: number;
}

/**
 * Represents validation results
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

/**
 * Validates templates for common issues and provides enhanced error messages
 */
export class ValidationEngine {
    private templateDom: any;
    private modelManager: ModelManager;
    private templateClass?: ClassDeclaration;
    private errors: ValidationError[] = [];
    private warnings: ValidationError[] = [];

    constructor(templateDom: any, modelManager: ModelManager, templateClass?: ClassDeclaration) {
        this.templateDom = templateDom;
        this.modelManager = modelManager;
        this.templateClass = templateClass;
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Run all validations on the template
     */
    public validate(): ValidationResult {
        this.errors = [];
        this.warnings = [];

        this.validateTemplateStructure();
        this.validateVariables();
        this.validateConditionals();
        this.validateFormulas();
        this.validateDataTypes();

        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    /**
     * Validates that the template has the correct structure
     */
    private validateTemplateStructure(): void {
        if (!this.templateDom) {
            this.addError('INVALID_TEMPLATE_STRUCTURE', 'Template DOM is null or undefined');
            return;
        }

        if (!this.templateDom.$class) {
            this.addError('MISSING_CLASS', 'Template DOM missing $class property');
            return;
        }

        const isValidRoot = [
            `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
            `${TemplateMarkModel.NAMESPACE}.ContractDefinition`,
            'org.accordproject.commonmark@0.5.0.Document'
        ].some(type => this.templateDom.$class === type);

        if (!isValidRoot) {
            this.addError(
                'INVALID_ROOT_TYPE',
                `Invalid root type: ${this.templateDom.$class}. Expected ClauseDefinition, ContractDefinition, or Document.`
            );
        }
    }

    /**
     * Validates variable references against the data model
     */
    private validateVariables(): void {
        const variables = new Set<string>();
        const properties = this.getAvailableProperties();

        traverse(this.templateDom).forEach((node: any) => {
            if (node && node.$class === `${TemplateMarkModel.NAMESPACE}.Variable`) {
                const varName = node.name;
                variables.add(varName);

                if (varName && !properties.has(varName)) {
                    this.addWarning(
                        'UNDEFINED_VARIABLE',
                        `Variable '${varName}' is not defined in the data model`,
                        varName
                    );
                }

                if (!node.value && !node.optional) {
                    this.addWarning(
                        'VARIABLE_WITHOUT_VALUE',
                        `Variable '${varName}' has no value`,
                        varName
                    );
                }
            }
        });
    }

    /**
     * Validates conditional expressions
     */
    private validateConditionals(): void {
        traverse(this.templateDom).forEach((node: any) => {
            if (node && node.$class === `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition`) {
                if (!node.condition) {
                    this.addError(
                        'MISSING_CONDITION',
                        'ConditionalDefinition missing condition expression',
                        node.name
                    );
                }

                if (!node.whenTrue && !node.whenFalse) {
                    this.addWarning(
                        'EMPTY_CONDITIONAL',
                        `Conditional '${node.name}' has no content in either branch`,
                        node.name
                    );
                }
            }
        });
    }

    /**
     * Validates formula expressions
     */
    private validateFormulas(): void {
        traverse(this.templateDom).forEach((node: any) => {
            if (node && node.$class === `${TemplateMarkModel.NAMESPACE}.Formula`) {
                if (!node.code || !node.code.contents) {
                    this.addError(
                        'EMPTY_FORMULA',
                        `Formula '${node.name}' is empty`,
                        node.name
                    );
                }

                // Check for common formula syntax errors
                const contents = node.code?.contents || '';
                if (contents.includes('{{') || contents.includes('}}')) {
                    this.addWarning(
                        'POSSIBLE_NESTED_VARIABLE',
                        `Formula '${node.name}' contains template markers which may indicate nesting issues`,
                        node.name
                    );
                }
            }
        });
    }

    /**
     * Validates data type consistency
     */
    private validateDataTypes(): void {
        const properties = this.getPropertyMap();
        const variables = new Map<string, any>();

        traverse(this.templateDom).forEach((node: any) => {
            if (node && node.$class === `${TemplateMarkModel.NAMESPACE}.Variable`) {
                const varName = node.name;
                const prop = properties.get(varName);

                if (prop && node.elementType) {
                    const expectedType = prop.getType();
                    if (expectedType !== node.elementType) {
                        this.addWarning(
                            'TYPE_MISMATCH',
                            `Variable '${varName}' has type mismatch. Expected '${expectedType}' but got '${node.elementType}'`,
                            varName
                        );
                    }
                }
                variables.set(varName, node);
            }
        });
    }

    /**
     * Get available properties from the template data model
     */
    private getAvailableProperties(): Set<string> {
        const properties = new Set<string>();

        if (this.templateClass) {
            this.templateClass.getProperties().forEach((prop: Property) => {
                properties.add(prop.getName());
            });
        }

        return properties;
    }

    /**
     * Get property map with details
     */
    private getPropertyMap(): Map<string, Property> {
        const propertyMap = new Map<string, Property>();

        if (this.templateClass) {
            this.templateClass.getProperties().forEach((prop: Property) => {
                propertyMap.set(prop.getName(), prop);
            });
        }

        return propertyMap;
    }

    /**
     * Add an error to the validation results
     */
    private addError(code: string, message: string, details?: string): void {
        this.errors.push({
            code,
            severity: 'error',
            message,
            details
        });
    }

    /**
     * Add a warning to the validation results
     */
    private addWarning(code: string, message: string, details?: string): void {
        this.warnings.push({
            code,
            severity: 'warning',
            message,
            details
        });
    }

    /**
     * Get a human-readable report of validation results
     */
    public getReport(result: ValidationResult): string {
        let report = '';

        if (result.isValid) {
            report += '✓ Template validation passed\n';
        } else {
            report += '✗ Template validation failed\n\n';
        }

        if (result.errors.length > 0) {
            report += `Errors (${result.errors.length}):\n`;
            result.errors.forEach((err, idx) => {
                report += `  ${idx + 1}. [${err.code}] ${err.message}\n`;
                if (err.details) {
                    report += `     Details: ${err.details}\n`;
                }
            });
            report += '\n';
        }

        if (result.warnings.length > 0) {
            report += `Warnings (${result.warnings.length}):\n`;
            result.warnings.forEach((warn, idx) => {
                report += `  ${idx + 1}. [${warn.code}] ${warn.message}\n`;
                if (warn.details) {
                    report += `     Details: ${warn.details}\n`;
                }
            });
        }

        return report;
    }
}
