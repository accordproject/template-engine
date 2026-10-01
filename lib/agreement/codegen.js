"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.logicTypes = logicTypes;
exports.generateLogicTypes = generateLogicTypes;
// Generates logic/generated for a template: the TypeScript its logic is written against.
const cicero_core_1 = require("@accordproject/cicero-core");
const fs_1 = require("fs");
const path_1 = require("path");
const TypeScriptCompilationContext_1 = require("../TypeScriptCompilationContext");
const loader_1 = require("./loader");
const types_1 = require("./types");
/**
 * The generated TypeScript for a template's models: an interface per type (Concerto's
 * TypeScript codegen) and, for logic written with defineLogic, types.ts.
 * @param {Template} template - the template
 * @param {boolean} logicApi - whether to include types.ts
 * @returns {Record<string, string>} each file's source, by file name
 */
function logicTypes(template, logicApi) {
    const modelManager = template.getModelManager();
    const files = new TypeScriptCompilationContext_1.TypeScriptCompilationContext(modelManager, template.getTemplateModel().getFullyQualifiedName())
        .getTypeScriptFiles();
    if (logicApi) {
        files['types.ts'] = (0, types_1.typesSource)(modelManager);
    }
    return files;
}
/**
 * Writes <templateDir>/logic/generated, replacing any TypeScript already there. types.ts
 * is written when logic/logic.ts uses the logic API, or when there is no logic yet.
 * @param {string} templateDir - the template's directory
 * @param {object} [options] - `offline`: load external models from the template's cached copies
 * @returns {Promise<string[]>} the files written
 */
async function generateLogicTypes(templateDir, options = {}) {
    const template = await cicero_core_1.Template.fromDirectory(templateDir, { offline: !!options.offline });
    let logicApi = true;
    try {
        logicApi = (0, loader_1.usesLogicApi)((0, fs_1.readFileSync)((0, path_1.join)(templateDir, 'logic', 'logic.ts'), 'utf8'));
    }
    catch {
        // No logic yet.
    }
    const files = logicTypes(template, logicApi);
    const outDir = (0, path_1.join)(templateDir, 'logic', 'generated');
    (0, fs_1.mkdirSync)(outDir, { recursive: true });
    for (const stale of (0, fs_1.readdirSync)(outDir).filter(f => f.endsWith('.ts'))) {
        (0, fs_1.rmSync)((0, path_1.join)(outDir, stale));
    }
    for (const [name, source] of Object.entries(files)) {
        (0, fs_1.writeFileSync)((0, path_1.join)(outDir, name), source);
    }
    return Object.keys(files).sort();
}
//# sourceMappingURL=codegen.js.map