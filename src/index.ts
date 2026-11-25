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

// The contract a template's logic/logic.ts implements: extend TemplateLogic and
// return a TriggerResponse from trigger() (and an InitResponse from init()).
export { TemplateLogic } from './slc/SmartLegalContract';
export type {
    IConcept,
    ITransaction,
    IEvent,
    IState,
    IRequest,
    IResponse,
    IAsset,
    IContract,
    IClause,
    EngineResponse,
    TriggerResponse,
    InitResponse,
    TemplateData,
} from './slc/SmartLegalContract';

export { TemplateMarkInterpreter } from './TemplateMarkInterpreter';
export { TemplateArchiveProcessor } from './TemplateArchiveProcessor';
export { TemplateCompilationError } from './TemplateMarkToJavaScriptCompiler';
export type { CompilerError } from './TemplateMarkToJavaScriptCompiler';
export * from './utils';

// Re-exported for convenience so a single browser bundle can run the full
// model -> template -> agreement flow (and so consumers share one concerto instance).
export { ModelManager } from '@accordproject/concerto-core';
export { TemplateMarkTransformer } from '@accordproject/markdown-template';
