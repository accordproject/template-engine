### Welcome {{name}}!

![AP Logo](https://avatars.githubusercontent.com/u/29445438?s=64)

{{#clause address}}  
#### Address
> {{line1}},  
 {{city}}, {{state}},  
 {{country}}  
 {{/clause}}

- You are *{{age}}* ({{age as "text"}}) years old
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

Thank you.
