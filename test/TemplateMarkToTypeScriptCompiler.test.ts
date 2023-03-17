import { Factory, ModelManager, Serializer } from '@accordproject/concerto-core';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';

import { readFileSync, readdirSync } from 'fs';
import { ensureDirSync, existsSync, rmSync, writeFileSync } from 'fs-extra';
import * as path from 'path';
import { TemplateMarkToTypeScriptCompiler } from '../src/TemplateMarkToTypeScriptCompiler';

const templateMarkTransformer = new TemplateMarkTransformer();

describe('templatemark to typescript compiler', () => {

    let compiler:TemplateMarkToTypeScriptCompiler|null = null;
    let serializer:Serializer|null = null;
    let modelManager:ModelManager|null = null;
    const templates:Array<{name:string,content:string}> = readdirSync('./test/templates').map(file => {
        return {
            name: file,
            content: readFileSync(path.join('./test/templates', file), 'utf-8')
        };
    });

    beforeAll(() => {
        const model = readFileSync('./test/model.cto', 'utf-8');
        modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(model);
        compiler = new TemplateMarkToTypeScriptCompiler(modelManager);
        const factory = new Factory(compiler.getTemplateMarkModelManager());
        serializer = new Serializer(factory,compiler.getTemplateMarkModelManager());
    });

    templates.forEach(function(template){
        test(`should compile ${template.name}`, async () => {
            const templatenName = path.parse(template.name).name;
            const templateMarkJson = templateMarkTransformer.fromMarkdownTemplate({ content: template.content }, modelManager, 'contract', { verbose: false });
            rmSync(`./output/${templatenName}`, { recursive: true, force: true });
            ensureDirSync(`./output/${templatenName}`);
            writeFileSync(`./output/${templatenName}/template.json`, JSON.stringify(templateMarkJson, null, 2) );
            if(serializer && compiler) {
                const templateMarkDom = serializer.fromJSON(templateMarkJson);
                compiler.compile(templateMarkDom, `./output/${templatenName}`);
                const result = existsSync(`./output/${templatenName}/generator.ts`);
                expect(result).toBeTruthy();
            }
        });
    });
});