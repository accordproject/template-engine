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
import traverse from 'traverse';
import { writeFileSync, ensureDirSync } from 'fs-extra';
import * as tar from 'tar';
import { Readable } from 'stream';

import { TemplateMarkModel, CiceroMarkModel, CommonMarkModel, ConcertoMetaModel } from '@accordproject/markdown-common';

import { ClassDeclaration, Factory, ModelManager, ModelUtil, Property, Resource } from '@accordproject/concerto-core';
import { CodeGen } from '@accordproject/concerto-codegen';
import { FileWriter } from '@accordproject/concerto-util';
import { getCompiler } from './compilers/NodeCompilers';
import { RUNTIME_DIR, writeEpilog, writeImports, writeProlog } from './compilers/Common';
import { getTemplateClassDeclaration } from './Common';
import { RUNTIME_TGZ_BASE64 } from './runtime/runtime';

export type ProcessingFunction = (fw: FileWriter, level: number, resource: any) => void;

export type CompilationOptions = {
    skipGenerator?: boolean;
    skipCopyRuntime?: boolean;
}

/**
 * Converts TemplateMark DOM to a Typescript function, that, when run with JSON data
 * that conforms to the template model will produce AgreementMark JSON output.
 */
export class TemplateMarkToTypeScriptCompiler {
    modelManager: ModelManager;
    templateClass: ClassDeclaration;

    constructor(modelManager: ModelManager,templateConceptFqn?: string) {
        this.modelManager = modelManager;
        this.templateClass = getTemplateClassDeclaration(this.modelManager,templateConceptFqn);
    }

    writeFunctionToString(functionName: string, returnType: string, code: string): string {
        let result = '';
        result += '/// ---cut---\n';
        result += `export function ${functionName}(data:TemplateModel.I${this.templateClass.getName()}, library:any, now:dayjs.Dayjs) : ${returnType} {\n`;
        this.templateClass.getProperties().forEach((p: Property) => {
            result += `   const ${p.getName()} = data.${p.getName()};\n`;
        });
        result += '   ' + code.trim() + '\n';
        result += '}\n';
        result += '\n';

        return result;
    }

    writeFunction(fw: FileWriter, functionName: string, returnType: string, code: string) {
        fw.writeLine(0, this.writeFunctionToString(functionName, returnType, code));
    }

    /**
     * Get a model manager with templatemark model
     * @param {string} outputDir the output directory
     * @returns {ModelManager} the model manager
     */
    getTemplateMarkModelManager(): ModelManager {
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(TemplateMarkModel.MODEL, 'templatemark.cto');
        return modelManager;
    }

    /**
     * Get a model manager with templatemark model
     * @param {string} outputDir the output directory
     * @returns {ModelManager} the model manager
     */
    getCiceroMarkModelManager(): ModelManager {
        const modelManager = new ModelManager({ strict: true });
        modelManager.addCTOModel(ConcertoMetaModel.MODEL, 'concertometamodel.cto');
        modelManager.addCTOModel(CommonMarkModel.MODEL, 'commonmark.cto');
        modelManager.addCTOModel(CiceroMarkModel.MODEL, 'ciceromark.cto');
        return modelManager;
    }

    generateTypeScript(modelManager: ModelManager, outputDir: string) {
        // generate the TS code for the template model
        const tsVisitor = new CodeGen.TypescriptVisitor();
        const parameters = {
            fileWriter: new FileWriter(outputDir)
        };
        modelManager.accept(tsVisitor, parameters);
    }

    generateSampleData(modelManager: ModelManager, outputDir: string) {
        const factory = new Factory(modelManager);
        const instance = factory.newResource(this.templateClass.getNamespace(),
            this.templateClass.getName(), this.templateClass.isIdentified() ? 'sample' : undefined,
            {generate: 'sample', includeOptionalFields: true});
        writeFileSync(`${outputDir}/sample.json`,JSON.stringify(instance, null, 2));
    }

    /**
     * The main iteration function over templatemark. This function
     * looks up an INodeCompiler that can handle each templatemark node
     * and delegates to it for code generation.
     * Note that the result of code generation (a CiceroMark node) is left in
     * the $result global varianble.
     * @param {FileWriter} fw  the file writer to use
     * @param {number} level the indentation level
     * @param {object} templateMark the templatemark node to iterate over
     */
    static doIt(fw: FileWriter, level: number, templateMark: any) {
        fw.writeLine(level, `// start processing ${ModelUtil.getShortName(templateMark.$class)}`);
        traverse(templateMark).forEach(function (context: any) {
            if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
                const nodeClass = context.$class as string;

                const compiler = getCompiler(nodeClass);
                const sourceLevel = level + 1;

                this.before(() => {
                    compiler.enter(fw, sourceLevel, context);
                    compiler.generate(fw, sourceLevel, context, TemplateMarkToTypeScriptCompiler.doIt);
                });

                this.after(() => {
                    compiler.exit(fw, sourceLevel, context);
                });
            }
        });
        fw.writeLine(level, `// end processing ${ModelUtil.getShortName(templateMark.$class)}`);
    }
    /**
     * Converts a TemplateMark document to typescript code that is parameterised
     * by the 'data' argument.
     *
     * The strategy is to traverse the template mark json, converting each node into
     * typescript statements that add an equivalent ciceromark node. Variables will
     * pull values from 'data'.
     *
     * Conditionals and formulae will call the functions produced by
     * compileUserCode.
     *
     * Note that code generation process is itself recursive, for example, when
     * a list definition node is encountered the list must be iterated over
     * based on a variable value coming from data, and code must be
     * generated to produce each list item.
     *
     * All internal variables are prefixed with '$' to ensure (?)
     * that they cannot collide with end user variable names.
     *
     * @param {IDocument} templateMark the TemplateMark Concerto resource
     * @param {string} outputDir the output directory for code
     */
    compileGenerator(templateMark: any, outputDir: string): void {
        const fw = new FileWriter(outputDir);

        fw.openFile('index.ts');
        fw.writeLine(0, '// generated code');
        fw.writeLine(0, 'import { readFileSync } from \'fs\';');
        fw.writeLine(0, 'import dayjs from \'dayjs\';');
        fw.writeLine(0, 'import { generator } from \'./generator\';');
        fw.writeLine(0, 'if(process.argv.length === 3) {');
        fw.writeLine(1, 'const result = generator( JSON.parse(readFileSync(process.argv[2], \'utf-8\')), {}, dayjs());');
        fw.writeLine(1, 'console.log(JSON.stringify(result, null, 2));');
        fw.writeLine(0, '}');
        fw.writeLine(0, 'else {');
        fw.writeLine(1, 'console.log(\'First argument is path to JSON data file\');');
        fw.writeLine(0, '}');
        fw.closeFile();

        fw.openFile('generator.ts');
        fw.writeLine(0, '// generated code, do not modify');
        fw.writeLine(0, '');

        fw.writeLine(0, '// IMPORTS');
        writeImports(fw, 0, this.templateClass);
        fw.writeLine(0, '');

        fw.writeLine(0, '// GENERATOR');
        writeProlog(fw, 0, this.templateClass);

        TemplateMarkToTypeScriptCompiler.doIt(fw, 1, templateMark);

        writeEpilog(fw, 0);
        fw.closeFile();
    }

    /**
     * Decompresses the base64 zipped runtime into an output folder.
     * @param {string} outputDir the output directory to copy the runtime to
     */
    copyRuntime(outputDir: string) {
        ensureDirSync(`${outputDir}/${RUNTIME_DIR}`);
        const runtimeBuffer = Buffer.from(RUNTIME_TGZ_BASE64, 'base64');
        const s = new Readable();
        s.push(runtimeBuffer);
        s.push(null);
        s.pipe(
            tar.x({
                strip: 2,
                C: `${outputDir}/${RUNTIME_DIR}`
            })
        );
    }

    /**
     * Create package.json for the generated code
     * @param {string} outputDir the output directory to copy the runtime to
     */
    createPackage(outputDir: string) {
        const packageJson = {
            'name': 'generated',
            'version': '1.0.0',
            'description': 'TypeScript code generated from TemplateMark',
            'engines': {
                'node': '>=14',
                'npm': '>=6'
            },
            'keywords': [
                'accord project',
                'template',
                'templatemark'
            ],
            'dependencies': {
                'dayjs': '1.11.7',
                'jsonpath': '^1.1.1',
            },
            'devDependencies': {
                '@types/node': '^20.2.0',
                'ts-node': '^10.9.1',
                'typescript': '^5.0.2',
                '@types/jsonpath': '^0.2.0'
            },
            'scripts' : {
                'start' : 'ts-node index.ts sample.json'
            }
        };

        writeFileSync(`${outputDir}/package.json`,JSON.stringify(packageJson, null, 2));
    }

    compile(templateMark: Resource | any, outputDir: string, options?: CompilationOptions) {
        // create output dir
        ensureDirSync(outputDir);

        // generate sample data
        this.generateSampleData(this.modelManager, outputDir);

        // generate the models
        this.generateTypeScript(this.modelManager, outputDir);
        this.generateTypeScript(this.getTemplateMarkModelManager(), outputDir);
        this.generateTypeScript(this.getCiceroMarkModelManager(), outputDir);

        // generate names for all the nodes containing user code
        const namedTemplateMark = TemplateMarkToTypeScriptCompiler.nameUserCode(templateMark.toJSON ? templateMark.toJSON() : templateMark);

        // compile the user code
        this.compileUserCode(namedTemplateMark, outputDir);

        // copy the runtime
        if (!options?.skipCopyRuntime) {
            this.copyRuntime(outputDir);
        }

        // compile the generator
        if (!options?.skipGenerator) {
            this.createPackage(outputDir);
            this.compileGenerator(namedTemplateMark, outputDir);
        }
    }

    static nameUserCode(templateMarkDom: any) {
        return traverse(templateMarkDom).map(function (x) {
            if (x && ((x.$class === `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition` && x.condition) ||
                (`${TemplateMarkModel.NAMESPACE}.ClauseDefinition` && x.condition))) {
                x.functionName = `condition_${this.path.join('_')}`;
            }
            this.update(x);
        });
    }

    compileUserCode(templateMark: any, outputDir: string) {
        const fw = new FileWriter(outputDir);

        fw.openFile('usercode.ts');
        fw.writeLine(0, '// generated code, do not modify');
        fw.writeLine(0, '');

        fw.writeLine(0, '// IMPORTS');
        fw.writeLine(0, `import * as TemplateModel from './${this.templateClass.getNamespace()}';`);
        fw.writeLine(0, 'import dayjs from \'dayjs\';');
        fw.writeLine(0, 'import jp from \'jsonpath\';');
        fw.writeLine(0, '');

        const templateMarkDom = templateMark;

        const functionNodes: [] = traverse(templateMarkDom).reduce(function (acc, x) {
            if (x && x.$class === `${TemplateMarkModel.NAMESPACE}.FormulaDefinition`) {
                acc.push({
                    name: x.name,
                    code: x.code,
                });
            }
            return acc;
        }, []);

        const conditionalNodes: [] = traverse(templateMarkDom).reduce(function (acc, x) {
            if (x && x.$class === `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition` && x.condition) {
                acc.push({
                    name: x.functionName,
                    code: x.condition,
                });
            }
            return acc;
        }, []);

        const clauseNodes: [] = traverse(templateMarkDom).reduce(function (acc, x) {
            if (x && x.$class === `${TemplateMarkModel.NAMESPACE}.ClauseDefinition` && x.condition) {
                acc.push({
                    name: x.functionName,
                    code: x.condition,
                });
            }
            return acc;
        }, []);

        fw.writeLine(0, '// FORMULAE');
        functionNodes.forEach((fun: any) => {
            this.writeFunction(fw, `${fun.name}`, 'any', fun.code.contents);
        });
        fw.writeLine(0, '');

        fw.writeLine(0, '// CONDITIONALS');
        conditionalNodes.forEach((fun: any) => {
            this.writeFunction(fw, `${fun.name}`, 'boolean', fun.code.contents);
        });
        fw.writeLine(0, '');

        fw.writeLine(0, '// CLAUSES');
        clauseNodes.forEach((fun: any) => {
            this.writeFunction(fw, `${fun.name}`, 'boolean', fun.code.contents);
        });
        fw.writeLine(0, '');

        fw.closeFile();
    }
}