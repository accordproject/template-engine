"use strict";

/** LLM-judge helpers shared by both step files. */

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

Both executions ran the same clause text against the same request(s). Compare their results below.

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

Ignore genuinely volatile fields such as timestamps, generated IDs, request IDs, execution IDs, event identifiers or other clearly runtime-generated metadata, unless they contain meaningful business/numeric results.

IF THE INPUTS REPRESENT A SEQUENCE (e.g. an init followed by one or more ordered triggers):

Compare the sequence step-by-step, in order. State carried from one step into the next must be consistent within each execution, and the corresponding steps across the two executions must agree under the same rules as any other field.

FINAL DECISION:

The result MUST be:
- equivalent = false if ANY meaningful numeric field differs after rounding to 8 decimal places, at any step in the sequence.
- equivalent = false if ANY required numeric field is missing or has the wrong type, at any step in the sequence.
- equivalent = true only when all meaningful numeric fields match under the 8-decimal-place rule AND the remaining meaningful content is semantically equivalent, at every step in the sequence.

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
  } catch {
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

module.exports = {
  hasJudgeCredentials,
  buildComparisonPrompt,
  parseJudgeJson,
  callJudge,
};
