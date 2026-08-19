# LLM executor equivalence tests

A Cucumber.js suite that runs an Accord Project template through the
**TypeScript executor** (`mode: "disabled"`) and the **LLM executor**
(`mode: "force"`), then asks an **LLM judge** whether the two outputs are
semantically equivalent.

Two flavors, depending on the template:

- **Stateless** — `draft()` + one `trigger()`.
- **Stateful** — `init()` + an ordered sequence of `trigger()` calls, replayed
  independently against each executor.

The step definitions are generic. Everything template-specific lives in your
`*.feature` files and in `config.js`.

## Layout

```
test/llm_executor/
  config.js                     # template lookup, execution providers, judge providers
  judge.js                      # judge prompt + HTTP call
  cucumber.js                   # Cucumber profile
  stateless-template_steps.js   # stateless step definitions
  stateful-template_steps.js    # stateful step definitions
  features/*.feature            # your scenarios (examples shipped here)
  reports/                      # generated HTML report
```

## Install

```bash
npm install --save-dev @cucumber/cucumber
```

## Run

`npx cucumber-js` resolves `cucumber.js` and its paths relative to the current
directory, so run it from `test/llm_executor`:

```bash
cd test/llm_executor

# Everything, against the default TEMPLATE_DIR (test/templates)
ANTHROPIC_API_KEY=... npx cucumber-js

# Narrow by tag
ANTHROPIC_API_KEY=... npx cucumber-js --tags "@stateless"
ANTHROPIC_API_KEY=... npx cucumber-js --tags "@perishable-goods"

# Point the same features at another folder of templates
TEMPLATE_DIR=../../examples ANTHROPIC_API_KEY=... npx cucumber-js --tags "@stateful"

# One feature file
ANTHROPIC_API_KEY=... npx cucumber-js features/perishable-goods.feature
```

An untagged run makes real LLM calls for every scenario, so tag your feature
files (`@stateless` / `@stateful` plus a per-template tag) to keep runs scoped.

## Configuration

`config.js` is the only file you should need to edit. `EXEC_PROVIDERS` (the
"force" executor) and `JUDGE_PROVIDERS` (the judge) are both keyed by provider
name — `anthropic`, `google`, `mistral`, `openai` — which is what feature files
select by. Models come from `EXEC_MODEL_<PROVIDER>` / `JUDGE_MODEL_<PROVIDER>`
env vars or the defaults in `config.js`; feature files never name a model.

| Env var | Required | Meaning |
|---|---|---|
| `<PROVIDER>_API_KEY` | For each provider used | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`. |
| `TEMPLATE_DIR` | No | Root that template labels resolve against. Defaults to `test/templates`. |
| `STATEFUL_SEQUENCE_TIMEOUT_MS` | No | Per-step timeout for the stateful "for each request in sequence" steps. Default `300000`. |
| `EXEC_MODEL_<PROVIDER>` | No | Model used by the force executor. |
| `JUDGE_MODEL_<PROVIDER>` | No | Model used by the judge. |
| `EXEC_EFFORT_ANTHROPIC` / `EXEC_EFFORT_OPENAI` | No | Reasoning effort. OpenAI reasoning models only. |

### Template resolution

Each scenario names its template in its `Given` step, so one run can cover
many templates:

```gherkin
Given the stateless template "copyright-license"    # $TEMPLATE_DIR/copyright-license
Given the stateful template "stateful/perishable-goods"  # $TEMPLATE_DIR/stateful/perishable-goods
```

The label is joined onto `TEMPLATE_DIR` — no fallbacks. A directory counts as a
template if it has a `package.json`; anything else is just grouping layout.

## Step vocabulary

### Stateless

| Step | Kind |
|---|---|
| `the stateless template "<label>"` | `Given` |
| `the stateless template "<label>" using sample "<file>" and request "<file>"` | `Given` |
| `I run the TypeScript executor in disabled mode` | `When` |
| `I run the LLM executor in force mode using provider "<name>"` | `When` |
| `the LLM judge "<name>" should find the two outputs equivalent` | `Then` |

### Stateful

| Step | Kind |
|---|---|
| `the stateful template "<label>"` | `Given` |
| `the stateful template "<label>" using sample "<file>" and requests "<file>"` | `Given` |
| `the stateful template "<label>" using sample "<file>" and request "<file>"` | `Given` |
| `I initialize the TypeScript executor in disabled mode` | `When` |
| `I initialize the LLM executor in force mode using provider "<name>"` | `When` |
| `I run the TypeScript executor in disabled mode for each request in sequence` | `When` |
| `I run the LLM executor in force mode using provider "<name>" for each request in sequence` | `When` |
| `the LLM judge "<name>" should find the two output sequences equivalent` | `Then` |

The two judge steps are worded differently because Cucumber loads both step
files in one run and identical step text would be ambiguous.

Each executor inits and replays the full sequence against its own state; the
two never share state. The provider named in the stateful "initialize" and
"for each request in sequence" steps must match.

## Writing feature files

Add a `*.feature` file per template under `features/`; `cucumber.js` picks up
everything matching `features/*.feature`.

Stateless:

```gherkin
@stateless @copyright-license
Feature: Copyright license — logic vs LLM executor equivalence

  Scenario: Compare the logic-only baseline against the LLM-backed output
    Given the stateless template "copyright-license"
    When I run the TypeScript executor in disabled mode
    And I run the LLM executor in force mode using provider "anthropic"
    Then the LLM judge "anthropic" should find the two outputs equivalent
```

Stateful:

```gherkin
@stateful @perishable-goods
Feature: Perishable goods — logic vs LLM executor equivalence

  Scenario: Chained payout sequence across six shipment updates
    Given the stateful template "perishable-goods" using sample "sample.json" and requests "requests.json"
    When I initialize the TypeScript executor in disabled mode
    And I initialize the LLM executor in force mode using provider "anthropic"
    And I run the TypeScript executor in disabled mode for each request in sequence
    And I run the LLM executor in force mode using provider "anthropic" for each request in sequence
    Then the LLM judge "anthropic" should find the two output sequences equivalent
```

Add as many scenarios per file as you like — e.g. a main chain plus a one-off
case using its own request fixture. `copyright-license.feature` and
`perishable-goods.feature` are worked examples.

## Fixtures

| File | Used by | Notes |
|---|---|---|
| `sample.json` | Both | Template data for `draft()` / `init()` / `trigger()`. |
| `request.json` | Both | A single request; a one-step sequence for the stateful flavor. |
| `requests.json` | Stateful | Array of requests applied in order after `init()`. Preferred over `request.json`. |

These are the fallbacks when a scenario doesn't name its fixtures; the
`using sample ... and request(s) ...` steps accept any file names.

## Output

Both flavors write under the template's own directory:

```
<template-dir>/responses/disabled/logic_output.json
<template-dir>/responses/force/<provider>-output.json
```

A scenario naming a non-default request fixture gets a suffixed copy, so it
doesn't clobber the default run:

```
<template-dir>/responses/disabled/logic_output.request-late.json
<template-dir>/responses/force/<provider>-output.request-late.json
```

The suffix comes from the request fixture only, not the sample — two scenarios
pairing the same request with different samples share artifacts, with the later
run winning.

The judge verdict (`equivalent`, `confidence`, `reasoning`, `differences`) is
attached to the Cucumber report at `reports/cucumber-report.html`.
