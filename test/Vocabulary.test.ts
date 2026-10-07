import { ModelManager } from '@accordproject/concerto-core';
import { VocabularyManager } from '@accordproject/concerto-vocabulary';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { Template } from '@accordproject/cicero-core';
import { readFileSync } from 'fs';
import path from 'path';
import { TemplateMarkInterpreter } from '../src';
import { TemplateData } from '../src/TemplateMarkNodes';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

const MONEY_MODEL_FILES = [
    '@models.accordproject.org.money@0.3.0.cto',
    '@models.accordproject.org.money@1.0.0.cto'
];

const NOW = '2023-03-17T00:00:00.000Z';
const LATE_DELIVERY_DIR = 'test/archives/latedeliveryandpenalty-typescript';

const SAMPLE_MODEL = `namespace org.acme@1.0.0
@template
concept Sample {
    o String name
}`;

const SAMPLE_TEMPLATE = 'The customer name is {{name}}.';

const SAMPLE_DATA = {
    $class: 'org.acme@1.0.0.Sample',
    name: 'Alice'
};

const SAMPLE_VOCABULARY = `namespace: org.acme@1.0.0
locale: fr
declarations:
  - Sample: Client
    properties:
      - name: Nom
`;

const INSURANCE_VOCABULARY = `namespace: com.acme.insurance.auto@1.0.0
locale: fr
declarations:
  - ItemType: Type d'objet
    properties:
      - CAR: voiture
      - ACCESSORIES: accessoires
      - SPARE_PARTS: pièces détachées
  - BenefitType: Type de prestation
    properties:
      - REPAIRING: réparation
      - REPLACING: remplacement
`;

const TEMPORAL_UNIT_VOCABULARY = `namespace: org.accordproject.time@0.3.0
locale: fr
declarations:
  - TemporalUnit: Unité de temps
    properties:
      - seconds: secondes
      - minutes: minutes
      - hours: heures
      - days: jours
      - weeks: semaines
`;

function createModelManager(models: Array<{ contents: string, name: string }>): ModelManager {
    const modelManager = new ModelManager();
    MONEY_MODEL_FILES.forEach(file => {
        modelManager.addCTOModel(readFileSync(path.join(__dirname, 'models', file), 'utf-8'), file);
    });
    models.forEach(model => modelManager.addCTOModel(model.contents, model.name));
    return modelManager;
}

function createVocabularyManager(vocabularies: string[]): VocabularyManager {
    const vocabularyManager = new VocabularyManager();
    vocabularies.forEach(vocabulary => vocabularyManager.addVocabulary(vocabulary));
    return vocabularyManager;
}

/**
 * Collects every string value stored under the given fields of a JSON document.
 */
function collectStrings(node: unknown, fields: string[], out: string[] = []): string[] {
    if (Array.isArray(node)) {
        node.forEach(child => collectStrings(child, fields, out));
    }
    else if (node && typeof node === 'object') {
        Object.entries(node).forEach(([key, value]) => {
            if (fields.includes(key) && typeof value === 'string') {
                out.push(value);
            }
            else {
                collectStrings(value, fields, out);
            }
        });
    }
    return out;
}

async function generate(modelManager: ModelManager, template: string, data: TemplateData, options: Record<string, unknown> = {}): Promise<unknown> {
    const engine = new TemplateMarkInterpreter(modelManager, {});
    const templateMarkTransformer = new TemplateMarkTransformer();
    const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate({ content: template }, modelManager, 'contract', { verbose: false });
    const ciceroMark = await engine.generate(templateMarkDom, data, { now: NOW, ...options });
    return ciceroMark.toJSON();
}

const LATE_DELIVERY_DATA = {
    '$class': 'io.clause.latedeliveryandpenalty@0.1.0.TemplateModel',
    'forceMajeure': true,
    'penaltyDuration': {
        '$class': 'org.accordproject.time@0.3.0.Duration',
        'amount': 2,
        'unit': 'days'
    },
    'penaltyPercentage': 10.5,
    'capPercentage': 55,
    'termination': {
        '$class': 'org.accordproject.time@0.3.0.Duration',
        'amount': 15,
        'unit': 'days'
    },
    'fractionalPart': 'days',
    'clauseId': 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8',
    '$identifier': 'c88e5ed7-c3e0-4249-a99c-ce9278684ac8'
};

describe('vocabulary terms (issue #10)', () => {
    jest.setTimeout(30000);

    test('should prepend the localized label of a property to its value', async () => {
        const modelManager = createModelManager([{ contents: SAMPLE_MODEL, name: 'model.cto' }]);
        const result = await generate(modelManager, SAMPLE_TEMPLATE, SAMPLE_DATA, {
            locale: 'fr',
            vocabularyManager: createVocabularyManager([SAMPLE_VOCABULARY])
        });
        expect(collectStrings(result, ['value'])).toContain('Nom: Alice');
    });

    test('should render enum values with their localized vocabulary term', async () => {
        const model = readFileSync('./test/templates/good/insurance_fr/model.cto', 'utf-8');
        const template = readFileSync('./test/templates/good/insurance_fr/template.md', 'utf-8');
        const data = JSON.parse(readFileSync('./test/templates/good/insurance_fr/data.json', 'utf-8'));
        const modelManager = createModelManager([{ contents: model, name: 'model.cto' }]);
        const result = await generate(modelManager, template, data, {
            locale: 'fr',
            vocabularyManager: createVocabularyManager([INSURANCE_VOCABULARY])
        });

        // enum variables are replaced by their localized term
        const values = collectStrings(result, ['value']);
        expect(values).toContain('réparation');
        expect(values).toContain('remplacement');
        expect(values).not.toContain('REPAIRING');
        expect(values).not.toContain('REPLACING');

        // enum values joined into text are localized (the example from issue #10)
        const texts = collectStrings(result, ['text']);
        expect(texts).toContain(new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' })
            .format(['voiture', 'accessoires', 'pièces détachées']));
        expect(texts).not.toContain('CAR, ACCESSORIES et SPARE_PARTS');

        // enums without a vocabulary term keep their raw value
        expect(texts).toContain(new Intl.ListFormat('fr', { style: 'long', type: 'disjunction' })
            .format(['DAMAGED', 'LOST', 'STOLEN']));
    });

    test('should fall back from a region qualified locale to the base locale', async () => {
        const modelManager = createModelManager([{ contents: SAMPLE_MODEL, name: 'model.cto' }]);
        const result = await generate(modelManager, SAMPLE_TEMPLATE, SAMPLE_DATA, {
            locale: 'fr-CA',
            vocabularyManager: createVocabularyManager([SAMPLE_VOCABULARY])
        });
        expect(collectStrings(result, ['value'])).toContain('Nom: Alice');
    });

    test('should keep the raw value when no term exists for the locale', async () => {
        const modelManager = createModelManager([{ contents: SAMPLE_MODEL, name: 'model.cto' }]);
        const result = await generate(modelManager, SAMPLE_TEMPLATE, SAMPLE_DATA, {
            locale: 'de',
            vocabularyManager: createVocabularyManager([SAMPLE_VOCABULARY])
        });
        expect(collectStrings(result, ['value'])).toContain('Alice');
        expect(collectStrings(result, ['value'])).not.toContain('Nom');
    });

    test('should keep the raw value when no vocabulary is provided', async () => {
        const modelManager = createModelManager([{ contents: SAMPLE_MODEL, name: 'model.cto' }]);
        const result = await generate(modelManager, SAMPLE_TEMPLATE, SAMPLE_DATA, { locale: 'fr' });
        expect(collectStrings(result, ['value'])).toContain('Alice');
        expect(collectStrings(result, ['value'])).not.toContain('Nom');
    });

    test('should draft a template with vocabulary terms', async () => {
        const template = await Template.fromDirectory(LATE_DELIVERY_DIR, { offline: true });
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const result = await templateArchiveProcessor.draft(LATE_DELIVERY_DATA, 'markdown', {
            locale: 'fr',
            vocabularyManager: createVocabularyManager([TEMPORAL_UNIT_VOCABULARY])
        });
        expect(result).toContain('Any fractional part of a jours is to be considered a full jours.');
        expect(result).not.toContain('of a days');
    });

    test('should draft a template with raw values when no vocabulary is provided', async () => {
        const template = await Template.fromDirectory(LATE_DELIVERY_DIR, { offline: true });
        const templateArchiveProcessor = new TemplateArchiveProcessor(template);
        const result = await templateArchiveProcessor.draft(LATE_DELIVERY_DATA, 'markdown', {});
        expect(result).toContain('Any fractional part of a days is to be considered a full days.');
    });
});
