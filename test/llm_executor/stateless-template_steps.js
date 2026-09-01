"use strict";

const { Given, When, Then } = require("@cucumber/cucumber");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Template } = require("@accordproject/cicero-core");

const { resolveTemplatePath, TEMPLATE_ARCHIVE_PROCESSOR_LIB, EXEC_PROVIDERS, JUDGE_PROVIDERS } = require("./config");
const { hasJudgeCredentials, buildComparisonPrompt, callJudge } = require("./judge");

const { TemplateArchiveProcessor } = require(TEMPLATE_ARCHIVE_PROCESSOR_LIB);

/**
 * Generic step definitions for stateless templates: draft() + a single
 * trigger() run through both the TypeScript ("disabled") and LLM ("force")
 * executors, then compared by an LLM judge. See README.md.
 */

/** Fixture file names used when a scenario doesn't name its own. */
const DEFAULT_SAMPLE_FILE = "sample.json";
const DEFAULT_REQUEST_FILE = "request.json";

/** Templates are immutable once loaded, so load each directory at most once. */
const templateCache = new Map();

/** @param {string} templatePath */
async function loadTemplate(templatePath) {
  if (!templateCache.has(templatePath)) {
    templateCache.set(templatePath, await Template.fromDirectory(templatePath, { offline: true }));
  }
  return templateCache.get(templatePath);
}

/**
 * @param {string} templatePath
 * @param {string} [sampleFile]
 */
function getData(templatePath, sampleFile = DEFAULT_SAMPLE_FILE) {
  const p = path.join(templatePath, sampleFile);
  if (!fs.existsSync(p)) {
    throw new Error(`Sample file not found: ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * @param {string} templatePath
 * @param {string} [requestFile]
 * @param {boolean} [required] - true when the scenario named the file itself,
 *   so a typo fails fast instead of triggering with `{}`.
 */
function getRequest(templatePath, requestFile = DEFAULT_REQUEST_FILE, required = false) {
  const p = path.join(templatePath, requestFile);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  if (required) {
    throw new Error(`Request file not found: ${p}`);
  }
  return {};
}

/**
 * Artifact suffix keeping scenarios in one feature file from overwriting each
 * other. Derived from the request file; the default request gets no suffix.
 * @param {string} requestFile
 * @returns {string|null}
 */
function resolveVariant(requestFile) {
  return requestFile === DEFAULT_REQUEST_FILE ? null : path.basename(requestFile, ".json");
}

/**
 * @param {string} templatePath
 * @param {"disabled"|"force"} mode
 * @param {string|null} providerName
 * @param {string|null} [variant] - see resolveVariant().
 */
function resolveOutFile(templatePath, mode, providerName, variant = null) {
  const outDir = path.join(templatePath, "responses", mode);
  fs.mkdirSync(outDir, { recursive: true });
  const suffix = variant ? `.${variant}` : "";
  const fileName = mode === "disabled" ? `logic_output${suffix}.json` : `${providerName}-output${suffix}.json`;
  return path.join(outDir, fileName);
}

/**
 * Runs draft + trigger for one template and writes responses/<mode>/...
 * @param {object} world - the Cucumber world, as resolved by the `Given` step.
 * @param {"disabled"|"force"} mode
 * @param {string|null} [providerName]
 */
async function runExecutor(world, mode, providerName = null) {
  const { templatePath, sampleFile, requestFile, requestRequired, outputVariant } = world;
  assert.ok(templatePath, 'Run the `Given the stateless template "..."` step first');

  if (mode !== "disabled" && !EXEC_PROVIDERS[providerName]) {
    throw new Error(`Unknown provider "${providerName}". Must be one of: ${Object.keys(EXEC_PROVIDERS).join(", ")}`);
  }

  const template = await loadTemplate(templatePath);
  if (typeof template.isStateful !== "function") {
    throw new Error(
      "Template#isStateful() is not available on this Template — cannot verify the template " +
        "at " + templatePath + " is actually stateless. Update @accordproject/cicero-core."
    );
  }
  if (template.isStateful()) {
    throw new Error(
      `Template at ${templatePath} is stateful (Template#isStateful() returned true). This ` +
        `flavor is for stateless templates — use the "Given the stateful template ..." step ` +
        `(stateful-template_steps.js) instead.`
    );
  }

  const llmConfig =
    mode === "disabled"
      ? { mode: "disabled" }
      : { mode, provider: EXEC_PROVIDERS[providerName], verbose: false };

  const processor = new TemplateArchiveProcessor(template, llmConfig);
  const data = getData(templatePath, sampleFile);
  const request = getRequest(templatePath, requestFile, requestRequired);

  const draft = await processor.draft(data, "markdown", { verbose: false });
  const triggerResponse = await processor.trigger(data, request);

  const output = { mode, provider: mode !== "disabled" ? providerName : null, draft, triggerResponse };

  const outFile = resolveOutFile(templatePath, mode, providerName, outputVariant);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");

  return { outFile, output };
}

/** Uses the template's own "sample.json" and "request.json". */
Given("the stateless template {string}", function (label) {
  this.templateName = label;
  this.templatePath = resolveTemplatePath(label);
  this.sampleFile = DEFAULT_SAMPLE_FILE;
  this.requestFile = DEFAULT_REQUEST_FILE;
  this.requestRequired = false;
  this.outputVariant = null;
});

/** Same, with the fixtures named in the feature file. Both files must exist. */
Given("the stateless template {string} using sample {string} and request {string}", function (label, sampleFile, requestFile) {
  this.templateName = label;
  this.templatePath = resolveTemplatePath(label);
  this.sampleFile = sampleFile;
  this.requestFile = requestFile;
  this.requestRequired = true;
  this.outputVariant = resolveVariant(requestFile);
});

When("I run the TypeScript executor in disabled mode", { timeout: 60000 }, async function () {
  const { outFile, output } = await runExecutor(this, "disabled");
  this.baselineOutFile = outFile;
  this.baselineOutput = output;
});

When("I run the LLM executor in force mode using provider {string}", { timeout: 120000 }, async function (providerName) {
  const { outFile, output } = await runExecutor(this, "force", providerName);
  this.forceOutFile = outFile;
  this.forceOutput = output;
  this.forceProvider = providerName;
});

// The stateful suite carries its own copy of this step, worded "...the two
// output sequences equivalent" — Cucumber loads both files in one run, so the
// step texts must differ. Keep the two in sync when changing judging logic.
Then("the LLM judge {string} should find the two outputs equivalent", { timeout: 60000 }, async function (judgeProviderName) {
  const judge = JUDGE_PROVIDERS[judgeProviderName];
  assert.ok(
    judge,
    `Unknown judge provider "${judgeProviderName}". Must be one of: ${Object.keys(JUDGE_PROVIDERS).join(", ")}`
  );
  assert.ok(this.baselineOutput, "Run the TypeScript (disabled) executor step before the judge step");
  assert.ok(this.forceOutput, "Run the LLM (force) executor step before the judge step");

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
