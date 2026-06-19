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
/* eslint-disable @typescript-eslint/no-explicit-any */

// ModelManager tree-shaking.
//
// Instead of loading a pre-generated schema.json and guessing which definition
// is the "request" / "response" / "state" / "event" by matching on the type
// name (which breaks for templates that call their response `PayOut`, `Payout`,
// etc.), we:
//
//   1. ask the Template for the *exact* fully-qualified type names it declares
//      (these are reliable because they are computed from the runtime base
//      classes the types extend, not from their names);
//   2. build a dependency graph of the whole ModelManager;
//   3. tree-shake that graph down to only the types reachable from the roots we
//      care about; and
//   4. generate a minimal JSON Schema (and a reduced set of .cto model files)
//      from that subgraph.
//
// See concerto-codegen `lib/common/graph.js` (ConcertoGraphVisitor +
// DirectedGraph.findConnectedGraph) and `test/common/graph.js` for the upstream
// pattern this mirrors.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const codegen = require('@accordproject/concerto-codegen');
const { ConcertoGraphVisitor, DirectedGraph } = codegen.Common;
const { JSONSchemaVisitor } = codegen.CodeGen;

/** Matches the Accord Project runtime base classes
 *  (org.accordproject.runtime@<ver>.Request / Response / State / Obligation)
 *  that every template's request/response/state/event types inherit from. */
const RUNTIME_BASE = /^org\.accordproject\.runtime@[\d.]+\./;

export interface TemplateRootTypes {
  /** Concrete request types the template accepts. */
  requests: string[];
  /** Concrete response/result types the template can return. */
  responses: string[];
  /** Concrete state types the template carries (empty ⇒ stateless). */
  states: string[];
  /** Concrete event types the template can emit. */
  events: string[];
}

export interface TreeShakenModel {
  /** JSON Schema `definitions` map, keyed by fully-qualified type name,
   *  containing only the types reachable from the supplied roots. */
  definitions: Record<string, any>;
  /** The reduced set of .cto model files (name + source) — suitable for
   *  passing to the LLM as context without dumping the entire model. */
  modelFiles: { name: string; content: string }[];
}

/** True for the Accord Project runtime/concerto base namespaces, which never
 *  carry a template's own request/response/state/event shapes. */
function isBaseType(fqn: string): boolean {
  return RUNTIME_BASE.test(fqn) || /^concerto/.test(fqn);
}

/** Drop the `org.accordproject.runtime@*` base classes that the cicero type
 *  accessors include alongside the template's own concrete subclasses. */
function templateOnly(types: string[] | undefined | null): string[] {
  if (!types) return [];
  return types.filter(t => !isBaseType(t));
}

/** Every non-abstract declaration across the template's model files. */
function concreteDeclarations(template: any): any[] {
  return template
    .getModelManager()
    .getModelFiles()
    .flatMap((mf: any) => mf.getAllDeclarations?.() ?? [])
    .filter((d: any) => !d.isAbstract?.());
}

/**
 * Concrete event types declared in the template's model.
 *
 * `template.getEmitTypes()` only finds subclasses of the runtime `Obligation`
 * base, so a template that emits a plain `event` (e.g. `PaymentObligationEvent`,
 * which doesn't extend `Obligation`) reports nothing. We instead enumerate every
 * concrete event declaration.
 */
export function getEventTypes(template: any): string[] {
  return concreteDeclarations(template)
    .filter((d: any) => d.isEvent?.())
    .map((d: any) => d.getFullyQualifiedName())
    .filter((fqn: string) => !isBaseType(fqn));
}

/**
 * Concrete state types declared in the template's model.
 *
 * Two signals are combined, because templates declare state inconsistently:
 *   1. subclasses of the runtime `State` base (`template.getStateTypes()`); and
 *   2. concepts whose name ends with `State` in the Accord Project convention
 */
export function getStateTypes(template: any): string[] {
  const fromBase = templateOnly(template.getStateTypes?.());
  const byName = concreteDeclarations(template)
    .map((d: any) => d.getFullyQualifiedName())
    .filter((fqn: string) => /State$/.test(fqn) && !isBaseType(fqn));
  return Array.from(new Set([...fromBase, ...byName]));
}

/**
 * Resolve the request / response / state / event type names a template declares.
 * Request and response come from the (reliable) runtime-base accessors; state
 * additionally falls back to the `*State` naming convention; events are
 * enumerated from event declarations.
 */
export function getRootTypes(template: any): TemplateRootTypes {
  return {
    requests: templateOnly(template.getRequestTypes?.()),
    responses: templateOnly(template.getResponseTypes?.()),
    states: getStateTypes(template),
    events: getEventTypes(template),
  };
}

/**
 * A template is stateless when it declares no custom state type.
 */
export function isStatelessTemplate(template: any): boolean {
  return getStateTypes(template).length === 0;
}

/**
 * Tree-shake a template's ModelManager down to only the declarations reachable
 * from `roots`, returning both the JSON Schema definitions and the reduced
 * model files.
 *
 * @param template  a cicero-core Template
 * @param roots     fully-qualified type names to keep (and their dependencies)
 */
export function treeShakeModel(template: any, roots: string[]): TreeShakenModel {
  const modelManager = template.getModelManager();

  // 1. Build the full dependency graph: every type is a vertex, every field /
  //    relationship / supertype / decorator reference is an edge.
  const graph = new DirectedGraph();
  modelManager.accept(new ConcertoGraphVisitor(), {
    graph,
    // Add reverse edges supertype -> subtype so that keeping a base type also
    // keeps its concrete subtypes (needed for abstract request/response bases).
    includeDerivedTypes: true,
  });

  // 2. BFS from the roots to find the maximal connected subgraph.
  const connected = graph.findConnectedGraph(roots);

  // 3. Filter the ModelManager to just the reachable declarations.
  const filtered = modelManager.filter((decl: any) =>
    connected.hasVertex(decl.getFullyQualifiedName())
  );

  // 4. Generate JSON Schema definitions + collect the reduced .cto files.
  const schema = filtered.accept(new JSONSchemaVisitor(), {});
  const modelFiles = filtered.getModelFiles().map((mf: any) => ({
    name: mf.getName?.() ?? 'unknown.cto',
    content: mf.getDefinitions?.() ?? '',
  }));

  return { definitions: schema.definitions ?? {}, modelFiles };
}
