import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { Template } from '@accordproject/cicero-core';
import { VocabularyManager } from '@accordproject/concerto-vocabulary';
import { TemplateArchiveProcessor } from '../src/TemplateArchiveProcessor';

// Issue #10: drafting uses the terms of a Concerto vocabulary for enum values.

const TEMPLATE_DIR = 'test/archives/vocabulary-terms';
const NOW = '2026-01-01T00:00:00.000Z';
const NS = 'org.example.cards@1.0.0';

const DATA = {
    $class: `${NS}.TemplateModel`,
    clauseId: 'c1',
    $identifier: 'c1',
    player: 'Alice',
    trump: 'HEARTS',
    suits: ['HEARTS', 'SPADES'],
    hand: [
        { $class: `${NS}.Card`, suit: 'SPADES', alternative: 'HEARTS' },
        { $class: `${NS}.Card`, suit: 'HEARTS' },
    ],
    lead: 'SPADES',
    showTrump: true,
};

/**
 * A vocabulary for the cards namespace.
 * @param {string} locale - the vocabulary's locale
 * @param {Record<string, string>} suits - the term for each Suit value
 * @param {string} [playerLabel] - a term for the `player` property
 * @returns {string} the vocabulary as YAML
 */
function vocabulary(locale: string, suits: Record<string, string>, playerLabel?: string): string {
    const values = Object.entries(suits).map(([value, term]) => `      - ${value}: "${term}"`).join('\n');
    const player = playerLabel
        ? `\n  - TemplateModel: "Model"\n    properties:\n      - player: "${playerLabel}"`
        : '';
    return `locale: ${locale}\nnamespace: ${NS}\ndeclarations:\n  - Suit: "Suit"\n    properties:\n${values}${player}\n`;
}

function manager(...vocabularies: string[]): VocabularyManager {
    const vocabularyManager = new VocabularyManager();
    vocabularies.forEach(v => vocabularyManager.addVocabulary(v));
    return vocabularyManager;
}

const FRENCH = manager(vocabulary('fr', { HEARTS: 'cœur', SPADES: 'pique', CLUBS: 'trèfle', DIAMONDS: 'carreau' }, 'Joueur'));

/**
 * Drafts the test template, with its text replaced by `grammar`, as markdown.
 * @param {string} grammar - the template text
 * @param {*} options - the draft options
 * @param {*} [data] - the template data
 * @returns {Promise<string>} the drafted markdown
 */
async function draft(grammar: string, options: Record<string, unknown>, data: Record<string, unknown> = DATA): Promise<string> {
    const dir = path.join(mkdtempSync(path.join(os.tmpdir(), 'template-engine-vocabulary-')), 'template');
    cpSync(TEMPLATE_DIR, dir, { recursive: true });
    writeFileSync(path.join(dir, 'text', 'grammar.tem.md'), grammar);
    const template = await Template.fromDirectory(dir, { offline: true });
    return new TemplateArchiveProcessor(template).draft(data, 'markdown', options, NOW);
}

describe('vocabulary terms in drafting (issue #10)', () => {
    describe.each([
        { block: 'a variable', grammar: 'Trump: {{trump}}.', terms: ['cœur'], raw: ['HEARTS'] },
        { block: 'a join', grammar: 'Suits: {{#join suits}}{{/join}}.', terms: ['cœur et pique'], raw: ['HEARTS', 'SPADES'] },
        { block: 'a list', grammar: '{{#ulist hand}}\n- {{suit}}\n{{/ulist}}\n', terms: ['pique', 'cœur'], raw: ['SPADES', 'HEARTS'] },
        { block: 'an optional', grammar: '{{#optional lead}}Lead: {{this}}.{{else}}No lead.{{/optional}}', terms: ['Lead: pique.'], raw: ['SPADES'] },
        { block: 'an if', grammar: '{{#if showTrump}}Trump: {{trump}}.{{/if}}', terms: ['Trump: cœur.'], raw: ['HEARTS'] },
        {
            block: 'an optional nested in a list',
            grammar: '{{#ulist hand}}\n- {{suit}}{{#optional alternative}} or {{this}}{{/optional}}\n{{/ulist}}\n',
            terms: ['pique or cœur', 'cœur'],
            raw: ['SPADES', 'HEARTS'],
        },
    ])('in $block', ({ grammar, terms, raw }) => {
        test('drafts each enum value as its term', async () => {
            const result = await draft(grammar, { locale: 'fr', vocabularyManager: FRENCH });
            terms.forEach(term => expect(result).toContain(term));
            raw.forEach(value => expect(result).not.toContain(value));
        });

        test('drafts the raw value without a vocabulary', async () => {
            const result = await draft(grammar, {});
            raw.forEach(value => expect(result).toContain(value));
            terms.forEach(term => expect(result).not.toContain(term));
        });
    });

    test('drafts exactly as before when a locale is given without a vocabulary', async () => {
        // A locale alone must not reach the engine: {{#join}} would format the
        // list in it ("et" instead of "and").
        const grammar = 'Suits: {{#join suits}}{{/join}}.';
        const withLocale = await draft(grammar, { locale: 'fr' });
        expect(withLocale).toEqual(await draft(grammar, {}));
        expect(withLocale).toContain('HEARTS and SPADES');
    });

    test('drafts the raw value when a vocabulary is given without a locale', async () => {
        const result = await draft('Trump: {{trump}}.', { vocabularyManager: FRENCH });
        expect(result).toContain('Trump: HEARTS.');
    });

    test('falls back from the region to the language, then to English, then to the raw value', async () => {
        const vocabularyManager = manager(
            // vocabulary files declare lowercase locales; the requested locale need not be
            vocabulary('fr-ca', { HEARTS: 'cœur (CA)' }),
            vocabulary('fr', { SPADES: 'pique' }),
            vocabulary('en', { CLUBS: 'clubs' }),
        );
        const data = { ...DATA, suits: ['HEARTS', 'SPADES', 'CLUBS', 'DIAMONDS'] };
        const result = await draft('Suits: {{#join suits}}{{/join}}.', { locale: 'fr-CA', vocabularyManager }, data);
        expect(result).toContain('Suits: cœur (CA), pique, clubs et DIAMONDS.');
    });

    test('uses the list format of a locale whose rules differ from English', async () => {
        const vocabularyManager = manager(vocabulary('ja', { HEARTS: 'ハート', SPADES: 'スペード' }));
        const result = await draft('Suits: {{#join suits}}{{/join}}.', { locale: 'ja', vocabularyManager });
        expect(result).toContain('Suits: ハート、スペード.');
    });

    test('drafts a value whose term is empty as the raw value', async () => {
        const vocabularyManager = manager(vocabulary('fr', { HEARTS: '' }));
        const result = await draft('Trump: {{trump}}.', { locale: 'fr', vocabularyManager });
        expect(result).toContain('Trump: HEARTS.');
    });

    test('does not change a value that is not an enum, even when its property has a term', async () => {
        const result = await draft('Player: {{player}}.', { locale: 'fr', vocabularyManager: FRENCH });
        expect(result).toContain('Player: Alice.');
        expect(result).not.toContain('Joueur');
    });
});
