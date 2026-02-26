# Optional Test

{{#clause mandate}}
> **Mandate ID:** {{mandateId}}


## Parties

{{#with payee}}{{idKey}}{{#optional pedUri}}{{pedUri.uri}}uri{{else}}No pedUri{{/optional}}{{/with}}
{{#with payee}}{{idKey}}{{#with pedUri}}uri:{{uri}}{{/with}}{{/with}}
{{#with payee}}{{#optional pedUri}}text{{/optional}}{{/with}}
{{#with payee}}{{idKey}}{{#optional pedUri}}{{uri}}uri{{else}}No pedUri{{/optional}}{{/with}}
{{#with payee}}{{idKey}}{{#optional pedUri}}{{this.uri}}uri{{else}}No pedUri{{/optional}}{{/with}}

**Payee:** 
{{#with payee}}
{{%
  if (mandate && mandate.payee && mandate.payee.pedUri) {
    return "- PED: " + mandate.payee.pedUri.uri;
  } else {
    return "";
  }
%}}{{/with}}

{{/clause}}

> A general sample that uses a range of features
### Welcome {{name}}!

![AP Logo](https://avatars.githubusercontent.com/u/29445438?s=64)

{{#clause address}}  
#### Address
> {{line1}},  
 {{city}}, {{state}},  
 {{country}}  
 {{/clause}}

- You are *{{age}}* years old
- Your monthly salary is {{salary as "0,0.00 CCC"}}
- Your favorite colours are {{#join favoriteColors}}

{{#clause order}}
## Orders
Your last order was placed {{createdAt as "D MMMM YYYY"}} ({{% return now.diff(order.createdAt, 'day')%}} days ago).

{{#ulist orderLines}}
- {{quantity}}x _{{sku}}_ @ £{{price as "0,0.00"}}
{{/ulist}}
Order total: {{% return '£' + order.orderLines.map(ol => ol.price * ol.quantity).reduce((sum, cur) => sum + cur).toFixed(2);%}}

{{/clause}}

### Verification
Checking logic for top-level optionals:
{{#optional age}}Age is provided as {{age}}{{else}}Age is hidden{{/optional}}



Thank you.
