
To create `template.json` from `template.md` and `model.cto`:

```
node index.js transform --input ~/dev/template-engine/test/template.md --from markdown_template --to templatemark --model ~/dev/template-engine/test/model.cto --output ~/dev/template-engine/test/template.json
```