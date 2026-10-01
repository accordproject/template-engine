#!/usr/bin/env node
/*
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


// template-engine-codegen [templateDir] [--offline]
//
// Writes the TypeScript a template's logic is written against into
// <templateDir>/logic/generated: an interface per model type, from Concerto's
// TypeScript codegen, and, for logic written with defineLogic, types.ts, a factory per
// concrete type. The models are loaded as the engine loads them, by cicero-core.
'use strict';

const { generateLogicTypes } = require('../lib/agreement/codegen');

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const [templateDir = '.'] = args.filter(a => !a.startsWith('--'));

generateLogicTypes(templateDir, { offline })
    .then(files => {
        console.log(`Wrote ${files.length} files to ${templateDir}/logic/generated.`);
    })
    .catch(err => {
        console.error(err.message);
        process.exit(1);
    });
