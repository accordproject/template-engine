import { readFileSync } from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const TEST_MODELS_DIR = path.resolve(__dirname, '..', 'models');

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
