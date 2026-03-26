/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { LLMConfig } from './LLMExecutor';

export interface LLMProviderAdapter {
    completeJson(prompt: string, config: LLMConfig): Promise<string>;
}