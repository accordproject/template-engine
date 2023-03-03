Hello {{firstName}} {{#join middleNames separator="-"}}{{this}}{{/join}} {{#if condition="lastName.startsWith('S')"}}Mister{{else}}Dude{{/if}}!

Your city is: {{#with address}}{{city}}{{/with}}.

{{#if active}}Your account is active.{{else}}Your account has been deactivated.{{/if}}

Thank you for visiting us {{% return now.diff(lastVisit,'day') %}} days ago.

Your last visit was: _{{lastVisit as "DD/MM/YYYY"}}_.

## Orders

{{#ulist orders}}
- {{sku}} : {{amount}}
{{/ulist}}

{{#optional loyaltyStatus}}Your loyalty status: {{level}}{{else}}You do not have a loyalty status.{{/optional}}

Done.
