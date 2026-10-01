import { ClassDeclaration, ModelManager } from '@accordproject/concerto-core';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
import { TwoSlashReturn } from '@typescript/twoslash';
export type CompilerError = {
    nodeId: string;
    code: string;
    errors: TwoSlashReturn['errors'];
};
/**
 * Compiles all the Typescript nodes in a TemplateMark JSON
 * to ES_2020 and returns a modified TemplateMark JSON.
 */
export declare class TemplateMarkToJavaScriptCompiler {
    modelManager: ModelManager;
    compiler: TypeScriptToJavaScriptCompiler;
    templateClass: ClassDeclaration;
    constructor(modelManager: ModelManager, templateConceptFqn?: string);
    initialize(): Promise<void>;
    compile(templateJson: any): any;
}
