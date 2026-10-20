The Markdown parser ends inline optional blocks before a nested block list.
This checked-in TemplateMark AST is typed against model.cto by the fixture loader.
It covers an absent root person, absent and present people in list items, and
primitive/enum optional bindings. Expected output includes `Root: none`, an
absent item with `none`, a present item with Alice and two person-A tags,
`Scalar: root/0/0`, and `Enum: root/GREEN/GREEN`.
