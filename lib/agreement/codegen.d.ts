import { Template } from '@accordproject/cicero-core';
/**
 * The generated TypeScript for a template's models: an interface per type (Concerto's
 * TypeScript codegen) and, for logic written with defineLogic, types.ts.
 * @param {Template} template - the template
 * @param {boolean} logicApi - whether to include types.ts
 * @returns {Record<string, string>} each file's source, by file name
 */
export declare function logicTypes(template: Template, logicApi: boolean): Record<string, string>;
/**
 * Writes <templateDir>/logic/generated, replacing any TypeScript already there. types.ts
 * is written when logic/logic.ts uses the logic API, or when there is no logic yet.
 * @param {string} templateDir - the template's directory
 * @param {object} [options] - `offline`: load external models from the template's cached copies
 * @returns {Promise<string[]>} the files written
 */
export declare function generateLogicTypes(templateDir: string, options?: {
    offline?: boolean;
}): Promise<string[]>;
