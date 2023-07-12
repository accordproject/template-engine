import { ModelManager } from '@accordproject/concerto-core';
import { readFileSync } from 'fs';
import { TypeScriptToJavaScriptCompiler } from '../src/TypeScriptToJavaScriptCompiler';

describe('typescript compiler', () => {
    test.only('should compile typescript to javascript', async () => {

        const code = `
export function condition_nodes_0_nodes_13_nodes_4_nodes_0(data:TemplateModel.ITemplateData, library:any) : boolean {
    const firstName = data.firstName;
    const lastName = data.lastName;
    const middleNames = data.middleNames;
    const active = data.active;
    const lastVisit = data.lastVisit;
    const address = data.address;
    const orders = data.orders;
    const loyaltyStatus = data.loyaltyStatus;
    const preferences = data.preferences;
    return preferences.favoriteColors !== undefined && preferences.favoriteColors.includes('PINK')
}`;
        const modelManager = new ModelManager();
        modelManager.addCTOModel( readFileSync('./test/templates/good/full/model.cto', 'utf-8'), 'model.cto');
        const compiler = new TypeScriptToJavaScriptCompiler(modelManager);
        await compiler.initialize();
        const results = compiler.compile(code);
        expect(results).toMatchSnapshot();
    });
});