# Template logic sandbox

Status: draft. This spec is for [#228](https://github.com/accordproject/template-engine/issues/228).
The engine does not enforce it yet. Until it does, template logic is deterministic only
by convention.

Template logic must give the same result, byte for byte, on any engine and on replay.
This page lists what template logic may not use, and how an engine shows that it
enforces the list. Each rule has a conformance vector in
[`test/determinism/vectors`](../test/determinism/vectors). The
[Agreement 1.0 draft](https://docs.accordproject.org/agreement-quarter) defines the
vector format and the execution model, and leaves enforcement to this spec.

## The rule

A template handler that uses a denied global ends the execution attempt in a **Fault**.
Here, using a global means calling it, constructing it, or reading a property of it.

How an engine enforces the rule is its own choice, for example SES compartments or an
embedded interpreter. An engine may remove the binding, so that using it throws a
`ReferenceError`, or replace it with a function that throws. Either way the outcome is
a Fault. What the Fault looks like is not part of this page; until stable Fault kinds
land, a vector expects only `"result": "Fault"`.

**Fail fast.** Template logic cannot recover from a denial. If the logic catches the
error and carries on, the attempt still ends in a Fault. The vector
[`caught-denial`](../test/determinism/vectors/caught-denial.json) covers this case.
This is the default proposed in #228. How it interacts with composed clauses, whose
failures a parent can catch, is still open there.

## Denied globals

### Clocks

Time comes from the host: the `now` argument of `init` and `trigger` today, and
`inputs.now` (`self.now`) in Agreement 1.0. The engine has no clock of its own.

| Global | Vector |
| --- | --- |
| `Date.now()` | [`date-now`](../test/determinism/vectors/date-now.json) |
| `new Date()` | [`date-constructor`](../test/determinism/vectors/date-constructor.json) |
| `Date` with an argument, including parsing | [`date-parse`](../test/determinism/vectors/date-parse.json) |
| `performance.now()` | [`performance-now`](../test/determinism/vectors/performance-now.json) |
| `process.hrtime()` | [`process-hrtime`](../test/determinism/vectors/process-hrtime.json) |
| `dayjs()` | [`dayjs-now`](../test/determinism/vectors/dayjs-now.json) |
| `dayjs(instant).format()` | [`dayjs-format`](../test/determinism/vectors/dayjs-format.json) |

All of `Date` is denied, not only the calls that read the clock: its local-time methods
use the host's time zone, and its string parsing is partly implementation-defined. The
stdlib will provide instants and dates with explicit zones. `dayjs` is denied for the
same reasons: `dayjs()` reads the clock, and `format()` uses the host's time zone even
when given a fixed instant.

### Randomness

| Global | Vector |
| --- | --- |
| `Math.random()` | [`math-random`](../test/determinism/vectors/math-random.json) |
| `crypto.randomUUID()` | [`crypto-random-uuid`](../test/determinism/vectors/crypto-random-uuid.json) |
| `crypto.getRandomValues()` | [`crypto-get-random-values`](../test/determinism/vectors/crypto-get-random-values.json) |

### Timers

Handlers are synchronous in Agreement 1.0, so nothing may run after the handler returns.

| Global | Vector |
| --- | --- |
| `setTimeout`, `clearTimeout` | [`set-timeout`](../test/determinism/vectors/set-timeout.json) |
| `setInterval`, `clearInterval` | [`set-interval`](../test/determinism/vectors/set-interval.json) |
| `setImmediate`, `clearImmediate` | [`set-immediate`](../test/determinism/vectors/set-immediate.json) |

### Garbage-collector observation

| Global | Vector |
| --- | --- |
| `WeakRef` | [`weak-ref`](../test/determinism/vectors/weak-ref.json) |
| `FinalizationRegistry` | [`finalization-registry`](../test/determinism/vectors/finalization-registry.json) |

### Shared memory

| Global | Vector |
| --- | --- |
| `SharedArrayBuffer` | [`shared-array-buffer`](../test/determinism/vectors/shared-array-buffer.json) |
| `Atomics` | [`atomics`](../test/determinism/vectors/atomics.json) |

### I/O and host access

Facts come from the host in `inputs.facts`; template logic does no I/O of its own.

| Global | Vector |
| --- | --- |
| `fetch` | [`fetch`](../test/determinism/vectors/fetch.json) |
| `XMLHttpRequest` | [`xml-http-request`](../test/determinism/vectors/xml-http-request.json) |
| `process` | [`process-env`](../test/determinism/vectors/process-env.json) |

### Implementation-approximated maths

ECMA-262 lets engines approximate these functions, so results can differ in the last
bits from one engine to the next. Any that templates need will come from the stdlib, on
decimals.

| Global | Vector |
| --- | --- |
| `Math.acos` | [`math-acos`](../test/determinism/vectors/math-acos.json) |
| `Math.acosh` | [`math-acosh`](../test/determinism/vectors/math-acosh.json) |
| `Math.asin` | [`math-asin`](../test/determinism/vectors/math-asin.json) |
| `Math.asinh` | [`math-asinh`](../test/determinism/vectors/math-asinh.json) |
| `Math.atan` | [`math-atan`](../test/determinism/vectors/math-atan.json) |
| `Math.atanh` | [`math-atanh`](../test/determinism/vectors/math-atanh.json) |
| `Math.atan2` | [`math-atan2`](../test/determinism/vectors/math-atan2.json) |
| `Math.cbrt` | [`math-cbrt`](../test/determinism/vectors/math-cbrt.json) |
| `Math.cos` | [`math-cos`](../test/determinism/vectors/math-cos.json) |
| `Math.cosh` | [`math-cosh`](../test/determinism/vectors/math-cosh.json) |
| `Math.exp` | [`math-exp`](../test/determinism/vectors/math-exp.json) |
| `Math.expm1` | [`math-expm1`](../test/determinism/vectors/math-expm1.json) |
| `Math.hypot` | [`math-hypot`](../test/determinism/vectors/math-hypot.json) |
| `Math.log` | [`math-log`](../test/determinism/vectors/math-log.json) |
| `Math.log1p` | [`math-log1p`](../test/determinism/vectors/math-log1p.json) |
| `Math.log10` | [`math-log10`](../test/determinism/vectors/math-log10.json) |
| `Math.log2` | [`math-log2`](../test/determinism/vectors/math-log2.json) |
| `Math.pow` | [`math-pow`](../test/determinism/vectors/math-pow.json) |
| `Math.sin` | [`math-sin`](../test/determinism/vectors/math-sin.json) |
| `Math.sinh` | [`math-sinh`](../test/determinism/vectors/math-sinh.json) |
| `Math.tan` | [`math-tan`](../test/determinism/vectors/math-tan.json) |
| `Math.tanh` | [`math-tanh`](../test/determinism/vectors/math-tanh.json) |

The exact `Math` functions stay allowed: `abs`, `ceil`, `clz32`, `floor`, `fround`,
`imul`, `max`, `min`, `round`, `sign`, `sqrt` and `trunc`.

## Controls

These vectors use only what the spec allows. They must give the same result on every
engine, sandboxed or not.

| Case | Expected | Vector |
| --- | --- | --- |
| Arithmetic on template data | Committed | [`control-arithmetic`](../test/determinism/vectors/control-arithmetic.json) |
| Exact `Math` functions | Committed | [`control-math-exact`](../test/determinism/vectors/control-math-exact.json) |
| Time from the host's `now` | Committed | [`control-host-time`](../test/determinism/vectors/control-host-time.json) |
| An error thrown by the logic | Fault | [`control-uncaught-error`](../test/determinism/vectors/control-uncaught-error.json) |

## Vectors

The vectors follow the format in the
[Agreement 1.0 draft](https://docs.accordproject.org/agreement-quarter):

```text
test/determinism/
  archives/<template hash>/   the probe template, stored by its hash
  vectors/<id>.json           { id, semantics, archives, agreement, steps }
  vectors.test.ts             the runner for this engine
```

Step 0 instantiates the agreement (`request` is `null`). Step 1 sends a `ProbeRequest`
naming the probe, and expects `Fault` for a denied global. The template hash is
`sha256` of the canonical JSON (RFC 8785) list of `{ path, sha256 }` for each file in
the archive, sorted by path. The runner checks it, so a change to the probe template
means renaming its directory and updating the vectors.

All vectors share one probe template, whose logic maps each probe name to a single use
of a global. The vectors are plain JSON, so another engine can run them with its own
runner.

On this engine the vectors differ from the Agreement 1.0 draft in three ways, because
the 1.0 runtime is not on `main` yet:

- The agreement has no `agreementHash` or `documentHash`.
- A Committed step's `body` gives only the fields that the current
  `init` and `trigger` return (`response` and `state`), and the runner checks only
  those fields.
- The probe logic is a `TemplateLogic` class with async handlers, rather than
  `defineLogic` with synchronous ones.

### Running them

`npm test` runs the vectors with the other tests. The engine does not run logic in a
sandbox yet, so most hostile vectors are listed in `KNOWN_GAPS` in the runner. For
those, the test passes while the gap remains, and fails once the engine conforms, so
that the vector can be taken off the list. `xml-http-request` already conforms on
Node, because Node has no `XMLHttpRequest`. It would not conform in a browser.

## Not covered here

- **Fault shape.** Stable Fault kinds (`UNCAUGHT`, `DENIED`, `INVALID_STATE`, `LIMIT`)
  and the provenance envelope are tracked separately in #228.
- **Resource limits.** A `LIMIT` Fault is transient and is never recorded, so it
  does not appear in the vectors.
- **Decimals and locale formatting.** `Intl` and `toLocale*` are linted first, and are
  removed from the sandbox only in a major version.
- **Synchronous handlers.** No vector checks this until the `defineLogic` runtime is
  on `main`.
- **Formulas.** Formulas in template text run code too. This version covers logic
  handlers only.

## Open questions

- The `**` operator is approximated like `Math.pow`, but it is syntax, not a global, so
  a sandbox cannot deny it. Should lint flag it when the exponent is not an integer,
  or should the engine reject it?
- Should `eval` and the `Function` constructor be denied, or only made unable to reach
  denied globals?
- Should a denial that the logic catches always be a Fault, given that a parent clause
  may catch a child's failure (#228)?
