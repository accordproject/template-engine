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
const { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } = require('fs');
const tar = require('tar');
const path = require('path');

function ensureDirSync(path) {
  !existsSync(path) && mkdirSync(path, { recursive: true });
}

function removeSync(path) {
  rmSync(path, { recursive: true, force: true });
}

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
 * Package the TypeScript declarations for dayjs, jsonpath and SmartLegalContract
 * These are needed at runtime to compile user TypeScript code and template logic to JS
 */
const dayjs = readFileSync('./node_modules/dayjs/index.d.ts').toString(
  'base64'
);
const jsonpath = readFileSync(
  './node_modules/@types/jsonpath/index.d.ts'
).toString('base64');
const smartLegalContract = readFileSync(
  './src/slc/SmartLegalContract.d.ts'
).toString('base64');

removeSync('./src/runtime/');
ensureDirSync('./src/runtime/');
writeFileSync(
  './src/runtime/declarations.ts',
  `
${HEADER}

export const DAYJS_BASE64 = '${dayjs}';
export const JSONPATH_BASE64 = '${jsonpath}';
export const SMART_LEGAL_CONTRACT_BASE64 = '${smartLegalContract}';
`
);
