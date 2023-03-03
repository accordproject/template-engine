To rebuild the `template.json` from `template.md` you need to clone the `markdown-transform` repo from the Accord Project organization, and checkout the `ergo-replacement` branch. Build the repo using `lerna` and then `cd` into `packages/markdown-cli` and run the command (updating the paths as necessary): 

```
git clone https://github.com/accordproject/markdown-transform.git
cd markdown-transform
git checkout ergo-replacement
npm i
cd packages/markdown-cli
node index.js transform --input ~/dev/template-engine/test/template.md --from markdown_template --to templatemark --model ~/dev/template-engine/test/model.cto --output ~/dev/template-engine/test/template.json --contract
```

To run tests switch to the root directory of **this repo** and run:

```
npm i (to install all dependencies)
npm run models:get (only needs to be done one)
npm test (to run the tests)
```