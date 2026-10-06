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

import * as ts from 'typescript';
import { ModelManager } from '@accordproject/concerto-core';
import { TemplateMarkModel } from '@accordproject/markdown-common';
import * as os from 'os';
import * as path from 'path';
import { existsSync, writeFileSync } from 'fs';
import {
    getAssignableConcreteTypes,
    isAssignableTo,
    ensureDirSync,
    removeSync,
    writeFunctionToString,
    nameUserCode,
    getTemplateClassDeclaration,
    wrapExpressionWithReturn
} from '../src/utils';

const MODEL_NS = 'test.hierarchy@1.0.0';

const HIERARCHY_MODEL = `namespace ${MODEL_NS}

abstract concept BaseAbstract {
    o String id
}

concept SubConcreteA extends BaseAbstract {
    o String propA
}

abstract concept SubAbstractB extends BaseAbstract {
    o String propB
}

concept SubConcreteB1 extends SubAbstractB {
    o String propB1
}

concept ConcreteBase {
    o String baseProp
}

concept ConcreteSub extends ConcreteBase {
    o String subProp
}

concept UnrelatedConcept {
    o String other
}

@template
concept MultiPropTemplate {
    o String title
    o Integer count
    o Boolean active
}

concept ExplicitTemplate {
    o String customField
}
`;

describe('src/utils.ts unit test suite', () => {
    let modelManager: ModelManager;

    beforeAll(() => {
        modelManager = new ModelManager();
        modelManager.addCTOModel(HIERARCHY_MODEL, 'hierarchy.cto');
    });

    describe('getAssignableConcreteTypes', () => {
        test('abstract base excludes itself and abstract descendants, but includes concrete descendants', () => {
            const types = getAssignableConcreteTypes(modelManager, `${MODEL_NS}.BaseAbstract`);
            const typeNames = types.map(t => t.getName()).sort();

            expect(typeNames).toEqual(['SubConcreteA', 'SubConcreteB1']);
            expect(types.every(t => !t.isAbstract())).toBe(true);
            expect(types.some(t => t.getName() === 'BaseAbstract')).toBe(false);
            expect(types.some(t => t.getName() === 'SubAbstractB')).toBe(false);
        });

        test('concrete base includes itself and concrete subclasses', () => {
            const types = getAssignableConcreteTypes(modelManager, `${MODEL_NS}.ConcreteBase`);
            const typeNames = types.map(t => t.getName()).sort();

            expect(typeNames).toEqual(['ConcreteBase', 'ConcreteSub']);
            expect(types.every(t => !t.isAbstract())).toBe(true);
        });

        test('missing or unregistered base FQN returns an empty array cleanly', () => {
            const types = getAssignableConcreteTypes(modelManager, `${MODEL_NS}.NonExistentType`);
            expect(types).toEqual([]);
        });
    });

    describe('isAssignableTo', () => {
        test('returns true for exact concrete class match', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.ConcreteBase`, `${MODEL_NS}.ConcreteBase`)).toBe(true);
        });

        test('returns true for direct concrete subclass', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.SubConcreteA`, `${MODEL_NS}.BaseAbstract`)).toBe(true);
            expect(isAssignableTo(modelManager, `${MODEL_NS}.ConcreteSub`, `${MODEL_NS}.ConcreteBase`)).toBe(true);
        });

        test('returns true for indirect concrete subclass', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.SubConcreteB1`, `${MODEL_NS}.BaseAbstract`)).toBe(true);
        });

        test('returns false for unrelated class', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.UnrelatedConcept`, `${MODEL_NS}.BaseAbstract`)).toBe(false);
            expect(isAssignableTo(modelManager, `${MODEL_NS}.ConcreteBase`, `${MODEL_NS}.BaseAbstract`)).toBe(false);
        });

        test('returns false when candidate is abstract', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.BaseAbstract`, `${MODEL_NS}.BaseAbstract`)).toBe(false);
            expect(isAssignableTo(modelManager, `${MODEL_NS}.SubAbstractB`, `${MODEL_NS}.BaseAbstract`)).toBe(false);
        });

        test('returns false when candidate class is unregistered', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.MissingCandidate`, `${MODEL_NS}.BaseAbstract`)).toBe(false);
        });

        test('returns false when base class is unregistered', () => {
            expect(isAssignableTo(modelManager, `${MODEL_NS}.ConcreteSub`, `${MODEL_NS}.MissingBase`)).toBe(false);
        });
    });

    describe('ensureDirSync and removeSync', () => {
        let tempBaseDir: string;

        beforeEach(() => {
            tempBaseDir = path.join(os.tmpdir(), `template-engine-utils-test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
        });

        afterEach(() => {
            removeSync(tempBaseDir);
        });

        test('ensureDirSync creates deeply nested directories', () => {
            const nestedPath = path.join(tempBaseDir, 'level1', 'level2', 'level3');
            expect(existsSync(nestedPath)).toBe(false);

            ensureDirSync(nestedPath);
            expect(existsSync(nestedPath)).toBe(true);

            // Calling again on an existing directory should not throw (idempotent)
            expect(() => ensureDirSync(nestedPath)).not.toThrow();
            expect(existsSync(nestedPath)).toBe(true);
        });

        test('removeSync recursively removes nested directories and files', () => {
            const nestedPath = path.join(tempBaseDir, 'sub1', 'sub2');
            ensureDirSync(nestedPath);

            const filePath = path.join(nestedPath, 'test.txt');
            writeFileSync(filePath, 'hello');
            expect(existsSync(filePath)).toBe(true);

            removeSync(tempBaseDir);
            expect(existsSync(tempBaseDir)).toBe(false);
        });

        test('removeSync does not throw when removing a non-existent path', () => {
            const nonExistentPath = path.join(tempBaseDir, 'does-not-exist');
            expect(() => removeSync(nonExistentPath)).not.toThrow();
        });
    });

    describe('writeFunctionToString', () => {
        test('formats function string with header, typed signature, property unpacks, and trimmed code', () => {
            const templateClass = modelManager.getType(`${MODEL_NS}.MultiPropTemplate`);
            const fnName = 'formula_test_123';
            const returnType = 'boolean';
            const userCode = '   \n return count > 10 && active; \n  ';

            const output = writeFunctionToString(templateClass, fnName, returnType, userCode);

            // Header and boundary marker
            expect(output.startsWith('/// ---cut---\n')).toBe(true);

            // Signature
            expect(output).toContain(`export function ${fnName}(data:TemplateModel.IMultiPropTemplate, library:any, options:GenerationOptions) : ${returnType} {`);

            // Standard options initialization
            expect(output).toContain('const now = dayjs(options?.now);');
            expect(output).toContain('const locale = options?.locale;');

            // Property extraction for all multi-properties
            expect(output).toContain('const title = data.title;');
            expect(output).toContain('const count = data.count;');
            expect(output).toContain('const active = data.active;');

            // Trimmed user code body
            expect(output).toContain('return count > 10 && active;');
            expect(output.endsWith('}\n\n')).toBe(true);
        });
    });

    describe('nameUserCode', () => {
        test('assigns condition_ functionName based on AST traversal path to conditions', () => {
            const ast = {
                $class: `${TemplateMarkModel.NAMESPACE}.ContractDefinition`,
                name: 'top',
                nodes: [
                    {
                        $class: `${TemplateMarkModel.NAMESPACE}.ConditionalDefinition`,
                        name: 'condNode',
                        condition: {
                            $class: `${TemplateMarkModel.NAMESPACE}.Code`,
                            contents: 'return true;'
                        }
                    },
                    {
                        $class: `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
                        name: 'clauseWithCond',
                        condition: {
                            $class: `${TemplateMarkModel.NAMESPACE}.Code`,
                            contents: 'return active;'
                        },
                        nodes: [
                            {
                                $class: `${TemplateMarkModel.NAMESPACE}.VariableDefinition`,
                                name: 'title'
                            }
                        ]
                    },
                    {
                        $class: `${TemplateMarkModel.NAMESPACE}.ClauseDefinition`,
                        name: 'clauseWithoutCond',
                        nodes: [
                            {
                                $class: `${TemplateMarkModel.NAMESPACE}.VariableDefinition`,
                                name: 'count'
                            }
                        ]
                    }
                ]
            };

            const result = nameUserCode(ast);

            // ConditionalDefinition with condition receives functionName matching path
            expect(result.nodes[0].functionName).toBe('condition_nodes_0');

            // ClauseDefinition with condition receives functionName matching path
            expect(result.nodes[1].functionName).toBe('condition_nodes_1');

            // Nodes without conditions remain unchanged (no functionName added)
            expect(result.nodes[1].nodes[0].functionName).toBeUndefined();
            expect(result.nodes[2].functionName).toBeUndefined();
            expect(result.nodes[2].nodes[0].functionName).toBeUndefined();
        });
    });

    describe('getTemplateClassDeclaration', () => {
        test('finds the @template concept when no FQN is supplied', () => {
            const decl = getTemplateClassDeclaration(modelManager);
            expect(decl.getName()).toBe('MultiPropTemplate');
            expect(decl.getFullyQualifiedName()).toBe(`${MODEL_NS}.MultiPropTemplate`);
        });

        test('resolves an explicitly supplied template concept FQN', () => {
            const decl = getTemplateClassDeclaration(modelManager, `${MODEL_NS}.ExplicitTemplate`);
            expect(decl.getName()).toBe('ExplicitTemplate');
            expect(decl.getFullyQualifiedName()).toBe(`${MODEL_NS}.ExplicitTemplate`);
        });

        test('throws when no template concept exists and no FQN is supplied', () => {
            const emptyMm = new ModelManager();
            emptyMm.addCTOModel(`namespace empty@1.0.0
concept PlainConcept {
    o String foo
}`, 'empty.cto');

            expect(() => getTemplateClassDeclaration(emptyMm)).toThrow();
        });
    });
});

describe('wrapExpressionWithReturn', () => {
    test('wraps a bare expression with return', () => {
        expect(wrapExpressionWithReturn(ts, 'importerLOCAmount / 2.0')).toBe('return importerLOCAmount / 2.0;');
    });

    test('leaves explicit top-level return unchanged', () => {
        const code = 'const x = 1;\nreturn x + 2;';
        expect(wrapExpressionWithReturn(ts, code)).toBe(code);
    });

    test('wraps when only a nested function/arrow contains return (regression for #146 follow-up)', () => {
        const code = '[1,2,3].map(x => { return x*2 })[0]';
        expect(wrapExpressionWithReturn(ts, code)).toBe('return [1,2,3].map(x => { return x*2 })[0];');
    });

    test('wraps only the trailing expression of a multi-statement body', () => {
        const code = 'const x = 1;\nconst y = 2;\nx + y';
        expect(wrapExpressionWithReturn(ts, code)).toBe('const x = 1;\nconst y = 2;\nreturn x + y;');
    });

    test('leaves a statements-only body (no trailing expression) unchanged', () => {
        const code = 'const x = 1;\nconst y = 2;';
        expect(wrapExpressionWithReturn(ts, code)).toBe(code);
    });

    test('leaves code with syntax errors unchanged', () => {
        const code = 'THIS IS GARBAGE';
        expect(wrapExpressionWithReturn(ts, code)).toBe(code);
    });

    test('returns an empty string as-is', () => {
        expect(wrapExpressionWithReturn(ts, '')).toBe('');
        expect(wrapExpressionWithReturn(ts, '   \n\t  ')).toBe('');
    });
});
