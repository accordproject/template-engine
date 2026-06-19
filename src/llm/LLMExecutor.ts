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

export type TriggerResponse = {
  result: object;
  state: object;
  events: object[];
};
 
export type InitResponse = {
  state: object;
};
 
// Schema helpers 
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
 * which is required by Anthropic (and safe for OpenAI).
 */
function deepResolve(
  node: any,
  definitions: Record<string, any>,
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
 
// Strips JSON-Schema keywords that strict structured-output APIs reject and
// pins the Concerto `$class` discriminator to a `const` so the model emits the
// correct fully-qualified type name.
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
 */
function resolveTypeSchema(
  definitions: Record<string, any>,
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
  definitions: Record<string, any>,
  fqns: string[]
): Record<string, unknown> | null {
  if (fqns.length === 0) return null;
  if (fqns.length === 1) return resolveTypeSchema(definitions, fqns[0]);
  return { anyOf: fqns.map(fqn => resolveTypeSchema(definitions, fqn)) };
}

/** Attach a description; only stamp `additionalProperties:false` on plain object
 *  schemas — never on an `anyOf` wrapper (its branches already carry it, and a
 *  bare `additionalProperties` alongside `anyOf` is rejected by strict mode). */
function withSchemaDescription(
  def: Record<string, unknown>,
  description: string
): Record<string, unknown> {
  if ('anyOf' in def) return { ...def, description };
  return { ...def, description, additionalProperties: false };
}

// Schema builders
function buildStateSchema(
  full: boolean,
  stateDef: Record<string, unknown> | null
): Record<string, unknown> {
  if (full && stateDef) {
    return withSchemaDescription(
      stateDef,
      'The contract state. Must match the Concerto state model.'
    );
  }
  return {
    type: 'object',
    description: 'The contract state. Must match the Concerto state model.',
    additionalProperties: false,
    properties: {},
  };
}
 
function buildResultSchema(
  full: boolean,
  resultDef: Record<string, unknown> | null
): Record<string, unknown> {
  if (full && resultDef) {
    return withSchemaDescription(
      resultDef,
      'The response object. Must match the Concerto response model.'
    );
  }
  return {
    type: 'object',
    description: 'The response object. Must match the Concerto response model.',
    additionalProperties: false,
    properties: {},
  };
}

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

function assertInitShape(value: any): asserts value is InitResponse {
  if (!value || typeof value !== 'object' || !value.state || typeof value.state !== 'object') {
    throw new Error('Invalid init response shape from LLM');
  }
}

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

// Injects Accord Project runtime metadata (`$timestamp` on result/events,
// `$identifier` on state) immediately after `$class`, mirroring canonical
// Cicero engine output. `$identifier` resolves via:
//   state.$identifier → data.$identifier → data.clauseId → data.contractId → 'state-1'
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
  
  function insertAfterClass(obj: Record<string, any>, key: string, value: string): Record<string, any> {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const entries = Object.entries(obj);
    const classIdx = entries.findIndex(([k]) => k === '$class');
    if (classIdx === -1) {
      // No $class present — prepend the metadata key at the front
      return { [key]: value, ...obj };
    }
    const result: Record<string, any> = {};
    for (let i = 0; i <= classIdx; i++) result[entries[i][0]] = entries[i][1];
    result[key] = value;
    for (let i = classIdx + 1; i < entries.length; i++) result[entries[i][0]] = entries[i][1];
    return result;
  }

 
  if (response.result && typeof response.result === 'object') {
    response.result = insertAfterClass(response.result as Record<string, any>, '$timestamp', timestamp);
  }

  if (
    response.state &&
    typeof response.state === 'object' &&
    Object.keys(response.state).length > 0
  ) {
    response.state = insertAfterClass(response.state as Record<string, any>, '$identifier', identifier);
  }

  if (Array.isArray(response.events) && response.events.length > 0) {
    response.events = response.events.map(event =>
      event && typeof event === 'object'
        ? insertAfterClass(event as Record<string, any>, '$timestamp', timestamp)
        : event
    );
  }

  return response;
}

export class LLMExecutor {
  private readonly template: Template;
  private readonly config: LLMExecutorConfig;
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

  /** The tree-shaken .cto model files (request/response/state/event + their
   *  dependencies only). Falls back to the full model for non-schema providers. */
  private readonly contextModelFiles: { name: string; content: string }[];

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
    const rootFqns = [
      ...roots.requests,
      ...roots.responses,
      ...roots.states,
      ...roots.events,
    ];

    const { definitions, modelFiles } = rootFqns.length
      ? treeShakeModel(template, rootFqns)
      : { definitions: {} as Record<string, any>, modelFiles: [] };

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
      // For native-schema providers send only the tree-shaken models; otherwise
      // fall back to the full model set.
      modelFiles:
        this.contextModelFiles.length > 0
          ? this.contextModelFiles
          : modelManager?.getModelFiles?.().map((mf: any) => ({
              name: mf.getName?.() ?? 'unknown.cto',
              content: mf.getDefinitions?.() ?? '',
            })) ?? [],
    };
  }

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