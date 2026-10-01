import { ModelManager } from '@accordproject/concerto-core';
import { Logic } from './logic';
/** The exports of each module the engine supplies to logic, by import specifier. */
export type Modules = Record<string, Record<string, unknown>>;
/**
 * The modules the engine supplies to logic compiled against `modelManager`.
 * @param {ModelManager} modelManager - the template's models
 * @returns {Modules} the modules, by import specifier
 */
export declare function runtimeModules(modelManager: ModelManager): Modules;
/**
 * Whether a template's logic is written against the logic API (./logic.ts), rather than
 * as a TemplateLogic class.
 * @param {string} source - the TypeScript source of logic/logic.ts
 * @returns {boolean} true if it imports '@accordproject/template-engine/logic'
 */
export declare function usesLogicApi(source: string): boolean;
/**
 * Rewrites the imports of compiled logic to read from the module registry entry `key`.
 * @param {any} ts - the typescript module
 * @param {string} code - the compiled JavaScript
 * @param {string} key - the registry entry holding this load's modules
 * @param {Set<string>} specifiers - the modules the registry entry holds
 * @returns {string} the rewritten JavaScript
 */
export declare function rewriteImports(ts: any, code: string, key: string, specifiers: Set<string>): string;
/**
 * Loads compiled logic, returning its default export.
 * @param {string} code - the compiled JavaScript of logic/logic.ts
 * @param {Modules} modules - the modules the engine supplies to it
 * @returns {Promise<Logic>} the template's logic
 */
export declare function loadLogic(code: string, modules: Modules): Promise<Logic<any, any>>;
