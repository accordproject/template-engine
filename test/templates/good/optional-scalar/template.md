## Scalar Optionals

1. Integer: {{#optional age}}Age is {{this}}{{else}}No age{{/optional}}
2. String: {{#optional middleName}}Middle name: {{this}}{{else}}No middle name{{/optional}}
3. Boolean: {{#optional active}}Status: {{this}}{{else}}Status unknown{{/optional}}
4. Enum: {{#optional favoriteColor}}Has a favorite color{{else}}No favorite color{{/optional}}
5. Missing enum: {{#optional secondColor}}Has a second color{{else}}No second color{{/optional}}

### Nested Optional Within Optional

{{#optional person}}Person: {{name}} {{#optional age}}({{this}} years old){{/optional}} {{#optional favoriteColor}}has a favorite color{{/optional}}{{else}}No person{{/optional}}

### Formatted Optional

{{#optional lastVisit}}Last visit: {{this as "MMMM DD, YYYY"}}{{else}}Never visited{{/optional}}

Complete.
