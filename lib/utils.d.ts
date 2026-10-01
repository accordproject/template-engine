import { ClassDeclaration, ModelManager } from '@accordproject/concerto-core';
export declare const RUNTIME_STATE_FQN = "org.accordproject.runtime@0.2.0.State";
export declare const RUNTIME_REQUEST_FQN = "org.accordproject.runtime@0.2.0.Request";
export declare const RUNTIME_RESPONSE_FQN = "org.accordproject.runtime@0.2.0.Response";
export declare const BASE_EVENT_FQN = "concerto@1.0.0.Event";
export declare const RUNTIME_OBLIGATION_FQN = "org.accordproject.runtime@0.2.0.Obligation";
export declare const RUNTIME_CONTRACT_FQN = "org.accordproject.contract@0.2.0.Contract";
export declare const RUNTIME_1_REQUEST_FQN = "org.accordproject.runtime@1.0.0.Request";
export declare const RUNTIME_1_RESPONSE_FQN = "org.accordproject.runtime@1.0.0.Response";
export declare const TEMPLATE_DATA_FQN = "org.accordproject.templatedata@1.0.0.TemplateData";
export declare const STATE_DATA_FQN = "org.accordproject.templatedata@1.0.0.StateData";
/**
 * Returns the concrete (non-abstract) class declarations assignable to baseFqn: the base
 * type itself (when concrete) plus every subclass of it. Returns an empty array when
 * baseFqn is not present in the model. This is the single source of truth for the runtime
 * type hierarchy — used both to build the compile-time unions (TypeScriptCompilationContext)
 * and to check payloads at runtime (TemplateArchiveProcessor).
 *
 * TODO: migrate to a Concerto-provided helper once available — see
 * https://github.com/accordproject/concerto/issues/1281
 * @param {ModelManager} modelManager - the model manager to resolve types against
 * @param {string} baseFqn - the fully-qualified name of the runtime base type
 * @returns {ClassDeclaration[]} the concrete assignable declarations (base + subclasses)
 */
export declare function getAssignableConcreteTypes(modelManager: ModelManager, baseFqn: string): ClassDeclaration[];
/**
 * Returns true when the type identified by fqn is, or extends, baseFqn (restricted to
 * concrete types). Used to enforce the runtime class hierarchy against a payload's $class.
 * @param {ModelManager} modelManager - the model manager to resolve types against
 * @param {string} fqn - the fully-qualified name of the candidate type
 * @param {string} baseFqn - the fully-qualified name of the runtime base type
 * @returns {boolean} true if fqn is, or extends, baseFqn
 */
export declare function isAssignableTo(modelManager: ModelManager, fqn: string, baseFqn: string): boolean;
export declare function ensureDirSync(path: string): void;
export declare function removeSync(path: string): void;
export declare function writeFunctionToString(templateClass: ClassDeclaration, functionName: string, returnType: string, code: string): string;
export declare function nameUserCode(templateMarkDom: any): any;
export declare function getTemplateClassDeclaration(modelManager: ModelManager, templateConceptFqn?: string): ClassDeclaration;
