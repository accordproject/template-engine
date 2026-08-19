"use strict";

const fs = require("fs");
const path = require("path");

/** Root directory template labels are resolved against. */
const TEMPLATE_DIR = process.env.TEMPLATE_DIR
  ? path.resolve(process.env.TEMPLATE_DIR)
  : path.join(__dirname, "..", "templates");

/** A directory is a template if it carries a package.json (vs. a grouping folder). */
function isTemplateDir(dir) {
  return fs.existsSync(path.join(dir, "package.json"));
}

/**
 * Resolves a feature file's template label to a directory under TEMPLATE_DIR.
 * @param {string} label - the label from the feature file's Given step.
 * @returns {string} absolute path to the template directory.
 */
function resolveTemplatePath(label) {
  if (!label || typeof label !== "string") {
    throw new Error(`Template label must be a non-empty string, got: ${JSON.stringify(label)}`);
  }

  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(`TEMPLATE_DIR does not exist: ${TEMPLATE_DIR}`);
  }

  const templatePath = path.join(TEMPLATE_DIR, label);
  if (!isTemplateDir(templatePath)) {
    throw new Error(
      `No template found for "${label}": ${templatePath} is not a template directory ` +
        `(no package.json). Either fix the label in the feature file's Given step, or point ` +
        `TEMPLATE_DIR (currently ${TEMPLATE_DIR}) at the folder holding the template.`
    );
  }
  return templatePath;
}

/** Per-step timeout (ms) for the stateful suite's "for each request in sequence" steps. */
const STATEFUL_SEQUENCE_TIMEOUT_MS = process.env.STATEFUL_SEQUENCE_TIMEOUT_MS
  ? Number(process.env.STATEFUL_SEQUENCE_TIMEOUT_MS)
  : 300000;

/** Path to the template archive processor library. */
const TEMPLATE_ARCHIVE_PROCESSOR_LIB =
  process.env.TEMPLATE_ARCHIVE_PROCESSOR_LIB || path.join(__dirname, "..", "..", "lib", "index");

/**
 * Execution providers for the LLM ("force") executor, keyed by the name a
 * feature file passes to `I run the LLM executor in force mode using provider "<name>"`.
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
    model: process.env.EXEC_MODEL_ANTHROPIC || "claude-opus-4-8",
    // No `temperature`: Opus 4.7+ / Sonnet 5 reject sampling parameters.
    effort: process.env.EXEC_EFFORT_ANTHROPIC || "medium",
    // Adaptive thinking is on by default and its tokens come out of maxTokens.
    maxTokens: 16000,
    retries: 2,
    timeoutMs: 60000,
    isStructuredOutputSupported: true,
  },
  openai: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.EXEC_MODEL_OPENAI || "gpt-5.6",
    effort: process.env.EXEC_EFFORT_OPENAI,
    temperature: 0,
    maxTokens: 4096,
    retries: 2,
    timeoutMs: 60000,
    isStructuredOutputSupported: true,
  },
};

/**
 * LLM judges for the judge step, keyed by the name a feature file passes to
 * `Then the LLM judge "<name>" should find ...`. Each entry carries its own
 * url/headers/body/extractText so judge.js can call any of them the same way.
 */
const JUDGE_PROVIDERS = {
  anthropic: {
    provider: "anthropic",
    model: process.env.JUDGE_MODEL_ANTHROPIC || "claude-opus-4-5",
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
  TEMPLATE_DIR,
  resolveTemplatePath,
  STATEFUL_SEQUENCE_TIMEOUT_MS,
  TEMPLATE_ARCHIVE_PROCESSOR_LIB,
  EXEC_PROVIDERS,
  JUDGE_PROVIDERS,
};
