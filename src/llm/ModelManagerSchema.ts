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


export interface TreeShakenModel {
  /** JSON Schema `definitions` map, keyed by fully-qualified type name,
   *  containing only the types reachable from the supplied roots. */
  definitions: Record<string, any>;
  /** The reduced set of .cto model files (name + source) — suitable for
   *  passing to the LLM as context without dumping the entire model. */
  modelFiles: { name: string; content: string }[];
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