"use strict";

const { Given, When, Then } = require("@cucumber/cucumber");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Template } = require("@accordproject/cicero-core");

const {
  resolveTemplatePath,
  STATEFUL_SEQUENCE_TIMEOUT_MS,
  TEMPLATE_ARCHIVE_PROCESSOR_LIB,
  EXEC_PROVIDERS,
  JUDGE_PROVIDERS,
} = require("./config");
const { hasJudgeCredentials, buildComparisonPrompt, callJudge } = require("./judge");

const { TemplateArchiveProcessor } = require(TEMPLATE_ARCHIVE_PROCESSOR_LIB);

/**
 * Generic step definitions for stateful templates: init() plus an ordered
 * sequence of trigger() calls, replayed independently against the TypeScript
 * ("disabled") and LLM ("force") executors, then compared by an LLM judge.
 * See README.md.
 */

/** Fixture file names used when a scenario doesn't name its own. */
const DEFAULT_SAMPLE_FILE = "sample.json";
const DEFAULT_REQUESTS_FILE = "requests.json";
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
 * Reads one request fixture as a sequence: an array is a chain of sequential
 * triggers, a bare object is a one-step sequence.
 * @param {string} templatePath
 * @param {string} requestFile
 * @returns {object[]}
 */
function readRequestFile(templatePath, requestFile) {
  const p = path.join(templatePath, requestFile);
  if (!fs.existsSync(p)) {
    throw new Error(`Request file not found: ${p}`);
  }
  const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(parsed)) {
    return [parsed];
  }
  if (parsed.length === 0) {
    throw new Error(`"${requestFile}" must be a non-empty array of request objects: ${p}`);
  }
  return parsed;
}

/**
 * Reads the request sequence for a scenario that didn't name a fixture:
 * "requests.json" if present, else "request.json" as a one-step sequence.
 * @param {string} templatePath
 * @returns {object[]}
 */
function getRequests(templatePath) {
  for (const candidate of [DEFAULT_REQUESTS_FILE, DEFAULT_REQUEST_FILE]) {
    if (fs.existsSync(path.join(templatePath, candidate))) {
      return readRequestFile(templatePath, candidate);
    }
  }

  throw new Error(
    `No requests found for stateful template at ${templatePath}. Add "requests.json" ` +
      `(an array, one entry per sequential trigger, applied in order after init) or a ` +
      `single "request.json" for a one-step sequence.`
  );
}

/**
 * Artifact suffix keeping scenarios in one feature file from overwriting each
 * other. Derived from the request fixture; "requests.json" gets no suffix.
 * @param {string} requestFile
 * @returns {string|null}
 */
function resolveVariant(requestFile) {
  return requestFile === DEFAULT_REQUESTS_FILE ? null : path.basename(requestFile, ".json");
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
 * Builds a TemplateArchiveProcessor for one mode/provider against the
 * configured stateful template.
 * @param {string} templatePath
 * @param {"disabled"|"force"} mode
 * @param {string|null} [providerName]
 */
async function createProcessor(templatePath, mode, providerName = null) {
  assert.ok(templatePath, 'Run the `Given the stateful template "..."` step first');

  if (mode !== "disabled" && !EXEC_PROVIDERS[providerName]) {
    throw new Error(`Unknown provider "${providerName}". Must be one of: ${Object.keys(EXEC_PROVIDERS).join(", ")}`);
  }

  const template = await loadTemplate(templatePath);
  if (typeof template.isStateful !== "function") {
    throw new Error(
      "Template#isStateful() is not available on this Template — cannot verify the template " +
        "at " + templatePath + " is actually stateful. Update @accordproject/cicero-core."
    );
  }
  if (!template.isStateful()) {
    throw new Error(
      `Template at ${templatePath} is stateless (Template#isStateful() returned false). This ` +
        `flavor is for stateful templates — use the "Given the stateless template ..." step ` +
        `(stateless-template_steps.js) instead.`
    );
  }

  const llmConfig =
    mode === "disabled"
      ? { mode: "disabled" }
      : { mode, provider: EXEC_PROVIDERS[providerName], verbose: false };

  const processor = new TemplateArchiveProcessor(template, llmConfig);
  return processor;
}

/** Uses the template's own "sample.json" and "requests.json" / "request.json". */
Given("the stateful template {string}", function (label) {
  this.templateName = label;
  this.templatePath = resolveTemplatePath(label);
  this.sampleFile = DEFAULT_SAMPLE_FILE;
  this.outputVariant = null;
  this.requests = getRequests(this.templatePath);
});

/** Same chain, with the fixtures named in the feature file. */
Given("the stateful template {string} using sample {string} and requests {string}", function (label, sampleFile, requestsFile) {
  this.templateName = label;
  this.templatePath = resolveTemplatePath(label);
  this.sampleFile = sampleFile;
  this.outputVariant = resolveVariant(requestsFile);
  this.requests = readRequestFile(this.templatePath, requestsFile);
});

/** One-off scenario: init() plus a single trigger, off the main chain. */
Given("the stateful template {string} using sample {string} and request {string}", function (label, sampleFile, requestFile) {
  this.templateName = label;
  this.templatePath = resolveTemplatePath(label);
  this.sampleFile = sampleFile;
  this.outputVariant = resolveVariant(requestFile);
  this.requests = readRequestFile(this.templatePath, requestFile);
});

When("I initialize the TypeScript executor in disabled mode", { timeout: 60000 }, async function () {
  this.disabledProcessor = await createProcessor(this.templatePath, "disabled");
  const data = getData(this.templatePath, this.sampleFile);
  const initResponse = await this.disabledProcessor.init(data);

  this.baseline = { mode: "disabled", provider: null, data, init: initResponse, triggers: [] };
  this.baselinePriorState = initResponse.state;
});

When("I initialize the LLM executor in force mode using provider {string}", { timeout: 120000 }, async function (providerName) {
  this.forceProcessor = await createProcessor(this.templatePath, "force", providerName);
  this.forceProvider = providerName;
  const data = getData(this.templatePath, this.sampleFile);
  const initResponse = await this.forceProcessor.init(data);

  this.force = { mode: "force", provider: providerName, data, init: initResponse, triggers: [] };
  this.forcePriorState = initResponse.state;
});

When(
  "I run the TypeScript executor in disabled mode for each request in sequence",
  { timeout: STATEFUL_SEQUENCE_TIMEOUT_MS },
  async function () {
    assert.ok(this.disabledProcessor, "Initialize the TypeScript executor before triggering");

    for (const request of this.requests) {
      const response = await this.disabledProcessor.trigger(this.baseline.data, request, this.baselinePriorState);
      this.baseline.triggers.push({ request, response });
      this.baselinePriorState = response.state;
    }

    this.baselineOutFile = resolveOutFile(this.templatePath, "disabled", null, this.outputVariant);
    fs.writeFileSync(this.baselineOutFile, JSON.stringify(this.baseline, null, 2), "utf8");

    // Alias consumed by the judge Then-step below.
    this.baselineOutput = this.baseline;
  }
);

When(
  "I run the LLM executor in force mode using provider {string} for each request in sequence",
  { timeout: STATEFUL_SEQUENCE_TIMEOUT_MS },
  async function (providerName) {
    assert.ok(this.forceProcessor, "Initialize the LLM executor before triggering");
    assert.equal(
      providerName,
      this.forceProvider,
      `This step was called with provider "${providerName}" but the LLM executor was initialized ` +
        `with provider "${this.forceProvider}" — use the same provider name in both steps.`
    );

    for (const request of this.requests) {
      const response = await this.forceProcessor.trigger(this.force.data, request, this.forcePriorState);
      this.force.triggers.push({ request, response });
      this.forcePriorState = response.state;
    }

    this.forceOutFile = resolveOutFile(this.templatePath, "force", providerName, this.outputVariant);
    fs.writeFileSync(this.forceOutFile, JSON.stringify(this.force, null, 2), "utf8");

    // Alias consumed by the judge Then-step below.
    this.forceOutput = this.force;
  }
);

// The stateless suite carries its own copy of this step, worded "...the two
// outputs equivalent" — Cucumber loads both files in one run, so the step
// texts must differ. Keep the two in sync when changing judging logic.
Then("the LLM judge {string} should find the two output sequences equivalent", { timeout: 60000 }, async function (judgeProviderName) {
  const judge = JUDGE_PROVIDERS[judgeProviderName];
  assert.ok(
    judge,
    `Unknown judge provider "${judgeProviderName}". Must be one of: ${Object.keys(JUDGE_PROVIDERS).join(", ")}`
  );
  assert.ok(this.baselineOutput, "Run the TypeScript (disabled) executor step(s) before the judge step");
  assert.ok(this.forceOutput, "Run the LLM (force) executor step(s) before the judge step");

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
