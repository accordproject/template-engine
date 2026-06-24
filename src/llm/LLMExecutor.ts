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
import { Template } from '@accordproject/cicero-core';
import { BaseReasoner, ChatMessage, JsonSchema, createReasoner } from './Reasoners';
import { LLMExecutorConfig } from './LLMConfig';
import {
  getRootTypes,
  isStatelessTemplate,
  treeShakeModel,
} from './ModelManagerSchema';
import type { TriggerResponse, InitResponse } from '../TemplateArchiveProcessor';

/**
 * A JSON Schema `definitions` map as produced by the tree-shaker: keyed by
 * fully-qualified Concerto type name, each value is the JSON Schema fragment for
 * that type. Fragments may contain `$ref`s pointing at sibling definitions
 * (`#/definitions/<fqn>`), which `deepResolve` later inlines.
 */
type SchemaDefinitions = Record<string, Record<string, any>>;

/**
 * Recursively stamps `additionalProperties: false` onto every object schema so
 * strict structured-output providers reject unexpected keys.
 *
 * TODO: push this down into concerto-codegen's JSONSchemaVisitor as an opt-in
 * flag (e.g. `additionalPropertiesFalse`) rather than post-processing here — see
 * the tracking issue filed against accordproject/concerto-codegen.
 * @param schema - the schema node to mutate in place
 * @returns the same schema node, with `additionalProperties: false` applied
 */
function enforceAdditionalPropertiesFalse(schema: Record<string, any>): Record<string, any> {
  if (schema.type === 'object' || schema.properties) {
    schema.additionalProperties = false;
    if (schema.properties) {
      for (const val of Object.values<any>(schema.properties)) {
        enforceAdditionalPropertiesFalse(val);
      }
    }
  }
  if (schema.items) {
    enforceAdditionalPropertiesFalse(schema.items);
  }
  return schema;
}
 
/**
 * Fully resolves all $ref pointers in a schema node, recursively.
 * This produces a self-contained schema with no dangling $refs,
 */
function deepResolve(
  node: any,
  definitions: SchemaDefinitions,
  visiting = new Set<string>()  // cycle guard
): any {
  if (Array.isArray(node)) {
    return node.map(item => deepResolve(item, definitions, visiting));
  }
  if (node && typeof node === 'object') {
    if (node.$ref) {
      const refKey = (node.$ref as string).replace('#/definitions/', '');
      if (visiting.has(refKey)) {
        // Circular ref — leave as a plain object stub to avoid infinite loop
        return { type: 'object', additionalProperties: false };
      }
      const refDef = definitions[refKey];
      if (!refDef) throw new Error(`Schema definition not found: ${refKey}`);
      visiting = new Set(visiting); // clone so sibling refs aren't affected
      visiting.add(refKey);
      return deepResolve(refDef, definitions, visiting);
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      result[k] = deepResolve(v, definitions, visiting);
    }
    return result;
  }
  return node;
}
 
/**
 * JSON-Schema validation keywords that strict structured-output APIs (OpenAI,
 * Anthropic) reject; stripped from generated schemas by `cleanForStructuredOutput`.
 *
 * TODO: this keyword-stripping belongs in concerto-codegen's JSONSchemaVisitor
 * behind an opt-in flag (e.g. `omitValidators`) — see the tracking issue filed
 * against accordproject/concerto-codegen.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  'pattern',
  'format',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
]);

/**
 * Recursively strips provider-unsupported keywords (see {@link UNSUPPORTED_KEYWORDS})
 * from a schema node and pins the Concerto `$class` discriminator to a `const` of
 * its exact fully-qualified name, so the model emits the correct type tag.
 * @param node - the schema node to clean
 * @returns a cleaned copy of the node
 */
function cleanForStructuredOutput(node: any): any {
  if (Array.isArray(node)) {
    return node.map(cleanForStructuredOutput);
  }
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      if (UNSUPPORTED_KEYWORDS.has(k)) continue;
      if (k === 'default') continue; // model defaults aren't allowed in strict mode
      if (k === 'properties' && v && typeof v === 'object') {
        const props: Record<string, any> = {};
        for (const [propKey, propVal] of Object.entries(v as Record<string, any>)) {
          // Pin the Concerto type discriminator to its exact FQN.
          if (propKey === '$class' && propVal && (propVal as any).default) {
            props[propKey] = { type: 'string', const: (propVal as any).default };
          } else {
            props[propKey] = cleanForStructuredOutput(propVal);
          }
        }
        out[k] = props;
        continue;
      }
      out[k] = cleanForStructuredOutput(v);
    }
    return out;
  }
  return node;
}

/**
 * Fully resolves a single tree-shaken type into a self-contained, strict
 * JSON Schema: inlines every `$ref`, forces `additionalProperties: false`, and
 * strips provider-unsupported keywords.
 *
 * @param definitions  the tree-shaken `definitions` map (see {@link SchemaDefinitions}),
 *                      used to look up `fqn` and to inline any `$ref`s it contains.
 * @param fqn          fully-qualified Concerto type name to resolve; must be a key
 *                      of `definitions` (throws otherwise).
 * @returns a standalone JSON Schema object for `fqn` with no remaining `$ref`s,
 *          safe to embed directly in a strict structured-output request.
 */
function resolveTypeSchema(
  definitions: SchemaDefinitions,
  fqn: string
): Record<string, unknown> {
  const def = definitions[fqn];
  if (!def) throw new Error(`Type not found in tree-shaken model: ${fqn}`);
  const resolved = deepResolve(def, definitions);
  return cleanForStructuredOutput(enforceAdditionalPropertiesFalse(resolved));
}

/**
 * Resolve a set of type FQNs into a single schema: the lone type when there is
 * one, or an `anyOf` across all of them when a template has several (e.g. two
 * response types, or several event types). Returns null when the set is empty.
 */
function resolveUnionSchema(
  definitions: SchemaDefinitions,
  fqns: string[]
): Record<string, unknown> | null {
  if (fqns.length === 0) return null;
  if (fqns.length === 1) return resolveTypeSchema(definitions, fqns[0]);
  return { anyOf: fqns.map(fqn => resolveTypeSchema(definitions, fqn)) };
}

/** Attach a human-readable description to a schema node. */
function withDescription(
  def: Record<string, unknown>,
  description: string
): Record<string, unknown> {
  return { ...def, description };
}

/** Close a plain object schema to extra keys with `additionalProperties:false`.
 *  Never applied to an `anyOf` wrapper: its branches already carry the flag, and
 *  a bare `additionalProperties` alongside `anyOf` is rejected by strict mode. */
function closeObjectSchema(
  def: Record<string, unknown>
): Record<string, unknown> {
  if ('anyOf' in def) return def;
  return { ...def, additionalProperties: false };
}

// // Schema builders

/**
 * Build the JSON Schema fragment for the contract `state` property: the resolved
 * state definition for full-schema providers, or an open object otherwise.
 * @param full - whether to expand the resolved state definition
 * @param stateDef - the resolved state schema, or null when unavailable
 * @returns the `state` schema fragment
 */
function buildStateSchema(
  full: boolean,
  stateDef: Record<string, unknown> | null
): Record<string, unknown> {
  if (full && stateDef) {
    return closeObjectSchema(
      withDescription(stateDef, 'The contract state. Must match the Concerto state model.')
    );
  }
  return {
    type: 'object',
    description: 'The contract state. Must match the Concerto state model.',
    additionalProperties: false,
    properties: {},
  };
}
 
/**
 * Build the JSON Schema fragment for the trigger `result` property: the resolved
 * response definition for full-schema providers, or an open object otherwise.
 * @param full - whether to expand the resolved response definition
 * @param resultDef - the resolved response schema, or null when unavailable
 * @returns the `result` schema fragment
 */
function buildResultSchema(
  full: boolean,
  resultDef: Record<string, unknown> | null
): Record<string, unknown> {
  if (full && resultDef) {
    return closeObjectSchema(
      withDescription(resultDef, 'The response object. Must match the Concerto response model.')
    );
  }
  return {
    type: 'object',
    description: 'The response object. Must match the Concerto response model.',
    additionalProperties: false,
    properties: {},
  };
}

/**
 * Build the JSON Schema fragment for a single item of the `events` array: the
 * lone event definition, an `anyOf` across several, or an open object.
 * @param full - whether to expand the resolved event definitions
 * @param eventDefs - the resolved event schemas, or null when unavailable
 * @returns the event-item schema fragment
 */
function buildEventItemSchema(
  full: boolean,
  eventDefs: Record<string, unknown>[] | null
): Record<string, unknown> {
  if (full && eventDefs && eventDefs.length === 1) {
    return eventDefs[0];
  }
  if (full && eventDefs && eventDefs.length > 1) {
    // A template may emit more than one kind of event — each array item must
    // match one of them.
    return { anyOf: eventDefs };
  }
  return { type: 'object', additionalProperties: false, properties: {} };
}
 
/**
 * Build the full JSON Schema for an `init` response (`{ state }`).
 * @param full - whether to expand the resolved state definition
 * @param stateDef - the resolved state schema, or null when unavailable
 * @param stateless - true when the template carries no custom state
 * @returns the init-response schema
 */
function buildInitSchema(
  full: boolean,
  stateDef: Record<string, unknown> | null,
  stateless = false
): JsonSchema {
  if (stateless) {
    // Stateless templates carry no state — init always returns an empty object.
    return {
      type: 'object',
      properties: {
        state: {
          type: 'object',
          description: 'Empty state for a stateless template.',
          additionalProperties: false,
          properties: {},
        },
      },
      required: ['state'],
      additionalProperties: false,
    };
  }
  return {
    type: 'object',
    properties: {
      state: buildStateSchema(full, stateDef),
    },
    required: ['state'],
    additionalProperties: false,
  };
}
 
/**
 * Build the full JSON Schema for a `trigger` response (`{ result, events }`,
 * plus `state` for stateful templates).
 * @param full - whether to expand the resolved definitions
 * @param resultDef - the resolved response schema, or null when unavailable
 * @param stateDef - the resolved state schema, or null when unavailable
 * @param eventDefs - the resolved event schemas, or null when unavailable
 * @param stateless - true when the template carries no custom state
 * @returns the trigger-response schema
 */
function buildTriggerSchema(
  full: boolean,
  resultDef: Record<string, unknown> | null,
  stateDef: Record<string, unknown> | null,
  eventDefs: Record<string, unknown>[] | null,
  stateless = false
): JsonSchema {
  const properties: Record<string, unknown> = {
    result: buildResultSchema(full, resultDef),
    events: {
      type: 'array',
      items: buildEventItemSchema(full, eventDefs),
      description: 'Emitted events.',
    },
  };
  const required = ['result', 'events'];
 
  if (!stateless) {
    // Stateful templates must carry their updated state back in the response.
    properties.state = buildStateSchema(full, stateDef);
    required.push('state');
  }
 
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}
 
/** Returns true for providers that enforce schemas natively and need the full
 *  definition expanded from schema.json (OpenAI, Anthropic). */
function usesFullSchema(config: LLMExecutorConfig): boolean {
  return config.provider.provider === 'openai' || config.provider.provider === 'anthropic';
}
 

// Helper Functions

/**
 * Parse JSON from raw LLM output, tolerating a Markdown ```json ``` code fence.
 * @param text - the raw model output
 * @returns the parsed JSON value
 * @throws {Error} if no valid JSON can be extracted
 */
function extractJson(text: string): any {
  const raw = text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match) return JSON.parse(match[1]);
    throw new Error(`LLM did not return valid JSON. Raw output: ${text}`);
  }
}

/**
 * Assert that a parsed value has the shape of an {@link InitResponse}.
 * @param value - the value to check
 * @throws {Error} if the value is not a valid init response
 * TODO - replace these with Concerto based deserialization:
 * template.getModelManager().getSerializer().fromJSON( json ) 
 * throws error if object is not a valid Concerto instance
 */
function assertInitShape(value: any): asserts value is InitResponse {
  if (!value || typeof value !== 'object' || !value.state || typeof value.state !== 'object') {
    throw new Error('Invalid init response shape from LLM');
  }
}

/**
 * Assert that a parsed value has the shape of a {@link TriggerResponse}.
 * @param value - the value to check
 * @param stateless - true when `state` is not required (stateless template)
 * @throws {Error} if the value is not a valid trigger response
 */
function assertTriggerShape(value: any, stateless = false): asserts value is TriggerResponse {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid trigger response: not an object');
  if (!value.result || typeof value.result !== 'object')
    throw new Error('Invalid trigger response: missing result');
  if (!stateless && (!value.state || typeof value.state !== 'object'))
    throw new Error('Invalid trigger response: missing state (stateful template)');
  if (!Array.isArray(value.events))
    throw new Error('Invalid trigger response: events must be an array');
}

/**
 * Inject Accord Project runtime metadata (`$timestamp` on result/events,
 * `$identifier` on state), mirroring canonical Cicero engine output. Property
 * order is irrelevant — Concerto does not enforce it — so the fields are simply
 * assigned. `$identifier` resolves via:
 * `state.$identifier → data.$identifier → data.clauseId → data.contractId → 'state-1'`.
 * @param response - the LLM response to enrich, mutated in place
 * @param timestamp - the ISO timestamp to stamp, defaults to now
 * @param data - the contract data, used to resolve the state `$identifier`
 * @returns the same response, with metadata applied
 */
function injectRuntimeMetadata<T extends { state?: any; result?: any; events?: any[] }>(
  response: T,
  timestamp: string = new Date().toISOString(),
  data?: any
): T {
  const rawState = response.state;
  const identifier: string =
    rawState?.$identifier ||
    data?.$identifier ||
    data?.clauseId ||
    data?.contractId ||
    'state-1';

  if (response.result && typeof response.result === 'object') {
    response.result.$timestamp = timestamp;
  }

  if (
    response.state &&
    typeof response.state === 'object' &&
    Object.keys(response.state).length > 0
  ) {
    response.state.$identifier = identifier;
  }

  if (Array.isArray(response.events)) {
    for (const event of response.events) {
      if (event && typeof event === 'object') event.$timestamp = timestamp;
    }
  }

  return response;
}

/**
 * Executes an Accord Project template's `init` / `trigger` operations using an
 * LLM, deriving the request/response/state/event schemas from the template's own
 * ModelManager. Used as a fallback when a template carries no executable logic,
 * or when LLM execution is explicitly forced.
 */
export class LLMExecutor {
  /** The template being executed. */
  private readonly template: Template;
  /** The LLM provider configuration. */
  private readonly config: LLMExecutorConfig;
  /** The provider-specific reasoner used to run completions. */
  private readonly reasoner: BaseReasoner;

  /** Whether this executor's provider enforces schema natively (OpenAI / Anthropic). */
  private readonly fullSchema: boolean;

  /**
   * True when the schema defines no custom State type (only the base runtime
   * State).  Stateless templates return `{}` from init and omit `state` from
   * trigger responses entirely.
   */
  private readonly stateless: boolean;

  /** Schema instances are per-executor so the object reference is stable for
   *  Anthropic's 24-hour grammar cache (same object = cache hit).
   *  For full-schema providers the defs are derived from the template's own
   *  ModelManager via tree-shaking — no external schema.json required. */
  private readonly initSchema: JsonSchema;
  private readonly triggerSchema: JsonSchema;
  /** The tree-shaken schema definitions keyed by fully-qualified type name. */
  private readonly definitions: SchemaDefinitions;
  /** Root types discovered from the template and used to tree-shake the model. */
  private readonly roots: ReturnType<typeof getRootTypes>;

  /** The tree-shaken .cto model files (request/response/state/event + their
   *  dependencies only). Falls back to the full model for non-schema providers. */
  private readonly contextModelFiles: { name: string; content: string }[];

  /**
   * Creates an LLM executor and precomputes the init/trigger schemas.
   * @param {Template} template - the template to execute
   * @param {LLMExecutorConfig} config - the LLM provider configuration
   */
  constructor(template: Template, config: LLMExecutorConfig) {
    this.template = template;
    this.config = config;
    this.reasoner = createReasoner(config.provider);
    this.fullSchema = usesFullSchema(config);
    this.stateless  = isStatelessTemplate(template);

    // Resolve the exact request/response/state/event type names the template
    // declares (reliable — derived from the runtime base classes they extend,
    // not from their names), then tree-shake the ModelManager to just those
    // types and their dependencies. This reduced model set is sent as context
    // for ALL providers, keeping the prompt small (important for providers with
    // tight token-per-minute limits, e.g. Groq's free tier).
    const roots = getRootTypes(template);
    this.roots = roots;
    const rootFqns = [
      ...roots.requests,
      ...roots.responses,
      ...roots.states,
      ...roots.events,
    ];

    const { definitions, modelFiles } = rootFqns.length
      ? treeShakeModel(template, rootFqns)
      : { definitions: {} as Record<string, any>, modelFiles: [] };

    this.definitions = definitions;
    this.contextModelFiles = modelFiles;

    if (this.fullSchema) {
      // result/state may be a single type or an anyOf across several.
      const stateDef  = resolveUnionSchema(definitions, roots.states);
      const resultDef = resolveUnionSchema(definitions, roots.responses);
      const eventDefs = roots.events.map(fqn => resolveTypeSchema(definitions, fqn));

      this.initSchema    = buildInitSchema(true, stateDef, this.stateless);
      this.triggerSchema = buildTriggerSchema(true, resultDef, stateDef, eventDefs, this.stateless);
    } else {
      // Non-native-schema providers don't enforce a schema, but still get the
      // tree-shaken model files as context (set above).
      this.initSchema    = buildInitSchema(false, null, this.stateless);
      this.triggerSchema = buildTriggerSchema(false, null, null, null, this.stateless);
    }

    if (config.verbose) {
      console.log(
        `[LLMExecutor] provider=${config.provider.provider} fullSchema=${this.fullSchema} stateless=${this.stateless}`
      );
    }
  }

  /**
   * Assemble the context (template metadata, type names, model files) sent to
   * the LLM on every operation.
   * @returns the shared prompt context
   */
  private buildSharedContext() {
    const metadata = this.template.getMetadata?.();
    const templateModel = this.template.getTemplateModel?.();
    const modelManager = this.template.getModelManager?.();

    const requestTypes = this.template.getRequestTypes?.() ?? [];
    const responseTypes = this.template.getResponseTypes?.() ?? [];
    const stateTypes = this.template.getStateTypes?.() ?? [];
    const emitTypes = this.template.getEmitTypes?.() ?? [];

    return {
      templateName: metadata?.getName?.() ?? 'unknown-template',
      templateVersion: metadata?.getVersion?.() ?? null,
      contractText: this.template.getTemplate?.() ?? '',
      templateModelType: templateModel?.getFullyQualifiedName?.() ?? null,
      requestTypes: requestTypes.map((t: any) => t.getFullyQualifiedName?.() ?? String(t)),
      responseTypes: responseTypes.map((t: any) => t.getFullyQualifiedName?.() ?? String(t)),
      stateTypes: stateTypes.map((t: any) => t.getFullyQualifiedName?.() ?? String(t)),
      emitTypes: emitTypes.map((t: any) => t.getFullyQualifiedName?.() ?? String(t)),
      modelFiles: this.fullSchema
        ? []
        : this.contextModelFiles.length > 0
          ? this.contextModelFiles
          : modelManager?.getModelFiles?.().map((mf: any) => ({
              name: mf.getName?.() ?? 'unknown.cto',
              content: mf.getDefinitions?.() ?? '',
            })) ?? [],
          };
  }

  /**
   * Send messages to the reasoner, retrying on failure per the provider config.
   * @param messages - the chat messages to send
   * @param schema - the JSON Schema the response must satisfy
   * @returns the model response content
   * @throws the last error if every attempt fails
   */
  private async ask(
    messages: ChatMessage[],
    schema: JsonSchema
  ): Promise<{ content: string }> {
    const retries = this.config.provider.retries ?? 1;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (this.config.verbose && attempt > 0) {
          console.log(`[LLMExecutor] Retry attempt ${attempt}/${retries}`);
        }
        return await this.reasoner.complete(messages, schema);
      } catch (err) {
        lastError = err;
        if (this.config.verbose) {
          console.warn(`[LLMExecutor] attempt ${attempt} failed:`, err);
        }
      }
    }

    throw lastError;
  }

  /**
   * Compute the initial contract state via the LLM.
   * @param data - the data for the template
   * @param currentTime - the current time, defaults to now
   * @param utcOffset - the UTC offset, defaults to zero
   * @returns the new state
   */
  async init(data: any, currentTime?: string, utcOffset?: number): Promise<InitResponse> {
    if (this.config.verbose) console.log('[LLMExecutor] INIT called');

    const context = this.buildSharedContext();

    const isStatelessTemplate = this.stateless;
    const systemPrompt = isStatelessTemplate
      ? ` You are a generic Accord Project contract runtime executor.
          This template is STATELESS — it carries no persistent state between executions.

          Task:
          Return the initial (empty) state for this contract.
          `.trim()
                : `
          You are a generic Accord Project contract runtime executor.
          You will receive:
          - contract text
          - Concerto model definitions
          - template data

          Task:
          Compute the initial state of the contract.

          Rules:
          - Return ONLY valid JSON matching the supplied schema
          - No markdown, no explanation
          - Output exactly: { "state": { ... } }
          - The state must match the contract's state model
          - Preserve "$class" when inferable
          `.trim();

    const userPrompt = JSON.stringify({
      operation: 'init',
      currentTime: currentTime ?? new Date().toISOString(),
      utcOffset: utcOffset ?? 0,
      data,
      context,
    });

    const response = await this.ask(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      this.initSchema
    );

    const parsed = extractJson(response.content);
    assertInitShape(parsed);
    return injectRuntimeMetadata(parsed, currentTime ?? new Date().toISOString(), data);
  }

  /**
   * Evaluate contract behavior for a request via the LLM.
   * @param data - the data for the template
   * @param request - the request to send to the contract logic
   * @param state - the current contract state
   * @param currentTime - the current time, defaults to now
   * @param utcOffset - the UTC offset, defaults to zero
   * @returns the response, updated state, and any events
   */
  async trigger(
    data: any,
    request: any,
    state?: any,
    currentTime?: string,
    utcOffset?: number
  ): Promise<TriggerResponse> {
    if (this.config.verbose) console.log('[LLMExecutor] TRIGGER called');

    const context = this.buildSharedContext();

    const isStatelessTemplate = this.stateless;
    const systemPrompt = isStatelessTemplate
      ? ` You are a generic Accord Project contract runtime executor.
          This template is STATELESS — outputs depend only on the current request and template model.

          Task:
          Evaluate contract behavior for this request.
          `.trim()
                : `
          You are a generic Accord Project contract runtime executor.
          You will receive:
          - contract text
          - Concerto model definitions
          - template data
          - current state
          - incoming request/transaction

          Task:
          Evaluate contract behavior for this request.

          Rules:
          - Return ONLY valid JSON matching the supplied schema
          - No markdown, no explanation
          - Output exactly: { "result": { ... }, "state": { ... }, "events": [ ... ] }
          - result must match a response model
          - state must match the state model
          - events must match declared event models
          - preserve "$class" fields where appropriate
          - Runtime metadata like "$timestamp" and "$identifier" may be added by runtime
          `.trim();

    const userPrompt = JSON.stringify({
      operation: 'trigger',
      currentTime: currentTime ?? new Date().toISOString(),
      utcOffset: utcOffset ?? 0,
      data,
      request,
      state: state ?? {},
      context,
    });

    const response = await this.ask(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      this.triggerSchema
    );

    const parsed = extractJson(response.content);
    assertTriggerShape(parsed, this.stateless);
    return injectRuntimeMetadata(parsed, currentTime ?? new Date().toISOString(), data);
  }
}
