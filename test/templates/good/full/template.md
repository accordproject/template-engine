# Welcome!

Hello {{firstName}} {{#join middleNames separator="-"}}{{this}}{{/join}} {{#if lastName condition="return lastName.startsWith('S')"}}Mister{{else}}Dude{{/if}}!

## Middle Names
{{#olist middleNames}}
- {{this}}
{{/olist}}

Middle names: {{#join middleNames locale="en"}}

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
Your last visit was: {{lastVisit as "MM/DD/YYYY"}}.

{{%
// test we can use typescript!
const addressBook:Map<string,string> = new Map<string,string>();
addressBook.set('123', 'Dan Selman');
addressBook.set('234', 'Isaac Selman');
addressBook.set('456', 'Tenzin Selman');
addressBook.set('789', 'Mi-a Selman');
let result = '';
addressBook.forEach((value, key) => {
   result += `[${key} : ${value}]`;
});
return result;
%}}

## Orders

{{#olist orders}}
- **{{sku}}** : *{{amount}}*
{{/olist}}

{{#optional loyaltyStatus}}Your loyalty status: {{level}}{{else}}You do not have a loyalty status.{{/optional}}

{{#clause preferences condition="return preferences.favoriteColors !== undefined && preferences.favoriteColors.length > 0"}}

## Favorite Colors

Your favorite colors are: {{% return preferences.favoriteColors !== undefined ? preferences.favoriteColors.join(' and ') : 'No favorite colors!' %}}

![](https://www.litmus.com/wp-content/uploads/2021/02/motion-tween-example.gif)

{{#olist favoriteColors}}
- {{this}}
{{/olist}}

{{#if favoriteColors condition="return preferences.favoriteColors !== undefined && preferences.favoriteColors.includes('PINK')"}}You like pink!{{else}}Why don't you like PINK!{{/if}}

{{/clause}}

## Dynamic Query of Clauses

### Onboarding Clauses

> {{% 
    return jp.query(library, `$.clauses[?(@.category=="onboarding")]`);
%}}

### Authored by {{firstName}}

> {{% 
    return jp.query(library, `$.clauses[?(@.author=="${firstName}")]`);
%}}

### High Risk

> {{% 
    return jp.query(library, `$.clauses[?(@.risk>4)]`);
%}}

### Low Risk and authored by {{firstName}}

> {{% 
    return jp.query(library, `$.clauses[?(@.risk<3 && @.author=="${firstName}")]`);
%}}

Done.
