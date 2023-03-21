/*
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { readFileSync, writeFileSync } = require('fs');
const { ensureDirSync } = require('fs-extra');
const tar = require('tar');
const path = require('path');
const { removeSync } = require('fs-extra');

const HEADER = `/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable quotes */
// file generated by ./scripts/updateRuntimeDependencies.js
`;

/**
 * Package the TypeScript declarations for dayjs and jsonpath
 * Both of these are needed at runtime so compile user TypeScript code to JS
 */
const dayjs = readFileSync('./node_modules/dayjs/index.d.ts').toString(
  'base64'
);
const jsonpath = readFileSync(
  './node_modules/@types/jsonpath/index.d.ts'
).toString('base64');


removeSync('./src/runtime/');
ensureDirSync('./src/runtime/');
writeFileSync(
  './src/runtime/declarations.ts',
  `
${HEADER}

export const DAYJS_BASE64 = '${dayjs}';
export const JSONPATH_BASE64 = '${jsonpath}';
`
);

/**
 * Packages the TypeScriptRuntime.ts and the contents of the 'drafting'
 * directory as this code is used by generated code and must be copied to
 * the output folder when we generate typescript code for a template
 */
ensureDirSync('dist');

tar
  .c(
    {
      gzip: true,
      file: path.join('dist', 'runtime.tgz'),
    },
    ['./src/drafting', './src/TypeScriptRuntime.ts']
  )
  .then((_) => {
    const runtime = readFileSync(path.join('dist', 'runtime.tgz')).toString(
      'base64'
    );

    writeFileSync(
      './src/runtime/runtime.ts',
      `
${HEADER}

export const RUNTIME_TGZ_BASE64 = '${runtime}';
`
    );
  });