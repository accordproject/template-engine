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

/**
 * Public surface of the LLM-backed contract execution module.
 *
 * This is the only supported entry point into `src/llm` — import from here
 * (or the package root, once re-exported there) rather than reaching into
 * individual files, which may move without a major version bump.
 */

// Configuration: provider ids, capability/effort types, and the executor's
// runtime config shape.
export type {
  LLMMode,
  GroqEffort,
  OpenAIEffort,
  AnthropicEffort,
  ReasoningEffort,
  BaseProviderConfig,
  GroqProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  GoogleProviderConfig,
  MistralProviderConfig,
  OpenRouterProviderConfig,
  OllamaProviderConfig,
  OpenAICompatibleProviderConfig,
  LLMProviderConfig,
  LLMExecutorConfig,
  ProviderCapabilities,
} from './LLMConfig';
export {
  GROQ_EFFORT_LEVELS,
  OPENAI_EFFORT_LEVELS,
  ANTHROPIC_EFFORT_LEVELS,
  PROVIDER_CAPABILITIES,
  getProviderCapabilities,
  isLLMConfigured,
} from './LLMConfig';

// Executor: drives a template's request/response/state/event cycle through a
// reasoner. `InitResponse`/`TriggerResponse` describe its return shapes and
// live on the archive processor, not here, but are re-exported for
// convenience since every executor caller needs them.
export { LLMExecutor } from './LLMExecutor';
export type { TriggerResponse, InitResponse } from '../TemplateArchiveProcessor';

// ModelManager tree-shaking: reduces a template's full Concerto model down to
// the JSON Schema for just the types reachable from a set of root types.
export { treeShakeModel } from './ModelManagerSchema';
export type { TreeShakenModel } from './ModelManagerSchema';

// Reasoners: one per provider, plus the factory that picks the right one from
// an `LLMProviderConfig`. Exported individually as well as via the factory so
// consumers embedding a custom UI (e.g. to offer a "test connection" button)
// can construct one directly without going through `createReasoner`.
export {
  BaseReasoner,
  GroqReasoner,
  OpenAIReasoner,
  AnthropicReasoner,
  OpenAICompatibleReasoner,
  OpenRouterReasoner,
  OllamaReasoner,
  OpenAICompatibleCustomReasoner,
  GoogleReasoner,
  MistralReasoner,
  createReasoner,
} from './Reasoners';
export type { ChatMessage, ReasonerResult, JsonSchema } from './Reasoners';