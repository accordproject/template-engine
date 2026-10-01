import { TwoSlashReturn } from '@typescript/twoslash';
import { ModelManager } from '@accordproject/concerto-core';
import { CompilationOptions } from './TypeScriptCompilationContext';
export declare class TypeScriptToJavaScriptCompiler {
    context: string;
    fsMap: Map<string, string> | undefined;
    ts: any;
    typescriptUrl: string;
    constructor(modelManager: ModelManager, templateConceptFqn?: string, options?: CompilationOptions);
    initialize(typescriptUrl?: string): Promise<void>;
    compile(typescript: string): TwoSlashReturn;
}
