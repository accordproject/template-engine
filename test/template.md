# Welcome!

Hello {{firstName}} {{#join middleNames separator="-"}}{{this}}{{/join}} {{#if lastName condition="lastName.startsWith('S')"}}Mister{{else}}Dude{{/if}}!

## Middle Names
{{#olist middleNames}}
- {{this}}
{{/olist}}

## Address
{{#clause address}}
- Street: {{street}}
- City: {{city}}
- ZIP: {{zip}}
{{/clause}}

Your city is: {{#with address}}***{{city}}***.{{/with}}

## Account Status

{{#if active}}Your account is active.{{else}}Your account has been deactivated.{{/if}}

> Thank you for visiting us **{{% return now.diff(lastVisit,'day') %}}** days ago.\
Your last visit was: <code>{{lastVisit as "DD/MM/YYYY"}}</code>.

## Orders

{{#olist orders}}
- **{{sku}}** : *{{amount}}*
{{/olist}}

{{#optional loyaltyStatus}}Your loyalty status: {{level}}{{else}}You do not have a loyalty status.{{/optional}}

{{#clause preferences condition="preferences.favoriteColors && preferences.favoriteColors.length > 0"}}

## Favorite Colors

Your favorite colors are: {{% return preferences.favoriteColors.join(' and ') %}}

![](https://www.litmus.com/wp-content/uploads/2021/02/motion-tween-example.gif)

{{#olist favoriteColors}}
- {{this}}
{{/olist}}

{{#if favoriteColors condition="preferences.favoriteColors.includes('PINK')"}}You like pink!{{else}}Why don't you like PINK!{{/if}}

{{/clause}}

Done.
