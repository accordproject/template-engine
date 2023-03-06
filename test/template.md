Hello {{firstName}} {{#join middleNames separator="-"}}{{this}}{{/join}} {{#if condition="lastName.startsWith('S')"}}Mister{{else}}Dude{{/if}}!

## Middles Names
{{#olist middleNames}}
- {{this}}
{{/olist}}

{{#clause address}}
Street: {{street}}\
City: {{city}}\
ZIP: {{zip}}
{{/clause}}

Your city is: {{#with address}}{{city}}{{/with}}.

{{#if active}}Your account is active.{{else}}Your account has been deactivated.{{/if}}

Thank you for visiting us {{% return now.diff(lastVisit,'day') %}} days ago.

Your last visit was: _{{lastVisit as "DD/MM/YYYY"}}_.

## Orders

{{#olist orders}}
- {{sku}} : {{amount}}
{{/olist}}

{{#optional loyaltyStatus}}Your loyalty status: {{level}}{{else}}You do not have a loyalty status.{{/optional}}


{{#clause preferences condition="preferences.favoriteColors && preferences.favoriteColors.length > 0"}}

## Favorite Colors

{{% return preferences.favoriteColors.join() %}}

{{#olist favoriteColors}}
- {{this}}
{{/olist}}

{{#if condition="preferences.favoriteColors.includes('PINK')"}}You like PINK!{{else}}Why don't you like PINK?{{/if}}

{{/clause}}

Done.
