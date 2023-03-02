# Namespace org.accordproject.templatemark@1.0.0

## Overview
- 17 concepts
- 0 enumerations
- 0 assets
- 0 participants
- 0 transactions
- 0 events
- 17 total declarations

## Imports
- org.accordproject.commonmark@1.0.0.Child
- concerto.metamodel@1.0.0.Decorator
- concerto@1.0.0.Concept
- concerto@1.0.0.Asset
- concerto@1.0.0.Transaction
- concerto@1.0.0.Participant
- concerto@1.0.0.Event

## Diagram
```mermaid
classDiagram
class `org.accordproject.templatemark@1.0.0.ElementDefinition` {
<< concept>>
   + `String` `name`
   + `String` `elementType`
   + `Decorator[]` `decorators`
}

`org.accordproject.templatemark@1.0.0.ElementDefinition` "1" *-- "*" `concerto.metamodel@1.0.0.Decorator`
`org.accordproject.templatemark@1.0.0.ElementDefinition` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.templatemark@1.0.0.VariableDefinition` {
<< concept>>
   + `String` `identifiedBy`
}

`org.accordproject.templatemark@1.0.0.VariableDefinition` --|> `org.accordproject.templatemark@1.0.0.ElementDefinition`
class `org.accordproject.templatemark@1.0.0.FormattedVariableDefinition` {
<< concept>>
   + `String` `format`
}

`org.accordproject.templatemark@1.0.0.FormattedVariableDefinition` --|> `org.accordproject.templatemark@1.0.0.VariableDefinition`
class `org.accordproject.templatemark@1.0.0.EnumVariableDefinition` {
<< concept>>
   + `String[]` `enumValues`
}

`org.accordproject.templatemark@1.0.0.EnumVariableDefinition` --|> `org.accordproject.templatemark@1.0.0.VariableDefinition`
class `org.accordproject.templatemark@1.0.0.FormulaDefinition` {
<< concept>>
   + `String[]` `dependencies`
   + `String` `code`
}

`org.accordproject.templatemark@1.0.0.FormulaDefinition` --|> `org.accordproject.templatemark@1.0.0.ElementDefinition`
class `org.accordproject.templatemark@1.0.0.BlockDefinition`
<< concept>> `org.accordproject.templatemark@1.0.0.BlockDefinition`

`org.accordproject.templatemark@1.0.0.BlockDefinition` --|> `org.accordproject.templatemark@1.0.0.ElementDefinition`
class `org.accordproject.templatemark@1.0.0.ClauseDefinition`
<< concept>> `org.accordproject.templatemark@1.0.0.ClauseDefinition`

`org.accordproject.templatemark@1.0.0.ClauseDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.ContractDefinition`
<< concept>> `org.accordproject.templatemark@1.0.0.ContractDefinition`

`org.accordproject.templatemark@1.0.0.ContractDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.WithDefinition`
<< concept>> `org.accordproject.templatemark@1.0.0.WithDefinition`

`org.accordproject.templatemark@1.0.0.WithDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.ConditionalDefinition` {
<< concept>>
   + `Child[]` `whenTrue`
   + `Child[]` `whenFalse`
   + `String` `condition`
   + `String[]` `dependencies`
}

`org.accordproject.templatemark@1.0.0.ConditionalDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.ConditionalDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.ConditionalDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.OptionalDefinition` {
<< concept>>
   + `Child[]` `whenSome`
   + `Child[]` `whenNone`
}

`org.accordproject.templatemark@1.0.0.OptionalDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.OptionalDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.OptionalDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.JoinDefinition` {
<< concept>>
   + `String` `separator`
}

`org.accordproject.templatemark@1.0.0.JoinDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.ListBlockDefinition` {
<< concept>>
   + `String` `type`
   + `String` `tight`
   + `String` `start`
   + `String` `delimiter`
}

`org.accordproject.templatemark@1.0.0.ListBlockDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.ForeachBlockDefinition`
<< concept>> `org.accordproject.templatemark@1.0.0.ForeachBlockDefinition`

`org.accordproject.templatemark@1.0.0.ForeachBlockDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.WithBlockDefinition`
<< concept>> `org.accordproject.templatemark@1.0.0.WithBlockDefinition`

`org.accordproject.templatemark@1.0.0.WithBlockDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.ConditionalBlockDefinition` {
<< concept>>
   + `Child[]` `whenTrue`
   + `Child[]` `whenFalse`
}

`org.accordproject.templatemark@1.0.0.ConditionalBlockDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.ConditionalBlockDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.ConditionalBlockDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
class `org.accordproject.templatemark@1.0.0.OptionalBlockDefinition` {
<< concept>>
   + `Child[]` `whenSome`
   + `Child[]` `whenNone`
}

`org.accordproject.templatemark@1.0.0.OptionalBlockDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.OptionalBlockDefinition` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Child`
`org.accordproject.templatemark@1.0.0.OptionalBlockDefinition` --|> `org.accordproject.templatemark@1.0.0.BlockDefinition`
```

# Namespace org.accordproject.commonmark@1.0.0

## Overview
- 29 concepts
- 0 enumerations
- 0 assets
- 0 participants
- 0 transactions
- 0 events
- 29 total declarations

## Imports
- concerto@1.0.0.Concept
- concerto@1.0.0.Asset
- concerto@1.0.0.Transaction
- concerto@1.0.0.Participant
- concerto@1.0.0.Event

## Diagram
```mermaid
classDiagram
class `org.accordproject.commonmark@1.0.0.Node` {
<< concept>>
   + `String` `text`
   + `Node[]` `nodes`
   + `Integer` `startLine`
   + `Integer` `endLine`
}

`org.accordproject.commonmark@1.0.0.Node` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Node`
class `org.accordproject.commonmark@1.0.0.Root`
<< concept>> `org.accordproject.commonmark@1.0.0.Root`

`org.accordproject.commonmark@1.0.0.Root` --|> `org.accordproject.commonmark@1.0.0.Node`
class `org.accordproject.commonmark@1.0.0.Child`
<< concept>> `org.accordproject.commonmark@1.0.0.Child`

`org.accordproject.commonmark@1.0.0.Child` --|> `org.accordproject.commonmark@1.0.0.Node`
class `org.accordproject.commonmark@1.0.0.Text`
<< concept>> `org.accordproject.commonmark@1.0.0.Text`

`org.accordproject.commonmark@1.0.0.Text` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Attribute` {
<< concept>>
   + `String` `name`
   + `String` `value`
}

class `org.accordproject.commonmark@1.0.0.TagInfo` {
<< concept>>
   + `String` `tagName`
   + `String` `attributeString`
   + `Attribute[]` `attributes`
   + `String` `content`
   + `Boolean` `closed`
}

`org.accordproject.commonmark@1.0.0.TagInfo` "1" *-- "*" `org.accordproject.commonmark@1.0.0.Attribute`
class `org.accordproject.commonmark@1.0.0.CodeBlock` {
<< concept>>
   + `String` `info`
   + `TagInfo` `tag`
}

`org.accordproject.commonmark@1.0.0.CodeBlock` "1" *-- "1" `org.accordproject.commonmark@1.0.0.TagInfo`
`org.accordproject.commonmark@1.0.0.CodeBlock` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Code` {
<< concept>>
   + `String` `info`
}

`org.accordproject.commonmark@1.0.0.Code` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.HtmlInline` {
<< concept>>
   + `TagInfo` `tag`
}

`org.accordproject.commonmark@1.0.0.HtmlInline` "1" *-- "1" `org.accordproject.commonmark@1.0.0.TagInfo`
`org.accordproject.commonmark@1.0.0.HtmlInline` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.HtmlBlock` {
<< concept>>
   + `TagInfo` `tag`
}

`org.accordproject.commonmark@1.0.0.HtmlBlock` "1" *-- "1" `org.accordproject.commonmark@1.0.0.TagInfo`
`org.accordproject.commonmark@1.0.0.HtmlBlock` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Emph`
<< concept>> `org.accordproject.commonmark@1.0.0.Emph`

`org.accordproject.commonmark@1.0.0.Emph` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Strong`
<< concept>> `org.accordproject.commonmark@1.0.0.Strong`

`org.accordproject.commonmark@1.0.0.Strong` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.BlockQuote`
<< concept>> `org.accordproject.commonmark@1.0.0.BlockQuote`

`org.accordproject.commonmark@1.0.0.BlockQuote` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Heading` {
<< concept>>
   + `String` `level`
}

`org.accordproject.commonmark@1.0.0.Heading` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.ThematicBreak`
<< concept>> `org.accordproject.commonmark@1.0.0.ThematicBreak`

`org.accordproject.commonmark@1.0.0.ThematicBreak` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Softbreak`
<< concept>> `org.accordproject.commonmark@1.0.0.Softbreak`

`org.accordproject.commonmark@1.0.0.Softbreak` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Linebreak`
<< concept>> `org.accordproject.commonmark@1.0.0.Linebreak`

`org.accordproject.commonmark@1.0.0.Linebreak` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Link` {
<< concept>>
   + `String` `destination`
   + `String` `title`
}

`org.accordproject.commonmark@1.0.0.Link` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Image` {
<< concept>>
   + `String` `destination`
   + `String` `title`
}

`org.accordproject.commonmark@1.0.0.Image` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Paragraph`
<< concept>> `org.accordproject.commonmark@1.0.0.Paragraph`

`org.accordproject.commonmark@1.0.0.Paragraph` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.List` {
<< concept>>
   + `String` `type`
   + `String` `start`
   + `String` `tight`
   + `String` `delimiter`
}

`org.accordproject.commonmark@1.0.0.List` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Item`
<< concept>> `org.accordproject.commonmark@1.0.0.Item`

`org.accordproject.commonmark@1.0.0.Item` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.Document` {
<< concept>>
   + `String` `xmlns`
}

`org.accordproject.commonmark@1.0.0.Document` --|> `org.accordproject.commonmark@1.0.0.Root`
class `org.accordproject.commonmark@1.0.0.Table`
<< concept>> `org.accordproject.commonmark@1.0.0.Table`

`org.accordproject.commonmark@1.0.0.Table` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.TableHead`
<< concept>> `org.accordproject.commonmark@1.0.0.TableHead`

`org.accordproject.commonmark@1.0.0.TableHead` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.TableBody`
<< concept>> `org.accordproject.commonmark@1.0.0.TableBody`

`org.accordproject.commonmark@1.0.0.TableBody` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.TableRow`
<< concept>> `org.accordproject.commonmark@1.0.0.TableRow`

`org.accordproject.commonmark@1.0.0.TableRow` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.HeaderCell`
<< concept>> `org.accordproject.commonmark@1.0.0.HeaderCell`

`org.accordproject.commonmark@1.0.0.HeaderCell` --|> `org.accordproject.commonmark@1.0.0.Child`
class `org.accordproject.commonmark@1.0.0.TableCell`
<< concept>> `org.accordproject.commonmark@1.0.0.TableCell`

`org.accordproject.commonmark@1.0.0.TableCell` --|> `org.accordproject.commonmark@1.0.0.Child`
```

# Namespace concerto.metamodel@1.0.0

## Overview
- 45 concepts
- 0 enumerations
- 0 assets
- 0 participants
- 0 transactions
- 0 events
- 45 total declarations

## Imports
- concerto@1.0.0.Concept
- concerto@1.0.0.Asset
- concerto@1.0.0.Transaction
- concerto@1.0.0.Participant
- concerto@1.0.0.Event

## Diagram
```mermaid
classDiagram
class `concerto.metamodel@1.0.0.Position` {
<< concept>>
   + `Integer` `line`
   + `Integer` `column`
   + `Integer` `offset`
}

class `concerto.metamodel@1.0.0.Range` {
<< concept>>
   + `Position` `start`
   + `Position` `end`
   + `String` `source`
}

`concerto.metamodel@1.0.0.Range` "1" *-- "1" `concerto.metamodel@1.0.0.Position`
`concerto.metamodel@1.0.0.Range` "1" *-- "1" `concerto.metamodel@1.0.0.Position`
class `concerto.metamodel@1.0.0.TypeIdentifier` {
<< concept>>
   + `String` `name`
   + `String` `namespace`
}

class `concerto.metamodel@1.0.0.DecoratorLiteral` {
<< concept>>
   + `Range` `location`
}

`concerto.metamodel@1.0.0.DecoratorLiteral` "1" *-- "1" `concerto.metamodel@1.0.0.Range`
class `concerto.metamodel@1.0.0.DecoratorString` {
<< concept>>
   + `String` `value`
}

`concerto.metamodel@1.0.0.DecoratorString` --|> `concerto.metamodel@1.0.0.DecoratorLiteral`
class `concerto.metamodel@1.0.0.DecoratorNumber` {
<< concept>>
   + `Double` `value`
}

`concerto.metamodel@1.0.0.DecoratorNumber` --|> `concerto.metamodel@1.0.0.DecoratorLiteral`
class `concerto.metamodel@1.0.0.DecoratorBoolean` {
<< concept>>
   + `Boolean` `value`
}

`concerto.metamodel@1.0.0.DecoratorBoolean` --|> `concerto.metamodel@1.0.0.DecoratorLiteral`
class `concerto.metamodel@1.0.0.DecoratorTypeReference` {
<< concept>>
   + `TypeIdentifier` `type`
   + `Boolean` `isArray`
}

`concerto.metamodel@1.0.0.DecoratorTypeReference` "1" *-- "1" `concerto.metamodel@1.0.0.TypeIdentifier`
`concerto.metamodel@1.0.0.DecoratorTypeReference` --|> `concerto.metamodel@1.0.0.DecoratorLiteral`
class `concerto.metamodel@1.0.0.Decorator` {
<< concept>>
   + `String` `name`
   + `DecoratorLiteral[]` `arguments`
   + `Range` `location`
}

`concerto.metamodel@1.0.0.Decorator` "1" *-- "*" `concerto.metamodel@1.0.0.DecoratorLiteral`
`concerto.metamodel@1.0.0.Decorator` "1" *-- "1" `concerto.metamodel@1.0.0.Range`
class `concerto.metamodel@1.0.0.Identified`
<< concept>> `concerto.metamodel@1.0.0.Identified`

class `concerto.metamodel@1.0.0.IdentifiedBy` {
<< concept>>
   + `String` `name`
}

`concerto.metamodel@1.0.0.IdentifiedBy` --|> `concerto.metamodel@1.0.0.Identified`
class `concerto.metamodel@1.0.0.Declaration` {
<< concept>>
   + `String` `name`
   + `Decorator[]` `decorators`
   + `Range` `location`
}

`concerto.metamodel@1.0.0.Declaration` "1" *-- "*" `concerto.metamodel@1.0.0.Decorator`
`concerto.metamodel@1.0.0.Declaration` "1" *-- "1" `concerto.metamodel@1.0.0.Range`
class `concerto.metamodel@1.0.0.EnumDeclaration` {
<< concept>>
   + `EnumProperty[]` `properties`
}

`concerto.metamodel@1.0.0.EnumDeclaration` "1" *-- "*" `concerto.metamodel@1.0.0.EnumProperty`
`concerto.metamodel@1.0.0.EnumDeclaration` --|> `concerto.metamodel@1.0.0.Declaration`
class `concerto.metamodel@1.0.0.EnumProperty` {
<< concept>>
   + `String` `name`
   + `Decorator[]` `decorators`
   + `Range` `location`
}

`concerto.metamodel@1.0.0.EnumProperty` "1" *-- "*" `concerto.metamodel@1.0.0.Decorator`
`concerto.metamodel@1.0.0.EnumProperty` "1" *-- "1" `concerto.metamodel@1.0.0.Range`
class `concerto.metamodel@1.0.0.ConceptDeclaration` {
<< concept>>
   + `Boolean` `isAbstract`
   + `Identified` `identified`
   + `TypeIdentifier` `superType`
   + `Property[]` `properties`
}

`concerto.metamodel@1.0.0.ConceptDeclaration` "1" *-- "1" `concerto.metamodel@1.0.0.Identified`
`concerto.metamodel@1.0.0.ConceptDeclaration` "1" *-- "1" `concerto.metamodel@1.0.0.TypeIdentifier`
`concerto.metamodel@1.0.0.ConceptDeclaration` "1" *-- "*" `concerto.metamodel@1.0.0.Property`
`concerto.metamodel@1.0.0.ConceptDeclaration` --|> `concerto.metamodel@1.0.0.Declaration`
class `concerto.metamodel@1.0.0.AssetDeclaration`
<< concept>> `concerto.metamodel@1.0.0.AssetDeclaration`

`concerto.metamodel@1.0.0.AssetDeclaration` --|> `concerto.metamodel@1.0.0.ConceptDeclaration`
class `concerto.metamodel@1.0.0.ParticipantDeclaration`
<< concept>> `concerto.metamodel@1.0.0.ParticipantDeclaration`

`concerto.metamodel@1.0.0.ParticipantDeclaration` --|> `concerto.metamodel@1.0.0.ConceptDeclaration`
class `concerto.metamodel@1.0.0.TransactionDeclaration`
<< concept>> `concerto.metamodel@1.0.0.TransactionDeclaration`

`concerto.metamodel@1.0.0.TransactionDeclaration` --|> `concerto.metamodel@1.0.0.ConceptDeclaration`
class `concerto.metamodel@1.0.0.EventDeclaration`
<< concept>> `concerto.metamodel@1.0.0.EventDeclaration`

`concerto.metamodel@1.0.0.EventDeclaration` --|> `concerto.metamodel@1.0.0.ConceptDeclaration`
class `concerto.metamodel@1.0.0.Property` {
<< concept>>
   + `String` `name`
   + `Boolean` `isArray`
   + `Boolean` `isOptional`
   + `Decorator[]` `decorators`
   + `Range` `location`
}

`concerto.metamodel@1.0.0.Property` "1" *-- "*" `concerto.metamodel@1.0.0.Decorator`
`concerto.metamodel@1.0.0.Property` "1" *-- "1" `concerto.metamodel@1.0.0.Range`
class `concerto.metamodel@1.0.0.RelationshipProperty` {
<< concept>>
   + `TypeIdentifier` `type`
}

`concerto.metamodel@1.0.0.RelationshipProperty` "1" *-- "1" `concerto.metamodel@1.0.0.TypeIdentifier`
`concerto.metamodel@1.0.0.RelationshipProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.ObjectProperty` {
<< concept>>
   + `String` `defaultValue`
   + `TypeIdentifier` `type`
}

`concerto.metamodel@1.0.0.ObjectProperty` "1" *-- "1" `concerto.metamodel@1.0.0.TypeIdentifier`
`concerto.metamodel@1.0.0.ObjectProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.BooleanProperty` {
<< concept>>
   + `Boolean` `defaultValue`
}

`concerto.metamodel@1.0.0.BooleanProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.DateTimeProperty`
<< concept>> `concerto.metamodel@1.0.0.DateTimeProperty`

`concerto.metamodel@1.0.0.DateTimeProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.StringProperty` {
<< concept>>
   + `String` `defaultValue`
   + `StringRegexValidator` `validator`
}

`concerto.metamodel@1.0.0.StringProperty` "1" *-- "1" `concerto.metamodel@1.0.0.StringRegexValidator`
`concerto.metamodel@1.0.0.StringProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.StringRegexValidator` {
<< concept>>
   + `String` `pattern`
   + `String` `flags`
}

class `concerto.metamodel@1.0.0.DoubleProperty` {
<< concept>>
   + `Double` `defaultValue`
   + `DoubleDomainValidator` `validator`
}

`concerto.metamodel@1.0.0.DoubleProperty` "1" *-- "1" `concerto.metamodel@1.0.0.DoubleDomainValidator`
`concerto.metamodel@1.0.0.DoubleProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.DoubleDomainValidator` {
<< concept>>
   + `Double` `lower`
   + `Double` `upper`
}

class `concerto.metamodel@1.0.0.IntegerProperty` {
<< concept>>
   + `Integer` `defaultValue`
   + `IntegerDomainValidator` `validator`
}

`concerto.metamodel@1.0.0.IntegerProperty` "1" *-- "1" `concerto.metamodel@1.0.0.IntegerDomainValidator`
`concerto.metamodel@1.0.0.IntegerProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.IntegerDomainValidator` {
<< concept>>
   + `Integer` `lower`
   + `Integer` `upper`
}

class `concerto.metamodel@1.0.0.LongProperty` {
<< concept>>
   + `Long` `defaultValue`
   + `LongDomainValidator` `validator`
}

`concerto.metamodel@1.0.0.LongProperty` "1" *-- "1" `concerto.metamodel@1.0.0.LongDomainValidator`
`concerto.metamodel@1.0.0.LongProperty` --|> `concerto.metamodel@1.0.0.Property`
class `concerto.metamodel@1.0.0.LongDomainValidator` {
<< concept>>
   + `Long` `lower`
   + `Long` `upper`
}

class `concerto.metamodel@1.0.0.Import` {
<< concept>>
   + `String` `namespace`
   + `String` `uri`
}

class `concerto.metamodel@1.0.0.ImportAll`
<< concept>> `concerto.metamodel@1.0.0.ImportAll`

`concerto.metamodel@1.0.0.ImportAll` --|> `concerto.metamodel@1.0.0.Import`
class `concerto.metamodel@1.0.0.ImportType` {
<< concept>>
   + `String` `name`
}

`concerto.metamodel@1.0.0.ImportType` --|> `concerto.metamodel@1.0.0.Import`
class `concerto.metamodel@1.0.0.ImportTypes` {
<< concept>>
   + `String[]` `types`
}

`concerto.metamodel@1.0.0.ImportTypes` --|> `concerto.metamodel@1.0.0.Import`
class `concerto.metamodel@1.0.0.Model` {
<< concept>>
   + `String` `namespace`
   + `String` `sourceUri`
   + `String` `concertoVersion`
   + `Import[]` `imports`
   + `Declaration[]` `declarations`
   + `Decorator[]` `decorators`
}

`concerto.metamodel@1.0.0.Model` "1" *-- "*" `concerto.metamodel@1.0.0.Import`
`concerto.metamodel@1.0.0.Model` "1" *-- "*" `concerto.metamodel@1.0.0.Declaration`
`concerto.metamodel@1.0.0.Model` "1" *-- "*" `concerto.metamodel@1.0.0.Decorator`
class `concerto.metamodel@1.0.0.Models` {
<< concept>>
   + `Model[]` `models`
}

`concerto.metamodel@1.0.0.Models` "1" *-- "*" `concerto.metamodel@1.0.0.Model`
class `concerto.metamodel@1.0.0.ScalarDeclaration`
<< concept>> `concerto.metamodel@1.0.0.ScalarDeclaration`

`concerto.metamodel@1.0.0.ScalarDeclaration` --|> `concerto.metamodel@1.0.0.Declaration`
class `concerto.metamodel@1.0.0.BooleanScalar` {
<< concept>>
   + `Boolean` `defaultValue`
}

`concerto.metamodel@1.0.0.BooleanScalar` --|> `concerto.metamodel@1.0.0.ScalarDeclaration`
class `concerto.metamodel@1.0.0.IntegerScalar` {
<< concept>>
   + `Integer` `defaultValue`
   + `IntegerDomainValidator` `validator`
}

`concerto.metamodel@1.0.0.IntegerScalar` "1" *-- "1" `concerto.metamodel@1.0.0.IntegerDomainValidator`
`concerto.metamodel@1.0.0.IntegerScalar` --|> `concerto.metamodel@1.0.0.ScalarDeclaration`
class `concerto.metamodel@1.0.0.LongScalar` {
<< concept>>
   + `Long` `defaultValue`
   + `LongDomainValidator` `validator`
}

`concerto.metamodel@1.0.0.LongScalar` "1" *-- "1" `concerto.metamodel@1.0.0.LongDomainValidator`
`concerto.metamodel@1.0.0.LongScalar` --|> `concerto.metamodel@1.0.0.ScalarDeclaration`
class `concerto.metamodel@1.0.0.DoubleScalar` {
<< concept>>
   + `Double` `defaultValue`
   + `DoubleDomainValidator` `validator`
}

`concerto.metamodel@1.0.0.DoubleScalar` "1" *-- "1" `concerto.metamodel@1.0.0.DoubleDomainValidator`
`concerto.metamodel@1.0.0.DoubleScalar` --|> `concerto.metamodel@1.0.0.ScalarDeclaration`
class `concerto.metamodel@1.0.0.StringScalar` {
<< concept>>
   + `String` `defaultValue`
   + `StringRegexValidator` `validator`
}

`concerto.metamodel@1.0.0.StringScalar` "1" *-- "1" `concerto.metamodel@1.0.0.StringRegexValidator`
`concerto.metamodel@1.0.0.StringScalar` --|> `concerto.metamodel@1.0.0.ScalarDeclaration`
class `concerto.metamodel@1.0.0.DateTimeScalar` {
<< concept>>
   + `String` `defaultValue`
}

`concerto.metamodel@1.0.0.DateTimeScalar` --|> `concerto.metamodel@1.0.0.ScalarDeclaration`
```
