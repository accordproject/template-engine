"use strict";

const { Given, When, Then } = require("@cucumber/cucumber");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Template } = require("@accordproject/cicero-core");

const { TEMPLATE_PATH, TEMPLATE_ARCHIVE_PROCESSOR_LIB, EXEC_PROVIDERS, JUDGE_PROVIDERS } = require("./config");

// eslint-disable-next-line import/no-dynamic-require, global-require
const { TemplateArchiveProcessor } = require(TEMPLATE_ARCHIVE_PROCESSOR_LIB);

/** @param {string} templatePath */
function getData(templatePath) {
  return JSON.parse(fs.readFileSync(path.join(templatePath, "sample.json"), "utf8"));
}

/** @param {string} templatePath */
function getRequest(templatePath) {
  const p = path.join(templatePath, "request.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

/** @param {string} templatePath */
function getModelPath(templatePath) {
  return path.join(templatePath, "model", "model.cto");
}

/**
 * @param {string} templatePath
 * @param {"disabled"|"force"} mode
 * @param {string|null} providerName
 */
function resolveOutFile(templatePath, mode, providerName) {
  const outDir = path.join(templatePath, "responses", mode);
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = mode === "disabled" ? "logic_output.json" : `${providerName}-output.json`;
  return path.join(outDir, fileName);
}

/**
 * Runs draft + trigger for one template. Mode "disabled" uses the pure
 * TypeScript logic; mode "force" routes clause execution through the given
 * EXEC_PROVIDERS entry. Writes responses/<mode>/... and returns the output.
 *
 * @param {string} templatePath - Filesystem path to the template directory (config.TEMPLATE_PATH).
 * @param {"disabled"|"force"} mode
 * @param {string|null} [providerName]
 */
async function runExecutor(templatePath, mode, providerName = null) {
  if (!templatePath) {
    throw new Error(
      "TEMPLATE_PATH is not set. Point it at the template directory to test, e.g. " +
        "TEMPLATE_PATH=/path/to/templates/rental-deposit"
    );
  }
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template path does not exist: ${templatePath}`);
  }

  let modelResolved = null;
  if (mode !== "disabled") {
    if (!EXEC_PROVIDERS[providerName]) {
      throw new Error(`Unknown provider "${providerName}". Must be one of: ${Object.keys(EXEC_PROVIDERS).join(", ")}`);
    }
    modelResolved = getModelPath(templatePath);
    if (!fs.existsSync(modelResolved)) {
      throw new Error(`model.cto not found at ${modelResolved}`);
    }
  }

  const template = await Template.fromDirectory(templatePath, { offline: true });

  const llmConfig =
    mode === "disabled"
      ? { mode: "disabled" }
      : { mode, provider: EXEC_PROVIDERS[providerName], modelPath: modelResolved, verbose: false };

  const processor = new TemplateArchiveProcessor(template, llmConfig);
  const data = getData(templatePath);
  const request = getRequest(templatePath);

  const draft = await processor.draft(data, "markdown", { verbose: false });
  const triggerResponse = await processor.trigger(data, request);

  const output = { mode, provider: mode !== "disabled" ? providerName : null, draft, triggerResponse };

  const outFile = resolveOutFile(templatePath, mode, providerName);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");

  return { outFile, output };
}

/** @param {object} judge - An entry from config.JUDGE_PROVIDERS. */
function hasJudgeCredentials(judge) {
  return Boolean(judge.apiKey);
}

/**
 * @param {string} labelA
 * @param {object} dataA
 * @param {string} labelB
 * @param {object} dataB
 */
function buildComparisonPrompt(labelA, dataA, labelB, dataB) {
  return `You are judging whether two executions of the same legal clause logic are semantically equivalent, even if wording differs.

Both executions ran the same clause text against the same request. Compare their results below.

${labelA}:
${JSON.stringify(dataA, null, 2)}

${labelB}:
${JSON.stringify(dataB, null, 2)}

Your task is to determine whether ${labelA} and ${labelB} are equivalent.

IMPORTANT: NUMERIC VALUES ARE STRICT AND CRITICAL.

Numeric correctness has absolute priority over semantic similarity.

NON-NUMERIC VALUES:

For strings, booleans, objects, arrays, and other non-numeric values, determine semantic equivalence rather than requiring identical wording.

VOLATILE FIELDS:

Ignore genuinely volatile fields such as timestamps, generated IDs, request IDs, execution IDs, or other clearly runtime-generated metadata, unless they contain meaningful business/numeric results.

FINAL DECISION:

The result MUST be:
- equivalent = false if ANY meaningful numeric field differs after rounding to 8 decimal places.
- equivalent = false if ANY required numeric field is missing or has the wrong type.
- equivalent = true only when all meaningful numeric fields match under the 8-decimal-place rule AND the remaining meaningful content is semantically equivalent.

Respond with ONLY a JSON object, no markdown fences, no preamble:

{
  "equivalent": boolean,
  "confidence": "low" | "medium" | "high",
  "reasoning": string,
  "differences": string[]
}`;
}

/** @param {string} text */
function parseJudgeJson(text) {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Judge did not return valid JSON. Raw response:\n${text}`);
  }
}

/**
 * @param {object} judge - An entry from config.JUDGE_PROVIDERS.
 * @param {string} prompt
 */
async function callJudge(judge, prompt) {
  const res = await fetch(judge.url(judge.model, judge.apiKey), {
    method: "POST",
    headers: judge.headers(judge.apiKey),
    body: JSON.stringify(judge.body(prompt, judge.model)),
  });

  if (!res.ok) {
    throw new Error(`Judge "${judge.provider}" call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return parseJudgeJson(judge.extractText(data));
}

Given("the stateless template {string}", function (label) {
  this.templateName = label;
  this.templatePath = TEMPLATE_PATH;
});

When("I run the TypeScript executor in disabled mode", { timeout: 60000 }, async function () {
  const { outFile, output } = await runExecutor(this.templatePath, "disabled");
  this.baselineOutFile = outFile;
  this.baselineOutput = output;
});

When("I run the LLM executor in force mode using provider {string}", { timeout: 120000 }, async function (providerName) {
  const { outFile, output } = await runExecutor(this.templatePath, "force", providerName);
  this.forceOutFile = outFile;
  this.forceOutput = output;
  this.forceProvider = providerName;
});

Then("the LLM judge {string} should find the two outputs equivalent", { timeout: 60000 }, async function (judgeProviderName) {
  const judge = JUDGE_PROVIDERS[judgeProviderName];
  assert.ok(
    judge,
    `Unknown judge provider "${judgeProviderName}". Must be one of: ${Object.keys(JUDGE_PROVIDERS).join(", ")}`
  );
  assert.ok(this.baselineOutput, "Run the TypeScript executor step before the judge step");
  assert.ok(this.forceOutput, "Run the LLM executor step before the judge step");

  if (!hasJudgeCredentials(judge)) {
    this.attach(
      `Skipping equivalence assertion: no API key set for judge "${judgeProviderName}" (expected env var ${judge.envKey})`,
      "text/plain"
    );
    return;
  }

  const prompt = buildComparisonPrompt(
    `${this.templateName} (disabled baseline)`,
    this.baselineOutput,
    `${this.templateName} (${this.forceProvider} force output)`,
    this.forceOutput
  );
  const verdict = await callJudge(judge, prompt);

  this.attach(JSON.stringify(verdict, null, 2), "application/json");

  assert.equal(
    verdict.equivalent,
    true,
    `Judge "${judgeProviderName}" found "${this.templateName}" disabled vs ${this.forceProvider} NOT equivalent:\n` +
      `reasoning: ${verdict.reasoning}\n` +
      `differences: ${JSON.stringify(verdict.differences, null, 2)}`
  );
});
