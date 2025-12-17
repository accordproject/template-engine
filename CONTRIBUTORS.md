# Updating Runtime Dependencies

Ensure that the package you are adding has TypeScript type definitions.

1. Add the runtime dependency to package.json
2. Update scripts/updateRuntimeDependencies.js to include the TypeScript type definitions for the package
3. Run `npm run updateRuntimeDependencies`
4. Check that file src/runtime/declarations.ts has been updated
5. Update src/TypeScriptToJavaScriptCompiler.ts to load the declarations into the TS compilation environment
6. Update src/TypeScriptCompilationContext.ts to automatically import the module into generated TS runtime code
7. Update src/JavaScriptEvaluator.ts to pass the reference to the npm module into the function being evaluated

