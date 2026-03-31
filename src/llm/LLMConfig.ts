// src/llm/LLMConfig.ts
export type LLMMode = 'disabled' | 'fallback' | 'force';

export interface LLMProviderConfig {
  provider: 'groq';
  apiKey?: string;
  model: string;
  baseUrl?: string; // default https://api.groq.com/openai/v1
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  retries?: number;
  timeoutMs?: number;
}

export interface LLMExecutorConfig {
  mode: LLMMode;
  provider: LLMProviderConfig;
  verbose?: boolean;
}