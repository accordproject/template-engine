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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMarkTransformer = exports.ModelManager = exports.agreement = exports.AgreementProcessor = exports.TemplateArchiveProcessor = exports.TemplateMarkInterpreter = void 0;
var TemplateMarkInterpreter_1 = require("./TemplateMarkInterpreter");
Object.defineProperty(exports, "TemplateMarkInterpreter", { enumerable: true, get: function () { return TemplateMarkInterpreter_1.TemplateMarkInterpreter; } });
var TemplateArchiveProcessor_1 = require("./TemplateArchiveProcessor");
Object.defineProperty(exports, "TemplateArchiveProcessor", { enumerable: true, get: function () { return TemplateArchiveProcessor_1.TemplateArchiveProcessor; } });
var AgreementProcessor_1 = require("./AgreementProcessor");
Object.defineProperty(exports, "AgreementProcessor", { enumerable: true, get: function () { return AgreementProcessor_1.AgreementProcessor; } });
exports.agreement = __importStar(require("./agreement/execute"));
__exportStar(require("./utils"), exports);
// Re-exported for convenience so a single browser bundle can run the full
// model -> template -> agreement flow (and so consumers share one concerto instance).
var concerto_core_1 = require("@accordproject/concerto-core");
Object.defineProperty(exports, "ModelManager", { enumerable: true, get: function () { return concerto_core_1.ModelManager; } });
var markdown_template_1 = require("@accordproject/markdown-template");
Object.defineProperty(exports, "TemplateMarkTransformer", { enumerable: true, get: function () { return markdown_template_1.TemplateMarkTransformer; } });
//# sourceMappingURL=index.js.map