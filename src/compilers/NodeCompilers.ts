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

import { CommonMarkModel,TemplateMarkModel } from '@accordproject/markdown-common';

import { Clause } from './Clause';
import { Ignore, INodeCompiler, PassThrough } from './Common';
import { Conditional } from './Conditional';
import { ContractDefinition } from './ContractDefinition';
import { FormattedVariable } from './FormattedVariable';
import { Formula } from './Formula';
import { Join } from './Join';
import { ListBlock } from './ListBlock';
import { Optional } from './Optional';
import { Variable } from './Variable';
import { With } from './With';

/**
 * Registry of node compilers
 */
const NODE_COMPILERS:Record<string,INodeCompiler> = {
};

// templatemark
NODE_COMPILERS[ContractDefinition.TYPE] = new ContractDefinition();
NODE_COMPILERS[Variable.TYPE] = new Variable();
NODE_COMPILERS[FormattedVariable.TYPE] = new FormattedVariable();
NODE_COMPILERS[Formula.TYPE] = new Formula();
NODE_COMPILERS[Conditional.TYPE] = new Conditional();
NODE_COMPILERS[Join.TYPE] = new Join();
NODE_COMPILERS[With.TYPE] = new With();
NODE_COMPILERS[Clause.TYPE] = new Clause();
NODE_COMPILERS[Optional.TYPE] = new Optional();
NODE_COMPILERS[ListBlock.TYPE] = new ListBlock();

// ignored
NODE_COMPILERS[`${TemplateMarkModel.NAMESPACE}.Code`] = new Ignore();
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Document`] = new Ignore();

// commonmark
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Paragraph`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Text`] = new PassThrough(true);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Attribute`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.TagInfo`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.CodeBlock`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Code`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.HtmlInline`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.HtmlBlock`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Emph`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Strong`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.BlockQuote`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Heading`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.ThematicBreak`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Softbreak`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Linebreak`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Link`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Image`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.List`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Item`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.Table`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.TableHead`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.TableBody`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.TableRow`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.TableRow`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.HeaderCell`] = new PassThrough(false);
NODE_COMPILERS[`${CommonMarkModel.NAMESPACE}.TableCell`] = new PassThrough(false);

/**
 * Lookup a node compiler
 * @param {string} fqn the Concerto FQN of the node $class
 * @returns {INodeCompiler} the compiler to use for this node
 */
export function getCompiler(fqn:string) : INodeCompiler {
    const compiler = NODE_COMPILERS[fqn];
    if(!compiler) {
        throw new Error(`No compiler found for node ${fqn}`);
    }
    return compiler;
}