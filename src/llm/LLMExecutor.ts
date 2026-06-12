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
 
let _schemaCache: { definitions: Record<string, any> } | null = null;
let _schemaPath = ''; // empty = not set yet
 
/**
 * Set the path to schema.json before constructing any LLMExecutor.
 * Accepts an absolute path or a path relative to process.cwd().
 *
 * @example
 *   setSchemaPath('./schema.json');              // next to run.js
 *   setSchemaPath('/abs/path/to/schema.json');   // absolute
 */
export function setSchemaPath(p: string): void {
  _schemaPath = p;
  _schemaCache = null; // invalidate cache so next getSchema() re-loads
}
 
function getSchema(): { definitions: Record<string, any> } {
  if (_schemaCache) return _schemaCache;
 
  if (!_schemaPath) {
    throw new Error(
      '[LLMExecutor] No schema path configured. ' +
      'Call setSchemaPath("/path/to/schema.json") before using LLMExecutor.'
    );
  }
 
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('path') as typeof import('path');
  const resolved = nodePath.isAbsolute(_schemaPath)
    ? _schemaPath
    : nodePath.resolve(process.cwd(), _schemaPath);
 
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  _schemaCache = require(resolved) as { definitions: Record<string, any> };
  return _schemaCache;
}
 
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
 
function resolveDefinition(key: string): Record<string, unknown> {
  const definitions = getSchema().definitions as Record<string, any>;
  const def = definitions[key];
  if (!def) throw new Error(`Schema definition not found: ${key}`);
  const resolved = deepResolve(def, definitions);
  return enforceAdditionalPropertiesFalse(resolved);
}
 
/**
 * Picks the first matching key from the definitions map whose name ends with
 * one of the supplied suffixes (e.g. "State", "Response", "Event").
 * When `excludeRuntimeBase` is true, keys that are the bare Accord Project
 * runtime base class (org.accordproject.runtime@<version>.<Suffix>) are
 * skipped — they carry no useful schema shape.
 */
function findDefinitionBySuffix(suffix: string, excludeRuntimeBase = false): Record<string, unknown> | null {
  const definitions = getSchema().definitions as Record<string, any>;
  const runtimeBaseRe = /^org\.accordproject\.runtime@[\d.]+\./;
  const key = Object.keys(definitions).find(
    k => k.endsWith(suffix) && !(excludeRuntimeBase && runtimeBaseRe.test(k))
  );
  return key ? resolveDefinition(key) : null;
}
 
/**
 * Returns true when the schema defines NO custom State type beyond the base
 * `org.accordproject.runtime@*.State`.  A stateless template has no state
 * to initialise or carry across calls — init returns `{}` and trigger omits
 * the `state` key entirely.
 *
 * Detection rule: scan `definitions` for any key that ends with "State" but
 * is NOT the bare runtime base class (`org.accordproject.runtime@*.State`).
 * If none exists the template is stateless.
 */
function isStateless(): boolean {
  const definitions = getSchema().definitions as Record<string, any>;
  const customState = Object.keys(definitions).find(
    k =>
      k.endsWith('State') &&
      !/^org\.accordproject\.runtime@[\d.]+\.State$/.test(k)
  );
  return !customState;
}
 
// Schema builders 
function buildStateSchema(
  full: boolean,
  stateDef: Record<string, unknown> | null
): Record<string, unknown> {
  if (full && stateDef) {
    return {
      ...stateDef,
      description: 'The contract state. Must match the Concerto state model.',
      additionalProperties: false,
    };
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
    return {
      ...resultDef,
      description: 'The response object. Must match the Concerto response model.',
      additionalProperties: false,
    };
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
  eventDef: Record<string, unknown> | null
): Record<string, unknown> {
  if (full && eventDef) {
    return { ...eventDef, additionalProperties: false };
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
  eventDef: Record<string, unknown> | null,
  stateless = false
): JsonSchema {
  const properties: Record<string, unknown> = {
    result: buildResultSchema(full, resultDef),
    events: {
      type: 'array',
      items: buildEventItemSchema(full, eventDef),
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

/**
 * Injects Accord Project runtime metadata fields (`$timestamp`, `$identifier`)
 * into the parsed LLM response object **in-place**, returning the same object.
 *
 * Placement rules (mirrors canonical Cicero engine output):
 * - `result`          → `$timestamp` inserted immediately after `$class`
 * - `state`           → `$identifier` inserted immediately after `$class`
 *                       (only when the template is stateful and state has a
 *                       `$class` field; skipped for stateless `{}` states)
 * - each item in `events` (non-empty array only)
 *                     → `$timestamp` inserted immediately after `$class`
 *
 * @param response   The parsed init or trigger response object to mutate.
 * @param timestamp  ISO-8601 string to use as `$timestamp`; defaults to now.
 * @param data       The original contract data object passed to init/trigger.
 *                   Used to resolve `$identifier` for state objects via the
 *                   priority chain:
 *                     state.$identifier → data.$identifier →
 *                     data.clauseId → data.contractId → 'state-1'
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
   *  For full-schema providers the defs are resolved here (after setSchemaPath
   *  has been called), so getSchema() is safe to call at this point. */
  private readonly initSchema: JsonSchema;
  private readonly triggerSchema: JsonSchema;

  constructor(template: Template, config: LLMExecutorConfig) {
    this.template = template;
    this.config = config;
    this.reasoner = createReasoner(config.provider);
    this.fullSchema = usesFullSchema(config);
    this.stateless  = isStateless();

    if (this.fullSchema) {
      // Resolve defs now — setSchemaPath() must have been called by the caller
      // before constructing this executor.
      const stateDef  = findDefinitionBySuffix('State');
      const resultDef = findDefinitionBySuffix('Response');
      const eventDef  = findDefinitionBySuffix('Event');
      this.initSchema    = buildInitSchema(true, stateDef, this.stateless);
      this.triggerSchema = buildTriggerSchema(true, resultDef, stateDef, eventDef, this.stateless);
    } else {
      // Non-native-schema providers: build per-executor so stateless flag applies.
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
      modelFiles:
        modelManager?.getModelFiles?.().map((mf: any) => ({
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