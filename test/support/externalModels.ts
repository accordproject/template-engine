import { readFileSync } from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const TEST_MODELS_DIR = path.resolve(__dirname, '..', 'models');
const ARCHIVE_MODELS_DIR = path.resolve(__dirname, '..', 'archives', 'latedeliveryandpenalty-typescript', 'model');

const VENDORED_MODEL_FILES = [
    '@models.accordproject.org.money@0.3.0.cto',
    '@models.accordproject.org.accordproject.party@0.2.0.cto',
    '@models.accordproject.org.time@0.3.0.cto'
];

export function loadOfflineExternalModels(modelManager: ModelManager) {
    VENDORED_MODEL_FILES.forEach((fileName) => {
        const model = readFileSync(path.join(TEST_MODELS_DIR, fileName), 'utf-8');
        modelManager.addCTOModel(model, fileName);
    });
}

export function mockExternalModelFetches() {
    const originalFetch = global.fetch.bind(global);
    const modelByUrl = new Map([
        ['https://models.accordproject.org/money@0.3.0.cto', readFileSync(path.join(TEST_MODELS_DIR, '@models.accordproject.org.money@0.3.0.cto'), 'utf-8')],
        ['https://models.accordproject.org/accordproject/party@0.2.0.cto', readFileSync(path.join(TEST_MODELS_DIR, '@models.accordproject.org.accordproject.party@0.2.0.cto'), 'utf-8')],
        ['https://models.accordproject.org/time@0.3.0.cto', readFileSync(path.join(TEST_MODELS_DIR, '@models.accordproject.org.time@0.3.0.cto'), 'utf-8')],
        ['https://models.accordproject.org/accordproject/contract@0.2.0.cto', readFileSync(path.join(ARCHIVE_MODELS_DIR, '@models.accordproject.org.accordproject.contract@0.2.0.cto'), 'utf-8')],
        ['https://models.accordproject.org/accordproject/runtime@0.2.0.cto', readFileSync(path.join(ARCHIVE_MODELS_DIR, '@models.accordproject.org.accordproject.runtime@0.2.0.cto'), 'utf-8')]
    ]);

    return jest.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const model = modelByUrl.get(url);

        if (model !== undefined) {
            return new Response(model, {
                status: 200,
                headers: {
                    'content-type': 'text/plain'
                }
            });
        }

        return originalFetch(input, init);
    });
}
