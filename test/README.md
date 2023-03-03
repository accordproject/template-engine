To rebuild the `template.json` from `template.md` you need to clone the `markdown-transform` repo from the Accord Project organization, and checkout the `ergo-replacement` branch. Build the repo using `lerna` and then `cd` into `packages/markdown-cli` and run the command (updating the paths as necessary): 

```
node index.js transform --input ~/dev/template-engine/test/template.md --from markdown_template --to templatemark --model ~/dev/template-engine/test/model.cto --output ~/dev/template-engine/test/template.json
```