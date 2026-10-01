# An agreement of three templates

Copies of the `copyright-license-agreement-poc`, `late-payment-poc` and
`licensed-work-schedule-poc` templates from accordproject/cicero-template-library,
whose models use the org.accordproject 1.0.0 namespaces (accordproject/models#205)
and whose logic is written with `@accordproject/template-engine/logic`:

- `copyright-license-agreement-poc`: a stateful document with an inline payment clause,
  into which a `late-payment-poc` clause may be composed;
- `late-payment-poc`: a stateful clause template;
- `licensed-work-schedule-poc`: a stateless document with no logic.

`logic/generated` is not kept here: the engine compiles logic against the models.
