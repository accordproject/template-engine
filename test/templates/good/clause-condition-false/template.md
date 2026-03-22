## Test Clause with Condition Always False

Hello {{name}}!

{{#clause address condition="return false"}}

### Your Address

{{line1}}, {{city}}, {{state}}, {{country}}
{{/clause}}

This clause should NOT be rendered because condition returns false.
