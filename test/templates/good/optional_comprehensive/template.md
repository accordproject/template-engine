## Comprehensive Optional Blocks Test

### Scalar Optional Cases

1. Integer: {{#optional age}}Age is {{this}}{{else}}No age{{/optional}}
2. String: {{#optional middleName}}Middle name: {{this}}{{else}}No middle name{{/optional}}
3. Boolean: {{#optional active}}Status: {{this}}{{else}}Status unknown{{/optional}}

### Object Optional Cases

{{#optional address}}Address: {{street}}, {{city}}{{else}}No address provided{{/optional}}

### Nested Optional Within Optional

{{#optional person}}Person: {{name}} {{#optional age}}({{this}} years old){{/optional}}{{else}}No person{{/optional}}

### Formatted Optional

{{#optional lastVisit}}Last visit: {{this as "MMMM DD, YYYY"}}{{else}}Never visited{{/optional}}

Complete.
