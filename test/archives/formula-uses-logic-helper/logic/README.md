# Introduction

This is a sample Accord Project template that includes logic for the template written in TypeScript.

# Template Model

The data model for the template defines the structure of the data for the contract (a "clause" in this case).
The template concept has the `@template` annotation.

The template model also defines the request and response types for the template logic.

The template model may optionally also define a state type for the template logic, for templates that support state.

# Template Logic

To write your template logic you should first generate the TypeScript source code for the template
using the `concerto compile --model ./model/model.cto --target typescript --output logic/generated` CLI command.

You can then define and export the template logic class, which should implement the `TemplateLogic` interface,
implementing the trigger method and optionally the init method.

## Current Limitations

1. All template logic must be written in TypeScript and in a single file called logic.ts within the logic folder of the template
2. You cannot import third-party modules into your template logic
