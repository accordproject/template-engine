/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { LLMConfig, LLMExecutorError } from '../LLMExecutor';
import { LLMProviderAdapter } from '../LLMProviderAdapter';

type ChatCompletionResponse = {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
};

export class OpenAIAdapter implements LLMProviderAdapter {
    async completeJson(prompt: string, config: LLMConfig): Promise<string> {
        if (!config.apiKey) {
            throw new LLMExecutorError('PROVIDER_ERROR', 'Missing apiKey for OpenAI provider');
        }

        const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                temperature: config.temperature ?? 0,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Return only valid JSON object. No markdown, no prose.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new LLMExecutorError('PROVIDER_ERROR', `OpenAI API error ${response.status}: ${text}`);
        }

        const data = await response.json() as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new LLMExecutorError('PROVIDER_ERROR', 'OpenAI response missing message content');
        }

        return content;
    }
}