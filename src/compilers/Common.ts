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
import { INode } from '../model-gen/org.accordproject.commonmark@0.5.0';
import { CommonMarkModel,TemplateMarkModel,CiceroMarkModel } from '@accordproject/markdown-common';
import { FileWriter } from '@accordproject/concerto-util';
import { ClassDeclaration, ModelUtil } from '@accordproject/concerto-core';
import { ProcessingFunction } from '../Compiler';

export function writeDebug(fw:FileWriter, level:number, concept:any) {
    fw.writeLine(level, `// ${ModelUtil.getShortName(concept.$class)} ${concept.name ? `(${concept.name})` : ''}`);
}

export const RUNTIME_DIR = 'runtime';

export function writeImports(fw:FileWriter, level:number, templateClass:ClassDeclaration) {
    fw.writeLine(level, `import * as CommonMark from './${CommonMarkModel.NAMESPACE}';`);
    fw.writeLine(level, `import * as CiceroMark from './${CiceroMarkModel.NAMESPACE}';`);
    fw.writeLine(level, `import * as TemplateModel from './${templateClass.getNamespace()}';`);
    fw.writeLine(level, 'import * as UserCode from \'./usercode\';');
    fw.writeLine(level, `import { draftingMap as $draftingMap } from './${RUNTIME_DIR}/drafting';`);
    fw.writeLine(level, `import * as Runtime from './${RUNTIME_DIR}/Runtime';`);
}
export function writeProlog(fw:FileWriter, level:number, templateClass:ClassDeclaration) {
    fw.writeLine(level, `export function generator(data:TemplateModel.I${templateClass.getName()}, library:any) : CommonMark.IDocument {`);
    fw.writeLine(level, `const docNode = {$class: '${CommonMarkModel.NAMESPACE}.Document', xmlns: '${CommonMarkModel.NAMESPACE}', nodes: []} as CommonMark.INode;`);
    fw.writeLine(level, 'const $nodes:CommonMark.INode[] = [];'); // the stack of output CiceroMark nodes
    fw.writeLine(level, 'const $data:any[] = [];'); // the stack of 'this' used for data access
    fw.writeLine(level, 'let $result:any = docNode;'); // document root, or the return value
    fw.writeLine(level, 'Runtime.push($data, data);'); // push the 'data' to the stack so we have an initial 'this';
}

export function writeEpilog(fw:FileWriter, level:number) {
    fw.writeLine(level, 'return $result as CommonMark.IDocument;');
    fw.writeLine(level, '}');
}

// allows us to declare local variables without fear of collision
export function writeOpenGenerateScope(fw:FileWriter, level:number) {
    fw.writeLine(level, '$result = (() => {');
}

// closes the scope, calling the anon-function
// and then pushes the result as a child of the last element of $nodes
export function writeCloseGenerateScope(fw:FileWriter, level:number) {
    fw.writeLine(level, '})();');
    fw.writeLine(level, 'Runtime.addChild($nodes, $result);');
}

// save $curNode into $stack, so we can pop it when the scope closes
export function writeOpenNodeScope(fw:FileWriter, level:number) {
    fw.writeLine(level, 'Runtime.push($nodes, $result);');
}

// closes the scope, popping the stack and setting $curNode
export function writeCloseNodeScope(fw:FileWriter, level:number) {
    fw.writeLine(level, '$result = Runtime.pop($nodes);');
}

// save $curNode into $stack, so we can pop it when the scope closes
export function writeOpenDataScope(fw:FileWriter, level:number, name:string) {
    fw.writeLine(level, `Runtime.push($data, Runtime.peekProperty($data, '${name}'));`);
}

// closes the scope, popping the stack and setting $curNode
export function writeCloseDataScope(fw:FileWriter, level:number) {
    fw.writeLine(level, 'Runtime.pop($data);');
}

export function getTypeScriptType(ctoFqn: string): string {
    const ns = ModelUtil.getNamespace(ctoFqn);
    const type = ModelUtil.getShortName(ctoFqn);

    if (ns === CommonMarkModel.NAMESPACE) {
        return `CommonMark.I${type}`;
    }
    else if (ns === CiceroMarkModel.NAMESPACE) {
        return `CiceroMark.I${type}`;
    }
    else if (ns === TemplateMarkModel.NAMESPACE) {
        return `CiceroMark.I${type.substring(0, type.length - 'Definition'.length)}`;
    }
    else {
        throw new Error(`No type mapping for ${ctoFqn}`);
    }
}

/**
 * Map of a node from template mark to ciceromark
 * @param {INode} templateMarkNode the template mark.
 * @param {boolean} deep when deep is false (the default) child nodes are not copied
 * @returns {INode} the mapped node
 */
export function makeCiceroMark(templateMarkNode:INode, deep=false): INode {
    if(!templateMarkNode.$class) {
        throw new Error('Not a concerto type.');
    }
    const json = JSON.parse(JSON.stringify(templateMarkNode));
    delete json.elementType;
    if(!deep) {
        delete json.nodes;
    }
    else {
        if(json.nodes) {
            json.nodes = json.nodes.map((n:INode) => makeCiceroMark(n,deep));
        }
    }

    const ns = ModelUtil.getNamespace(json.$class);
    const type = ModelUtil.getShortName(json.$class);

    if (ns === TemplateMarkModel.NAMESPACE) {
        json.$class = `${CiceroMarkModel.NAMESPACE}.${type.substring(0, type.length - 'Definition'.length)}`;
    }

    return json;
}

export interface INodeCompiler {
    enter(fw:FileWriter, level:number, templateMarkNode:INode) : void;
    generate(fw:FileWriter, level:number, templateMarkNode:INode, doIt:ProcessingFunction) : void;
    exit(fw:FileWriter, level:number, templateMarkNode:INode) : void;
}

/**
 * A node compiler that allows code to run on node enter, exit and
 * with a generate method to generate code for the node.
 */
export abstract class AbstractComplexCompiler implements INodeCompiler {

    leaf:boolean;

    constructor(leaf:boolean) {
        this.leaf = leaf;
    }

    isLeaf() : boolean {
        return this.leaf;
    }

    enter(fw:FileWriter, level:number,templateMarkNode:INode) {
        writeDebug(fw, level, templateMarkNode);
        writeOpenNodeScope(fw,level);
    }

    abstract generate(fw:FileWriter, level:number, templateMarkNode:INode, doIt:ProcessingFunction) : void;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    exit(fw:FileWriter, level:number) {
        writeCloseNodeScope(fw,level);
    }
}

/**
 * A node compiler that allows a JSON node to be constructed from
 * the data in a templatemark node.
 */
export abstract class AbstractSimpleCompiler extends AbstractComplexCompiler {

    constructor(leaf:boolean) {
        super(leaf);
    }

    abstract getNode(templateMarkNode:INode):INode;

    generate(fw:FileWriter, level:number, templateMarkNode:INode) {
        const node = this.getNode(templateMarkNode);
        if(this.isLeaf()) {
            node.nodes = []; // we are a leaf node, null out child nodes
        }
        writeOpenGenerateScope(fw,level);
        fw.writeLine(level, `return ${JSON.stringify(node)} as ${getTypeScriptType(node.$class)};`);
        writeCloseGenerateScope(fw,level);
    }
}

/**
 * PassThroughNode simply maps data from TemplateMark to
 * CiceroMark, updating namespaces but otherwise leaving
 * the data alone.
 */
export class PassThrough extends AbstractSimpleCompiler {
    constructor(leaf:boolean) {
        super(leaf);
    }
    getNode(templateMarkNode:INode):INode {
        return makeCiceroMark(templateMarkNode) as INode;
    }
}

/**
 * Ignore doesn't write any output for a node type
 */
export class Ignore implements INodeCompiler {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    enter(fw: FileWriter, level: number, templateMarkNode: INode): void {
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    generate(fw: FileWriter, level: number, templateMarkNode: INode): void {
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    exit(fw: FileWriter, level: number, templateMarkNode: INode): void {
    }
}