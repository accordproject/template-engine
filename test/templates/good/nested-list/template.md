{{#ulist entries}}
{{label}}

{{#olist tags}}
{{this}}
{{/olist}}
{{/ulist}}

{{#olist entries}}
1. {{label}}

   {{#ulist tags}}
   - {{this}}
   {{/ulist}}
{{/olist}}
