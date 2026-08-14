# Cucumber test: single stateless template
A single Cucumber scenario that, for **one** stateless template:

1. Runs the **TypeScript executor** (`mode: "disabled"`).
2. Runs the **LLM-backed executor** (`mode: "force"`, via a chosen provider).
3. Asks a chosen **LLM judge** whether the two outputs are semantically
   equivalent.

## Layout
```
test/llm_executor/
  config.js                          # all paths / execution providers / judge providers
  cucumber.js                        # Cucumber.js profile config
  single-stateless-template.feature  # the Gherkin scenario
  single-stateless-template_steps.js # executor + judge logic, step defs
  reports/                           # HTML report output (generated)
```

`config.js` is the only file you should normally need to edit or set env
vars for — `single-stateless-template_steps.js` contains no
provider-specific details itself.

## Install

From the repo root:

```bash
npm install --save-dev @cucumber/cucumber
```

## Configuration

All of this lives in `config.js`, read from environment variables at
require-time. Both `EXEC_PROVIDERS` (used by the "force" executor) and
`JUDGE_PROVIDERS` (used by the judge step) are keyed by provider name —
`anthropic`, `google`, `mistral`, `openai` — so the feature file selects a
provider by name in both places, and the model actually used for each
provider is changed only in `config.js`.

| Env var | Required | Meaning |
|---|---|---|
| `TEMPLATE_PATH` | **Yes** | Path to the template directory under test, **relative to wherever you run `npx cucumber-js` from** (see "Run" below) — e.g. `../../templates/rental-deposit` if run from `test/llm_executor`. Must be the template folder itself (containing `package.json`, `sample.json`, `model/model.cto`, `logic/logic.ts`), not a parent directory of many templates. |
| `GOOGLE_API_KEY` | Only if using provider `"google"` for execution or judging | Provider key. |
| `MISTRAL_API_KEY` | Only if using provider `"mistral"` for execution or judging | Provider key. |
| `ANTHROPIC_API_KEY` | Only if using provider `"anthropic"` for execution or judging | Provider key. |
| `OPENAI_API_KEY` | Only if using provider `"openai"` for execution or judging | Provider key. |
| `EXEC_MODEL_<PROVIDER>` | No | Overrides the execution model id for that provider (e.g. `EXEC_MODEL_ANTHROPIC`). |
| `JUDGE_MODEL_<PROVIDER>` | No | Overrides the judge model id for that provider (e.g. `JUDGE_MODEL_OPENAI`). |

There is deliberately **no default** for `TEMPLATE_PATH` — this suite tests
one named template, so it must be set per run.

## Run

`npx cucumber-js` looks for `cucumber.js` in your **current working
directory**, and every path inside that config (`paths`, `require`) is also
resolved relative to your current directory — so run it from inside
`test/llm_executor`:

```bash
cd test/llm_executor
TEMPLATE_PATH=/absolute/path/to/template-engine/templates/rental-deposit \
GOOGLE_API_KEY=... \
ANTHROPIC_API_KEY=... \
npx cucumber-js
```

## Editing the scenario

`single-stateless-template.feature`:

```gherkin
Scenario: Compare the logic-only baseline against the LLM-backed output for one template
  Given the stateless template "rental-deposit"
  When I run the TypeScript executor in disabled mode
  And I run the LLM executor in force mode using provider "google"
  Then the LLM judge "anthropic" should find the two outputs equivalent
```

- The string after `Given the stateless template` is just a display label
  used in output files, attachments, and the judge prompt — the actual
  template comes from `TEMPLATE_PATH`. Change it to match whichever
  template `TEMPLATE_PATH` points at.
- The provider name after `using provider` selects an entry from
  `EXEC_PROVIDERS` in `config.js` — `"google"`, `"mistral"`, `"anthropic"`,
  or `"openai"`.
- The provider name after `the LLM judge` selects an entry from
  `JUDGE_PROVIDERS` in `config.js` the same way. If the name doesn't match a
  configured provider, the step fails immediately with the list of valid
  names.
- To change which model a provider actually uses for execution or judging,
  edit that provider's entry in `EXEC_PROVIDERS` / `JUDGE_PROVIDERS` (or set
  the matching `EXEC_MODEL_<PROVIDER>` / `JUDGE_MODEL_<PROVIDER>` env var) —
  the feature file never names a model directly.

## Output

Both executor runs still write the same files the original scripts
produced, under the template's own directory:

```
<TEMPLATE_PATH>/responses/disabled/logic_output.json
<TEMPLATE_PATH>/responses/force/<provider>-output.json
```

The judge's verdict (`equivalent`, `confidence`, `reasoning`, `differences`)
is attached to the Cucumber test report as JSON, viewable in
`reports/cucumber-report.html` after the run.
