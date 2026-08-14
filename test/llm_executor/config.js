"use strict";

const path = require("path");

/** Path to the template directory under test (set per run, no default). */
const TEMPLATE_PATH = process.env.TEMPLATE_PATH ? path.resolve(process.env.TEMPLATE_PATH) : null;

/** Path to the template archive processor library. */
const TEMPLATE_ARCHIVE_PROCESSOR_LIB =
  process.env.TEMPLATE_ARCHIVE_PROCESSOR_LIB || path.join(__dirname, "..", "..", "lib", "index");

/**
 * Execution providers usable by the LLM ("force") executor, keyed by
 * provider name. The name is what the feature file passes to
 * `I run the LLM executor in force mode using provider "<name>"`.
 */
const EXEC_PROVIDERS = {
  mistral: {
    provider: "mistral",
    apiKey: process.env.MISTRAL_API_KEY,
    model: process.env.EXEC_MODEL_MISTRAL || "mistral-large-latest",
    temperature: 0,
    maxTokens: 4096,
    retries: 2,
    timeoutMs: 60000,
    isStructuredOutputSupported: true,
  },
  google: {
    provider: "google",
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.EXEC_MODEL_GOOGLE || "gemini-2.5-flash",
    temperature: 0,
    maxTokens: 4096,
    retries: 2,
    timeoutMs: 60000,
    isStructuredOutputSupported: true,
  },
  anthropic: {
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.EXEC_MODEL_ANTHROPIC || "claude-sonnet-4-6",
    temperature: 0,
    maxTokens: 4096,
    retries: 2,
    timeoutMs: 60000,
    isStructuredOutputSupported: true,
  },
  openai: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.EXEC_MODEL_OPENAI || "gpt-4o",
    temperature: 0,
    maxTokens: 4096,
    retries: 2,
    timeoutMs: 60000,
    isStructuredOutputSupported: true,
  },
};

/**
 * LLM judges usable by the judge step, keyed by provider name. The name is
 * what the feature file passes to
 * `Then the LLM judge "<name>" should find the two outputs equivalent`.
 *
 * Each entry carries its own request/response shape so
 * `single-stateless-template_steps.js` can call any of them the same way:
 *   url(model, apiKey)   -> request URL
 *   headers(apiKey)      -> request headers
 *   body(prompt, model)  -> request body
 *   extractText(data)    -> judge's text response, parsed from the JSON body
 */
const JUDGE_PROVIDERS = {
  anthropic: {
    provider: "anthropic",
    model: process.env.JUDGE_MODEL_ANTHROPIC || "claude-sonnet-4-5",
    envKey: "ANTHROPIC_API_KEY",
    apiKey: process.env.ANTHROPIC_API_KEY,
    url: () => "https://api.anthropic.com/v1/messages",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
    body: (prompt, model) => ({
      model,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
    extractText: (data) =>
      (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n"),
  },
  openai: {
    provider: "openai",
    model: process.env.JUDGE_MODEL_OPENAI || "gpt-4o",
    envKey: "OPENAI_API_KEY",
    apiKey: process.env.OPENAI_API_KEY,
    url: () => "https://api.openai.com/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    body: (prompt, model) => ({
      model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
    extractText: (data) => data.choices?.[0]?.message?.content ?? "",
  },
  mistral: {
    provider: "mistral",
    model: process.env.JUDGE_MODEL_MISTRAL || "mistral-large-latest",
    envKey: "MISTRAL_API_KEY",
    apiKey: process.env.MISTRAL_API_KEY,
    url: () => "https://api.mistral.ai/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    body: (prompt, model) => ({
      model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
    extractText: (data) => data.choices?.[0]?.message?.content ?? "",
  },
  google: {
    provider: "google",
    model: process.env.JUDGE_MODEL_GOOGLE || "gemini-2.5-flash",
    envKey: "GOOGLE_API_KEY",
    apiKey: process.env.GOOGLE_API_KEY,
    url: (model, apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    headers: () => ({ "Content-Type": "application/json" }),
    body: (prompt) => ({
      contents: [{ parts: [{ text: prompt }] }],
    }),
    extractText: (data) => (data.candidates ?? [])[0]?.content?.parts?.map((p) => p.text).join("\n") ?? "",
  },
};

module.exports = {
  TEMPLATE_PATH,
  TEMPLATE_ARCHIVE_PROCESSOR_LIB,
  EXEC_PROVIDERS,
  JUDGE_PROVIDERS,
};
