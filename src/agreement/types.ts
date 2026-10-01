/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


// Model types as runtime values: one factory (see ./logic.ts `conceptType` and
// `identifiedType`) per concrete declaration, and one object per enum. The same list
// drives both the TypeScript a template's logic is written against
// (logic/generated/types.ts, see ./codegen.ts) and the values the engine supplies when
// that logic runs (see ./loader.ts), so the two can't disagree.

import { ModelManager } from '@accordproject/concerto-core';
import { conceptType, identifiedType, ConceptType, IConcept } from './logic';

/** The module logic imports its factories from, relative to logic/logic.ts. */
export const TYPES_MODULE = './generated/types';

/** The module logic imports the logic API from. */
export const LOGIC_MODULE = '@accordproject/template-engine/logic';

/** A concrete declaration, as a factory. */
export interface TypeFactory {
    /** The declaration's short name: the factory's export name. */
    name: string;
    namespace: string;
    fqn: string;
    /** The identifying field, for a type identified by one of its own fields. */
    identifiedBy?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Declaration = any;

function modelFiles(modelManager: ModelManager) {
    // System models (concerto@1.0.0) declare only abstract types.
    return modelManager.getModelFiles()
        .slice()
        .sort((a, b) => a.getNamespace().localeCompare(b.getNamespace()));
}

/**
 * Every concrete, non-enum class declaration in the models, as a factory, sorted by
 * namespace then name. Factories are exported by short name, so two declarations that
 * share one are an error.
 * @param {ModelManager} modelManager - the template's models
 * @returns {TypeFactory[]} the factories
 */
export function typeFactories(modelManager: ModelManager): TypeFactory[] {
    const factories: TypeFactory[] = [];
    const names = new Map<string, string>();
    for (const modelFile of modelFiles(modelManager)) {
        const declarations = modelFile.getAllDeclarations()
            .filter((d: Declaration) => d.isClassDeclaration?.() && !d.isEnum?.() && !d.isAbstract())
            .sort((a: Declaration, b: Declaration) => a.getName().localeCompare(b.getName()));
        for (const d of declarations) {
            const name: string = d.getName();
            const fqn: string = d.getFullyQualifiedName();
            if (names.has(name)) {
                throw new Error(`${fqn} and ${names.get(name)} have the same name, so logic can't import both from '${TYPES_MODULE}'. Rename one of them.`);
            }
            names.set(name, fqn);
            const identifiedBy = d.isIdentified() && !d.isSystemIdentified() ? d.getIdentifierFieldName() : undefined;
            factories.push({ name, namespace: modelFile.getNamespace(), fqn, ...(identifiedBy ? { identifiedBy } : {}) });
        }
    }
    return factories;
}

/**
 * Every enum in the models, by namespace then name, as the object Concerto's TypeScript
 * codegen declares it (`enum E { A = 'A' }`).
 * @param {ModelManager} modelManager - the template's models
 * @returns {Record<string, Record<string, Record<string, string>>>} the enums
 */
export function enumValues(modelManager: ModelManager): Record<string, Record<string, Record<string, string>>> {
    const result: Record<string, Record<string, Record<string, string>>> = {};
    for (const modelFile of modelManager.getModelFiles(true)) {
        const enums: Declaration[] = modelFile.getAllDeclarations().filter((d: Declaration) => d.isEnum?.());
        for (const d of enums) {
            const values = Object.fromEntries(d.getOwnProperties().map((p: Declaration) => [p.getName(), p.getName()]));
            (result[modelFile.getNamespace()] ??= {})[d.getName()] = Object.freeze(values);
        }
    }
    return result;
}

/**
 * The factories, as the values logic imports from './generated/types'.
 * @param {ModelManager} modelManager - the template's models
 * @returns {Record<string, ConceptType<IConcept>>} the factories, by name
 */
export function typeValues(modelManager: ModelManager): Record<string, ConceptType<IConcept>> {
    return Object.fromEntries(typeFactories(modelManager).map(f => [
        f.name,
        f.identifiedBy
            ? identifiedType<IConcept>()(f.fqn, f.identifiedBy as never)
            : conceptType<IConcept>()(f.fqn),
    ]));
}

/**
 * The TypeScript for logic/generated/types.ts: the factories, typed by the interfaces
 * Concerto's TypeScript codegen writes alongside it.
 * @param {ModelManager} modelManager - the template's models
 * @param {string} [logicModule] - where the factories' constructors are imported from
 * @returns {string} the module's source
 */
export function typesSource(modelManager: ModelManager, logicModule: string = LOGIC_MODULE): string {
    const factories = typeFactories(modelManager);
    const byNamespace = new Map<string, TypeFactory[]>();
    for (const f of factories) {
        byNamespace.set(f.namespace, [...(byNamespace.get(f.namespace) ?? []), f]);
    }
    return [
        '// Generated by template-engine from the models: one factory per concrete type,',
        '// so logic never writes a $class by hand. Do not edit.',
        `import { conceptType, identifiedType } from '${logicModule}';`,
        ...[...byNamespace].map(([namespace, fs]) =>
            `import type { ${fs.map(f => `I${f.name}`).join(', ')} } from './${namespace}';`),
        '',
        ...factories.map(f => f.identifiedBy
            ? `export const ${f.name} = identifiedType<I${f.name}>()('${f.fqn}', '${f.identifiedBy}');`
            : `export const ${f.name} = conceptType<I${f.name}>()('${f.fqn}');`),
        '',
    ].join('\n');
}
