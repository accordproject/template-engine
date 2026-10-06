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

// A minimal consumer app: imports the reasoners from the built lib and hands
// them a literal `import('openai')`, the way a bundled browser app is told to.
// Bundled with webpack by sdk-loaders.spec.ts.
const { createReasoner } = require('../../lib/llm/Reasoners');

const sdkLoaders = { openai: () => import('openai') };

window.runReasoner = async (clientOptions) => {
    const reasoner = createReasoner(
        {
            provider: 'openai-compatible',
            apiKey: 'test-key',
            model: 'test-model',
            customEndpoint: `${window.location.origin}/v1`,
            clientOptions,
        },
        sdkLoaders
    );
    try {
        return { content: (await reasoner.complete([{ role: 'user', content: 'Hello' }])).content };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
};
