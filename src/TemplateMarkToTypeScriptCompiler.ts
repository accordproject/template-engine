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
import { copySync } from 'fs-extra';

import { TemplateMarkModel, CiceroMarkModel, CommonMarkModel, ConcertoMetaModel } from '@accordproject/markdown-common';

import { ClassDeclaration, ModelManager, ModelUtil, Resource } from '@accordproject/concerto-core';
import { CodeGen } from '@accordproject/concerto-tools';
import { FileWriter } from '@accordproject/concerto-util';
import { getCompiler } from './compilers/NodeCompilers';
import { RUNTIME_DIR, writeEpilog, writeImports, writeProlog } from './compilers/Common';
import { getTemplateClassDeclaration } from './Common';

export type ProcessingFunction = (fw:FileWriter, level:number, resource:any) => void;

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

    constructor(modelManager: ModelManager) {
        this.modelManager = modelManager;
        this.templateClass = getTemplateClassDeclaration(this.modelManager);
    }

    writeFunctionToString(functionName: string, returnType:string, code: string) : string {
        let result = '';
        result += '/// ---cut---\n';
        result += `export function ${functionName}(data:TemplateModel.I${this.templateClass.getName()}, library:any) : ${returnType} {\n`;
        this.templateClass.getProperties().forEach((p: any) => {
            result += `   const ${p.getName()} = data.${p.getName()};\n`;
        });
        result += '   const now = dayjs();\n';
        result += '   ' + code.trim() + '\n';
        result += '}\n';
        result += '\n';
        return result;
    }

    writeFunction(fw: FileWriter, functionName: string, returnType:string, code: string) {
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
    static doIt(fw:FileWriter, level:number, templateMark: any) {
        fw.writeLine(level, `// start processing ${ModelUtil.getShortName(templateMark.$class)}`);
        traverse(templateMark).forEach(function (context: any) {
            if (typeof context === 'object' && context.$class && typeof context.$class === 'string') {
                const nodeClass = context.$class as string;

                const compiler = getCompiler(nodeClass);
                const sourceLevel = level+1;

                this.before( () => {
                    compiler.enter(fw, sourceLevel, context);
                    compiler.generate(fw, sourceLevel, context, TemplateMarkToTypeScriptCompiler.doIt);
                });

                this.after( () => {
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
    compileGenerator(templateMark: Resource, outputDir: string) : void {
        const fw = new FileWriter(outputDir);

        fw.openFile('generator.ts');
        fw.writeLine(0, '// generated code, do not modify');
        fw.writeLine(0, '');

        fw.writeLine(0, '// IMPORTS');
        writeImports(fw, 0, this.templateClass);
        fw.writeLine(0, '');

        fw.writeLine(0, '// GENERATOR');
        writeProlog(fw, 0, this.templateClass);

        TemplateMarkToTypeScriptCompiler.doIt(fw, 1, templateMark);

        writeEpilog(fw,0);
        fw.closeFile();
    }

    copyRuntime(outputDir: string) {
        copySync('./src/drafting', `${outputDir}/${RUNTIME_DIR}/drafting`);
        copySync('./src/TypeScriptRuntime.ts', `${outputDir}/${RUNTIME_DIR}/TypeScriptRuntime.ts`);
    }

    compile(templateMark: Resource, outputDir: string, options?:CompilationOptions) {
        // generate the model
        this.generateTypeScript(this.modelManager, `${outputDir}`);
        this.generateTypeScript(this.getTemplateMarkModelManager(), `${outputDir}`);
        this.generateTypeScript(this.getCiceroMarkModelManager(), `${outputDir}`);

        // generate names for all the nodes containing user code
        const namedTemplateMark = TemplateMarkToTypeScriptCompiler.nameUserCode(templateMark.toJSON());

        // compile the user code
        this.compileUserCode(namedTemplateMark, outputDir);

        // compile the generator
        if(!options?.skipCopyRuntime) {
            this.copyRuntime(outputDir);
        }

        // compile the generator
        if(!options?.skipGenerator) {
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

    compileUserCode(templateMark: Resource, outputDir: string) {
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