# Template Engine

This is the [Accord Project](https://accordproject.org) template engine. Rich-text templates are defined in TemplateMark (either as markdown files, or JSON documents) and are then merged with JSON data to produce output documents. Templates may contain [TypeScript](https://www.typescriptlang.org) expressions.

The core template engine is a JSON to JSON transformation that converts TemplateMark JSON + agreement data (JSON) to AgreementMark JSON.

> Note: Use the @accordproject/markdown-transform project to convert markdown templates to TemplateMark JSON and to convert AgreementMark JSON to output formats (HTML, PDF, DOCX etc.)

Both TemplateMark and AgreementMark are specified using the [Concerto](https://concerto.accordproject.org) data modeling language.

TemplateMark is a document object model that describes a rich-text template, with embedded variables, conditional sections, formulae etc. TemplateMark uses embedded JavaScript expressions for conditionals
and calculations.

At a high-level the template engine converts a TemplateMark DOM to an AgreementMark DOM, evaluating TypeScript expressions for conditional sections and formulae, and replaces variable references with variable values from the supplied agreement data.

## Why create a new template engine?

There are many great Open Source template engines available, such as [Mustache](https://mustache.github.io), [Handlebars](https://handlebarsjs.com) or [EJS](https://ejs.co), so why create yet another?

### 1. Logic FULL

Unlike some templating systems which prohibit, or minmize, logic in templates, Accord Project templates fully embrace templates that may contain sophisticated logic: conditional logic to determine what text to include, or even calculations, for example to calculate the monthly payments for a mortgage based on the term of the mortgage, the amount and the interest rate.

### 2. Type-safety

Given the ability for templates to contain logic there's an imperative to ensure that the templates are **safe** - i.e. when a template is merged with well-structured data it is guaranteed to produce well-structured output.

Too many templating engines fail in unpredicatble ways at runtime, or silently generate invalid output, when presented with data — unacceptable for enterprise usage.

Accord Project templates are therefore **strongly-typed**. The logic in templates is expressed in [TypeScript](https://www.typescriptlang.org). TypeScript is a strongly-typed, general purpose programming language, supported by a vibrant Open Source and enterprise community. TypeScript compiles to JavaScript for easy execution on most platforms.

### 3. Data Model

The rich-text with variables of a template is associated with a [Concerto data model](https://concerto.accordproject.org). The Concerto data model defines the structure of the data required for the template, and is used to statically compiled the template and verify type-safety, and is also used at runtime to ensure that incoming data is well structured.

### 4. Compilation

Templates may be statically compiled to TypeScript programs, enforcing type-safety, ensuring that no unsafe "eval" is required at runtime, and easing integration into applications.

> Note that templates may also be executed using an interpreter for more dynamic scenarios.

Accord Project template compilation is inspired by prior work on template compilation, not least [JSP](https://gist.github.com/sunfmin/5124605), but also work in the [Scala](https://www.playframework.com/documentation/2.1.0/ScalaTemplates), [Dart](http://blog.sethladd.com/2012/03/first-look-at-darts-html-template.html) and [Go](http://sunfmin.com/2013/03/22/a-compiled-template-for-golang.html) communities.

## Install

Note that this module is primarily intended for tool authors, or developers embedding template engines within applications. For command-line usage please refer to the `@accordproject/template-cli` package which implements a full pipeline to convert markdown templates plus JSON data to supported output formats, such as HTML, DOCX or PDF.

```
npm install @accordproject/template-engine --save
```

## License <a name="license"></a>
Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.

