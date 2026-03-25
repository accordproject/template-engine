# LLM-Based Generic Executor for TemplateArchiveProcessor

## Overview

This contribution extends the `TemplateArchiveProcessor` to support a **generic LLM-based contract logic executor**.

The goal is to enable execution of Accord Project templates **without requiring explicit TypeScript `logic.ts` files**, by delegating reasoning to a Large Language Model (LLM).

This implementation introduces:

- A fallback and force execution mode using an LLM
- A Groq-based reasoning backend
- A runtime-compatible output normalization layer
- Minimal changes to existing execution flow to preserve backward compatibility

---

## Key Features

### 1. LLM Execution Modes

The processor now supports three execution modes:

| Mode       | Behavior |
|------------|--------|
| `disabled` | Only TypeScript logic is used (default behavior) |
| `fallback` | Uses LLM only if no TypeScript logic is found |
| `force`    | Always uses LLM, ignoring TypeScript logic |

---

### 2. Generic Contract Execution via LLM

The LLM executor:

- Takes as input:
  - Contract text
  - Concerto model definitions
  - Template data
  - Current state
  - Incoming request
- Produces:
  - `result` (response object)
  - `state` (updated contract state)
  - `events` (emitted events)

This mimics the behavior of a typical `logic.ts` implementation.

---

### 3. Runtime Output Normalization

Since LLM outputs may omit runtime metadata, a normalization layer ensures compatibility with Accord runtime expectations.

The executor automatically injects:

- `$timestamp` into:
  - `result`
  - `events`
- `$identifier` into:
  - `state`

Additionally, object field ordering is standardized to match existing engine output:
# LLM-Based Generic Executor for TemplateArchiveProcessor

## Overview

This contribution extends the `TemplateArchiveProcessor` to support a **generic LLM-based contract logic executor**.

The goal is to enable execution of Accord Project templates **without requiring explicit TypeScript `logic.ts` files**, by delegating reasoning to a Large Language Model (LLM).

This implementation introduces:

- A fallback and force execution mode using an LLM
- A Groq-based reasoning backend
- A runtime-compatible output normalization layer
- Minimal changes to existing execution flow to preserve backward compatibility

---

## Key Features

### 1. LLM Execution Modes

The processor now supports three execution modes:

| Mode       | Behavior |
|------------|--------|
| `disabled` | Only TypeScript logic is used (default behavior) |
| `fallback` | Uses LLM only if no TypeScript logic is found |
| `force`    | Always uses LLM, ignoring TypeScript logic |

---

### 2. Generic Contract Execution via LLM

The LLM executor:

- Takes as input:
  - Contract text
  - Concerto model definitions
  - Template data
  - Current state
  - Incoming request
- Produces:
  - `result` (response object)
  - `state` (updated contract state)
  - `events` (emitted events)

This mimics the behavior of a typical `logic.ts` implementation.

---

### 3. Runtime Output Normalization

Since LLM outputs may omit runtime metadata, a normalization layer ensures compatibility with Accord runtime expectations.

The executor automatically injects:

- `$timestamp` into:
  - `result`
  - `events`
- `$identifier` into:
  - `state`
Additionally, object field ordering is standardized to match existing engine output ie (result, events, state)

---

### 4. Logging and Execution Visibility

Execution paths are explicitly logged:

- Execution mode (`force`, `fallback`, `disabled`)
- Selected executor:
  - TypeScript logic
  - LLM executor

This allows users to verify behavior at runtime.

---

## Architecture Changes

### TemplateArchiveProcessor

Modified to:

- Detect presence of TypeScript logic
- Route execution based on mode
- Delegate execution to:
  - TypeScript evaluator (existing)
  - LLM executor (new)

Execution flow:

```ts
if (mode === 'force') → LLM
else if (has TS logic) → TS executor
else if (fallback enabled) → LLM
else → error
```

### LLMExecutor
New component responsible for:
- Prompt construction
- Model invocation via Groq API
- JSON parsing and validation
- Output normalization

### GroqReasoner
Wrapper around Groq API used for:
- Chat completion
- Retry handling
- Configurable parameters (temperature, tokens, etc.)

## Running the Example
A sample template is provided in `late_delivery` folder:

```bash
cd late_delivery/

# Set API Key
export GROQ_API_KEY="your_api_key_here"

# Run the Example
node run.js
```
