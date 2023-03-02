Hello {{firstName}}{{#if condition="lastName.startsWith('S')"}}Mister{{else}}Dude{{/if}}!

Your city is: {{#with address}}{{city}}{{/with}}.

Thank you for visiting us {{% return now.diff(lastVisit,'day') %}} days ago.