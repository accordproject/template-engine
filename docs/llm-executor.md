# LLM Executor

Runs a template's `init` / `trigger` through an LLM instead of compiled TypeScript logic — a fallback for templates with no executable logic, or a forced alternative when you want the model to infer contract behaviour.

The whole design is one idea: **give the model only this template's types, as a strict JSON Schema the provider enforces.** We get there by tree-shaking the template's Concerto model down to the request/response/state/event types and their dependencies.

## Module map

| File | Responsibility |
| --- | --- |
| [ModelManagerSchema.ts](../src/llm/ModelManagerSchema.ts) | Tree-shakes the `ModelManager` to a minimal JSON Schema `definitions` map. |
| [LLMExecutor.ts](../src/llm/LLMExecutor.ts) | Builds the `init`/`trigger` schemas, prompts the model, validates and post-processes the reply. |
| [Reasoners.ts](../src/llm/Reasoners.ts) | Provider clients behind one `complete(messages, schema)` interface. |
| [LLMConfig.ts](../src/llm/LLMConfig.ts) | Config types — provider union, per-provider effort levels. |

## Quick start

```ts
import { TemplateArchiveProcessor } from '@accordproject/template-engine';

const processor = new TemplateArchiveProcessor(template, {
  mode: 'force',                    // 'disabled' | 'fallback' | 'force'
  provider: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-opus-4-8',
    effort: 'medium',
    maxTokens: 16000,               // thinking tokens come out of this budget
    retries: 2,
    isStructuredOutputSupported: true,
  },
  verbose: true,
});

const { state } = await processor.init(data);
const { result, events, state: next } = await processor.trigger(data, request, state);
```

`mode` decides the routing in `TemplateArchiveProcessor`:

| Mode | Behaviour |
| --- | --- |
| `disabled` | Never uses the LLM; throws if the template has no logic. |
| `fallback` | TypeScript logic when `template.hasLogic()`, otherwise the LLM. |
| `force` | Always the LLM, even when compiled logic exists (used by the test suite for A/B comparison). |

Outputs are validated by Concerto (`Serializer.fromJSON`) and checked against the runtime class hierarchy after execution, whichever path produced them — the LLM gets no free pass.

**Stateless templates** (`isStateful() === false`): `init` returns `{ state: {} }` and `trigger` omits `state` from both the schema and the required keys. **Stateful templates** require `priorState` on `trigger` — `trigger()` throws if it's missing or empty, since there's no implicit empty state for a template with declared state fields.

## Tree-shaking the model

`treeShakeModel(template, roots)` returns `{ definitions }` — a JSON Schema definitions map containing only the types reachable from the roots.

```ts
const graph = new DirectedGraph();
modelManager.accept(new ConcertoGraphVisitor(), { graph, includeDerivedTypes: true });

const connected = graph.findConnectedGraph(roots);              // BFS from roots
const filtered  = modelManager.filter(d => connected.hasVertex(d.getFullyQualifiedName()));
const schema    = filtered.accept(new JSONSchemaVisitor(), {}); // { definitions }
```

Every type is a vertex; every field, supertype, relationship, map key/value and decorator reference is an edge. `includeDerivedTypes: true` adds reverse supertype → subtype edges, so keeping an abstract base keeps its concrete subtypes.

Upstream pattern: `@accordproject/concerto-codegen`, `lib/common/graph.js`.

## From definitions to a provider-safe schema

`JSONSchemaVisitor` output uses `$ref`s and Concerto-specific keywords. Three passes make each root type standalone and strict-mode-safe:

| Pass | What it does |
| --- | --- |
| `deepResolve` | Inlines every `$ref` (cycle guard emits an open object stub). Required by Anthropic, safe elsewhere. |
| `enforceAdditionalPropertiesFalse` | Stamps `additionalProperties: false` on every object. |
| `cleanForStructuredOutput` | Drops keywords strict APIs reject (`pattern`, `format`, `min*`/`max*`, `multipleOf`, `default`) and pins `$class` to an `enum` of the exact FQN, forcing the right type tag. |

Multiple responses or events combine with `anyOf` (`resolveUnionSchema`).

## Operation envelopes

```jsonc
// init
{ "state": <StateSchema> }              // stateless: state is an empty closed object

// trigger
{
  "result": <ResponseSchema | anyOf[…]>,
  "events": [ <EventSchema | anyOf[…]> ],
  "state":  <StateSchema>                // stateful only
}
```

Both are built once in the constructor and held on the instance, so the object reference stays stable across calls.

### Two schema paths

`isStructuredOutputSupported` on the provider config picks the path:

- **`true`** — the full resolved schemas go on the wire, and the provider enforces them.
- **`false`** — the wire schema is an open envelope, and the resolved request/response/state/event definitions are instead handed to the model as `context.schema` in the prompt. Best-effort, but usable with providers that have no strict mode.

## Execution flow

1. `buildSharedContext()` — template name/version, contract text, template model FQN, the declared type FQNs, and (schema-less path only) the resolved definitions.
2. `ask()` — calls `reasoner.complete(messages, schema)`, retrying `provider.retries ?? 1` times.
3. `extractJson` — parses the reply, tolerating a ```` ```json ```` fence.
4. `assertInitShape` / `assertTriggerShape` — structural checks. *(TODO: replace with Concerto deserialization.)*
5. `injectRuntimeMetadata` — stamps the fields the model must not invent: `$timestamp` on `result` and each event, `$identifier` on `state` (resolved `state.$identifier → data.$identifier → data.clauseId → data.contractId → 'state-1'`).

The timestamp is the request's own `$timestamp` when present, then `currentTime`, then now.

## Providers

`createReasoner(config)` switches on `config.provider`. All of them lazy-load their SDK on first call and throw an install hint if it's missing.

| Provider | Structured output | Effort levels | Notes |
| --- | --- | --- | --- |
| `anthropic` | `output_config.format` | `low`, `medium`, `high`, `xhigh`, `max` | Adaptive thinking on by default; `maxTokens` defaults to 16000. |
| `openai` | `response_format` | `minimal`, `low`, `medium`, `high` | Effort is reasoning models only — `gpt-4o` rejects it. |
| `groq` | `response_format` (strict) | `none`, `low`, `medium`, `high` | The only provider that still forwards `temperature` / `topP`. |
| `google` | `responseJsonSchema` | — | |
| `mistral` | `responseFormat` | — | |
| `openrouter` | `responseFormat` | — | |
| `ollama` | OpenAI-compatible | — | Defaults to `http://localhost:11434/v1`. |
| `openai-compatible` | OpenAI-compatible | — | Requires `customEndpoint`. |