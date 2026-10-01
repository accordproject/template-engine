import { ClassDeclaration, ModelManager } from '@accordproject/concerto-core';
import { TemplateData } from './TemplateMarkNodes';
import { GenerationOptions } from './TypeScriptRuntime';
/**
 * A template engine: merges the markup and logic of a template with
 * JSON data to produce JSON data.
 */
export declare class TemplateMarkInterpreter {
    modelManager: ModelManager;
    templateClass: ClassDeclaration;
    clauseLibrary: object;
    constructor(modelManager: ModelManager, clauseLibrary: object, templateConceptFqn?: string);
    /**
     * Checks that a TemplateMark JSON document is valid with respect to the
     * TemplateMark model, as well as the template model.
     *
     * Checks:
     * 1. Variable names are valid properties in the template model
     * 2. Optional properties have guards
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON that has been typed checked and has type metadata added
     * @throws {Error} if the templateMark document is invalid
     */
    checkTypes(templateMark: object): object;
    /**
     * Compiles the code nodes containing TS to code nodes containing JS.
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON with JS nodes
     * @throws {Error} if the templateMark document is invalid
     */
    compileTypeScriptToJavaScript(templateMark: object): Promise<object>;
    validateCiceroMark(ciceroMark: object): object;
    generate(templateMark: object, data: TemplateData, options?: GenerationOptions): Promise<any>;
}
