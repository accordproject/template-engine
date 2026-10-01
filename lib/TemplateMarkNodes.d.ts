export declare const TEMPLATEMARK_RE: RegExp;
export declare const FORMULA_DEFINITION_RE: RegExp;
export declare const VARIABLE_DEFINITION_RE: RegExp;
export declare const CONDITIONAL_DEFINITION_RE: RegExp;
export declare const ENUM_VARIABLE_DEFINITION_RE: RegExp;
export declare const FORMATTED_VARIABLE_DEFINITION_RE: RegExp;
export declare const WITH_DEFINITION_RE: RegExp;
export declare const LISTBLOCK_DEFINITION_RE: RegExp;
export declare const JOIN_DEFINITION_RE: RegExp;
export declare const OPTIONAL_DEFINITION_RE: RegExp;
export declare const CLAUSE_DEFINITION_RE: RegExp;
export declare const CONTRACT_DEFINITION_RE: RegExp;
export declare const FOREACH_DEFINITION_RE: RegExp;
export type TemplateData = Record<string, unknown>;
/**
 * TemplateMark nodes that implicitly change the data access scope
 * by specifying the name of a property on the node.
 */
export declare const NAVIGATION_NODES: string[];
