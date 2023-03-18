import { Factory, ModelManager, Serializer } from '@accordproject/concerto-core';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';

import { readFileSync, readdirSync } from 'fs';
import { ensureDirSync, existsSync, rmSync, writeFileSync } from 'fs-extra';
import * as path from 'path';
import { TemplateMarkToTypeScriptCompiler } from '../src/TemplateMarkToTypeScriptCompiler';

const templateMarkTransformer = new TemplateMarkTransformer();

describe('templatemark to typescript compiler', () => {

    const templates:Array<{name:string,content:string}> = readdirSync('./test/templates').map(dir => {
        return {
            name: dir,
            content: readFileSync(path.join('./test/templates', dir, 'template.md'), 'utf-8')
        };
    });

    templates.forEach(function(template){
        test(`should compile ${template.name}`, async () => {
            const templatenName = path.parse(template.name).name;

            const model = readFileSync(`./test/templates/${templatenName}/model.cto`, 'utf-8');
            const modelManager = new ModelManager({ strict: true });
            modelManager.addCTOModel(model);
            const compiler = new TemplateMarkToTypeScriptCompiler(modelManager);
            const factory = new Factory(compiler.getTemplateMarkModelManager());
            const serializer = new Serializer(factory,compiler.getTemplateMarkModelManager());

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