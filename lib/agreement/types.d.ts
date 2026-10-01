import { ModelManager } from '@accordproject/concerto-core';
import { ConceptType, IConcept } from './logic';
/** The module logic imports its factories from, relative to logic/logic.ts. */
export declare const TYPES_MODULE = "./generated/types";
/** The module logic imports the logic API from. */
export declare const LOGIC_MODULE = "@accordproject/template-engine/logic";
/** A concrete declaration, as a factory. */
export interface TypeFactory {
    /** The declaration's short name: the factory's export name. */
    name: string;
    namespace: string;
    fqn: string;
    /** The identifying field, for a type identified by one of its own fields. */
    identifiedBy?: string;
}
/**
 * Every concrete, non-enum class declaration in the models, as a factory, sorted by
 * namespace then name. Factories are exported by short name, so two declarations that
 * share one are an error.
 * @param {ModelManager} modelManager - the template's models
 * @returns {TypeFactory[]} the factories
 */
export declare function typeFactories(modelManager: ModelManager): TypeFactory[];
/**
 * Every enum in the models, by namespace then name, as the object Concerto's TypeScript
 * codegen declares it (`enum E { A = 'A' }`).
 * @param {ModelManager} modelManager - the template's models
 * @returns {Record<string, Record<string, Record<string, string>>>} the enums
 */
export declare function enumValues(modelManager: ModelManager): Record<string, Record<string, Record<string, string>>>;
/**
 * The factories, as the values logic imports from './generated/types'.
 * @param {ModelManager} modelManager - the template's models
 * @returns {Record<string, ConceptType<IConcept>>} the factories, by name
 */
export declare function typeValues(modelManager: ModelManager): Record<string, ConceptType<IConcept>>;
/**
 * The TypeScript for logic/generated/types.ts: the factories, typed by the interfaces
 * Concerto's TypeScript codegen writes alongside it.
 * @param {ModelManager} modelManager - the template's models
 * @param {string} [logicModule] - where the factories' constructors are imported from
 * @returns {string} the module's source
 */
export declare function typesSource(modelManager: ModelManager, logicModule?: string): string;
