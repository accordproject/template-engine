Hello {{firstName}} {{#join middleNames separator="-"}}{{this}}{{/join}} {{#if condition="lastName.startsWith('S')"}}Mister{{else}}Dude{{/if}}!

Your city is: {{#with address}}{{city}}{{/with}}.

Thank you for visiting us {{% return now.diff(lastVisit,'day') %}} days ago.

## Orders

{{#ulist orders}}
- {{sku}} : {{amount}}
{{/ulist}}

Done.
