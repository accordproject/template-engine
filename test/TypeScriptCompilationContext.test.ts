import { ModelManager } from '@accordproject/concerto-core';
import { readFileSync } from 'fs-extra';
import { TypeScriptCompilationContext } from '../src/TypeScriptCompilationContext';

describe('typescript compilation context', () => {
    test('should create a context from a model manager', async () => {
        const model = readFileSync('./test/templates/good/full/model.cto', 'utf-8');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(model, 'model.cto');
        const context = new TypeScriptCompilationContext(modelManager);
        const result = context.getCompilationContext();
        expect(result).toMatchSnapshot();
    });
});