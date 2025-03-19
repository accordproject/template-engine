import { ModelManager } from '@accordproject/concerto-core';
import { TemplateMarkInterpreter } from '../src/TemplateMarkInterpreter';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';

describe('Issue #11: Unguarded Optional Variables', () => {
    let modelManager: ModelManager;
    let interpreter: TemplateMarkInterpreter;
    let templateMarkTransformer: any;

    beforeEach(async () => {
        modelManager = new ModelManager({ strict: true });
        const MODEL =
      'namespace hello@1.0.0\n@template\nconcept HelloWorld {\n    o String name\n    o String last optional\n}';
        modelManager.addCTOModel(MODEL, 'hello.cto', true);
        await modelManager.updateExternalModels();
        interpreter = new TemplateMarkInterpreter(
            modelManager,
            {},
            'hello@1.0.0.HelloWorld'
        );
        templateMarkTransformer = new TemplateMarkTransformer();
    });

    it('should throw compile-time error for unguarded optional variable', () => {
        const TEMPLATE =
      'Hello {{name}}!\nToday is **{{% return now.toISOString() %}}**.\n{{last}}';
        const templateMark = templateMarkTransformer.fromMarkdownTemplate(
            { content: TEMPLATE, templateConceptFqn: 'hello@1.0.0.HelloWorld' },
            modelManager,
            'contract',
            { verbose: false }
        );
        expect(() => interpreter.checkTypes(templateMark)).toThrow(
            'Optional property \'last\' used in template without a guard (e.g., {{#optional last}} or {{#if last}}).'
        );
    });
});
