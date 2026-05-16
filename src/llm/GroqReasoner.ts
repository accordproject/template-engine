// src/llm/GroqReasoner.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqStructuredResult {
  content: string;
}

export class GroqReasoner {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly topP: number;
  private readonly reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  private readonly timeoutMs: number;

  constructor(config: {
    apiKey?: string;
    model: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
    timeoutMs?: number;
  }) {
    this.apiKey = config.apiKey || process.env.GROQ_API_KEY || '';
    this.model = config.model;
    this.baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1';
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 4096;
    this.topP = config.topP ?? 1;
    this.reasoningEffort = config.reasoningEffort;
    this.timeoutMs = config.timeoutMs ?? 60000;

    if (!this.apiKey) {
      throw new Error('Missing GROQ_API_KEY for Groq LLM executor');
    }
  }

  async complete(messages: ChatMessage[]): Promise<GroqStructuredResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        top_p: this.topP
      };

      if (this.reasoningEffort) {
        body.reasoning_effort = this.reasoningEffort;
      }

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Groq API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;

      if (!content || typeof content !== 'string') {
        throw new Error('Groq API returned no assistant content');
      }

      return { content };
    } finally {
      clearTimeout(timer);
    }
  }
}