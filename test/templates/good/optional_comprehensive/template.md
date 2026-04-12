## Comprehensive Optional Blocks Test

### Scalar Optional Cases

1. Integer: {{#optional age}}Age is {{age}}{{else}}No age{{/optional}}
2. String: {{#optional middleName}}Middle name: {{middleName}}{{else}}No middle name{{/optional}}
3. Boolean: {{#optional active}}Status: {{active}}{{else}}Status unknown{{/optional}}

### Object Optional Cases

{{#optional address}}Address: {{street}}, {{city}}{{else}}No address provided{{/optional}}

### Nested Optional Within Optional

{{#optional person}}Person: {{name}} {{#optional age}}({{age}} years old){{/optional}}{{else}}No person{{/optional}}

### Formatted Optional

{{#optional lastVisit}}Last visit: {{lastVisit as "MMMM DD, YYYY"}}{{else}}Never visited{{/optional}}

Complete.
