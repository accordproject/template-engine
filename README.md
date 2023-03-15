# Template Engine

This is the core Accord Project template engine. The template engine is a JSON to JSON transformation 
that converts TemplateMark JSON + agreement data (JSON) to AgreementMark JSON.

Both TemplateMark and AgreementMark are specified using the [Concerto](https://concerto.accordproject.org) data modelling language.

TemplateMark is a document object model that describes a rich-text template, with embedded variables, conditional sections, formulae etc. TemplateMark uses embedded JavaScript expressions for conditionals
and calculations.

At a high-level the template engine converts a TemplateMark DOM to an AgreementMark DOM, evaluating JavaScript expressions for conditional sections and formulae, and replaces variable references with 
variable values from the supplied agreement data.

> Note: Use the @accordproject/markdown-transform project to convert templates to TemplateMark and to convert AgreementMark to output formats (HTML, PDF, DOCX etc.)

## References

Scala Play: https://www.playframework.com/documentation/2.1.0/ScalaTemplates
Dart (deprecated): http://blog.sethladd.com/2012/03/first-look-at-darts-html-template.html
Go Lang: http://sunfmin.com/2013/03/22/a-compiled-template-for-golang.html
JSP: https://gist.github.com/sunfmin/5124605

## Install

```
npm install @accordproject/template-engine --save
```

## License <a name="license"></a>
Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.

