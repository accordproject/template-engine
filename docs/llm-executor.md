# LLM Executor

The LLM executor runs an Accord Project template's `init` and `trigger` operations through an LLM instead of compiled Ergo/TypeScript logic. It's a fallback (or forced alternative) for templates with no executable logic, or when you want a model to infer contract behaviour.

The design goal: give the model exactly the right context — only the request/response/state/event types of *this* template (and their dependencies), as a strict JSON Schema the provider can enforce. We get there by tree-shaking the template's Concerto model.

## Module map

| File | Responsibility |
| --- | --- |
| `src/llm/ModelManagerSchema.ts` | Detects the template's root types and tree-shakes the `ModelManager` down to a minimal schema + reduced `.cto` set. |
| `src/llm/LLMExecutor.ts` | Builds the `init`/`trigger` JSON Schemas, prompts the model, validates and post-processes the response. |
| `src/llm/Reasoners.ts` | Thin provider clients (OpenAI / Anthropic) with native structured-output support. |
| `src/llm/LLMConfig.ts` | Configuration types (provider, model, temperature, retries, …). |

## Detect types, don't guess names

A template declares four kinds of runtime types. The executor resolves them from the model itself — never by matching type names, since templates name things inconsistently (a response called `PayOut`, a state that's just a plain `concept …State`, etc).

| Root | How it's detected | Why |
| --- | --- | --- |
| **request** | Concrete subclasses of `org.accordproject.runtime@*.Request` (`template.getRequestTypes()`). | Requests always extend the runtime base. |
| **response** | Concrete subclasses of `org.accordproject.runtime@*.Response` (`template.getResponseTypes()`). | Reliable even when named `PayOut`, `Payout`, etc. |
| **state** | Subclasses of the runtime `State` base, or any concrete declaration whose name ends in `State`. | Some templates declare state as `concept FooState identified {}` without extending the runtime base — the accessor alone misses these. |
| **events** | Every concrete `event` declaration in the model. | `getEmitTypes()` only finds `Obligation` subclasses, so plain `event`s get missed. |

All four come back as lists (`getRootTypes()` → `{ requests, responses, states, events }`) since a template can declare several of each.

A template is stateless when no state type is found — `init` returns `{}` and `trigger` omits `state` entirely.

## Model tree-shaking

Every type in the model is a vertex; every dependency (field type, supertype, relationship, map key/value, decorator) is an edge. Tree-shaking keeps only what's reachable from the root types.

`treeShakeModel` in `ModelManagerSchema.ts`:

```ts
const graph = new DirectedGraph();
modelManager.accept(new ConcertoGraphVisitor(), { graph, includeDerivedTypes: true });

const connected = graph.findConnectedGraph(roots);            // BFS from roots
const filtered  = modelManager.filter(d =>                    // keep reachable only
  connected.hasVertex(d.getFullyQualifiedName()));

const schema = filtered.accept(new JSONSchemaVisitor(), {});  // { definitions }
```

- `includeDerivedTypes: true` adds reverse edges (supertype → subtype), so keeping a base type also keeps its concrete subtypes.
- `findConnectedGraph` takes an array of roots and returns the maximal subgraph reachable from any of them.
- The reduced `.cto` files are collected too and sent as prompt context, so the model never sees the whole model.

Upstream reference: `@accordproject/concerto-codegen` — `lib/common/graph.js` (`ConcertoGraphVisitor`, `DirectedGraph.findConnectedGraph`).

## From tree-shaken model to a strict response schema

`JSONSchemaVisitor` output uses `$ref` and carries Concerto-specific keywords. The executor turns each root type into a self-contained, provider-safe schema in three passes:

- **`deepResolve`** — inlines every `$ref` pointer (with a cycle guard) so the schema is fully self-contained. Required by Anthropic, safe for OpenAI.
- **`enforceAdditionalPropertiesFalse`** — sets `additionalProperties: false` on every object, since strict structured outputs reject unknown keys.
- **`cleanForStructuredOutput`** — strips keywords the strict APIs don't support (`pattern`, `format`, `minLength`, `maximum`, `default`, …) and pins the Concerto discriminator `$class` to a `const` of the exact fully-qualified type name, forcing the model to emit the correct type tag.

When a template has multiple responses or events, the types combine with `anyOf` (`resolveUnionSchema`), so the model can return whichever fits the incoming request.

## The `init` / `trigger` schemas

The per-type schemas above get wrapped in operation envelopes:

```jsonc
// init, stateful
{ "state": <StateSchema> }
// init, stateless
{ "state": {} }
```

```jsonc
// trigger
{
  "result": <ResponseSchema | anyOf[...]>,
  "events": [ <EventSchema | anyOf[...]> ],
  "state":  <StateSchema>   // present only for stateful templates
}
```

Schemas are built once in the `LLMExecutor` constructor and stored, so the object reference stays stable — this helps with Anthropic's grammar cache.

## Executor lifecycle

1. **`buildSharedContext()`** assembles the prompt context: template name/version, contract text, declared type FQNs, and the tree-shaken `.cto` files.
2. **`ask()`** calls the provider through the configured reasoner with the pre-built schema, and retries on failure.
3. **`extractJson` + `assertInitShape` / `assertTriggerShape`** parse and structurally validate the model's reply.
4. **`injectRuntimeMetadata`** inserts the Accord Project runtime fields the model shouldn't invent — `$timestamp` on `result`/events, `$identifier` on `state` — mirroring canonical Cicero engine output.

## Providers and structured outputs

`createReasoner(config)` selects the client.

| Provider | Schema enforcement | Notes |
| --- | --- | --- |
| **OpenAI** | Native — `response_format: { type: "json_schema", strict: true, … }` | Full tree-shaken schema. |
| **Anthropic** | Native — `output_config: { format: { type: "json_schema", … } }` | Full tree-shaken schema; requires a structured-output-capable model (e.g. Sonnet 4.6 / Opus 4.8 — not Sonnet 4.5). |

`usesFullSchema(config)` returns `true` for both providers — they get the strict per-type schemas, plus the reduced model files as context.