export interface TreeShakenModel {
    /** JSON Schema `definitions` map, keyed by fully-qualified type name,
     *  containing only the types reachable from the supplied roots. */
    definitions: Record<string, any>;
}
/**
 * Tree-shake a template's ModelManager down to only the declarations reachable
 * from `roots`, returning both the JSON Schema definitions and the reduced
 * model files.
 *
 * @param template  a cicero-core Template
 * @param roots     fully-qualified type names to keep (and their dependencies)
 */
export declare function treeShakeModel(template: any, roots: string[]): TreeShakenModel;
