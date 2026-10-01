import { ClassDeclaration, ModelManager } from '@accordproject/concerto-core';
/** How a template's logic is written. */
export type CompilationOptions = {
    /**
     * True for logic written with the logic API ('@accordproject/template-engine/logic'),
     * which imports its factories from './generated/types'.
     */
    logicApi?: boolean;
};
/**
 * This class creates the typescript types
 * required to compile Typescript expressions (used in
 * formulae, conditions and clauses) to JavaScript. It uses
 * these to create a compilation context for '@typescript/twoslash'
 * which is used to compile the typescript code.
 */
export declare class TypeScriptCompilationContext {
    modelManager: ModelManager;
    templateClass: ClassDeclaration;
    options: CompilationOptions;
    constructor(modelManager: ModelManager, templateConceptFqn?: string, options?: CompilationOptions);
    getTypeScriptFiles(): Record<string, string>;
    /**
     * Builds a TypeScript union type over the concrete types assignable to a runtime
     * base type (the base itself, when concrete, plus its subclasses), along with the
     * imports required to reference them. Because the base is included, using the bare
     * base type or any subclass type-checks. A plain concept that does not extend the
     * base is still rejected structurally where the base carries a distinguishing member
     * (Response/Event require `$timestamp`); State carries only `$identifier`, so a
     * concept-shaped state is admitted here and instead enforced nominally at runtime
     * (see TemplateArchiveProcessor.assertRuntimeHierarchy). When the base type is absent
     * the union is `never`.
     * @param {string} baseFqn the fully-qualified name of the runtime base type
     * @param {string} aliasPrefix a unique prefix for the imported type aliases
     * @returns {{imports: string, union: string}} the import statements and union type
     */
    private buildRuntimeUnion;
    /**
     * Emits the runtime SmartLegalContract declarations (IConcept, TemplateLogic, etc.)
     * with the State / Request / Response / Event type positions bound to the model-derived
     * Runtime* unions (the concrete base type plus its subclasses; see buildRuntimeUnion).
     * Because the concrete base is included, using the bare base type or a subclass
     * type-checks. Types that are structurally incompatible with the base still fail here
     * (Response/Event require `$timestamp`); State carries only `$identifier`, so a
     * concept-shaped state type-checks and is instead enforced nominally at runtime (see
     * TemplateArchiveProcessor.assertRuntimeHierarchy).
     * @returns {string} the runtime declarations, as a TypeScript source string
     */
    private getRuntimeDeclarations;
    getCompilationContext(): string;
}
