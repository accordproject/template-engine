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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { Template } from '@accordproject/cicero-core';
import { TemplateArchiveProcessor } from '../../src/TemplateArchiveProcessor';

/*
 * Runner for the determinism conformance vectors described in docs/sandbox.md.
 *
 * The vectors are engine-independent JSON. This runner maps them onto the
 * current TemplateArchiveProcessor: step 0 calls init() and each later step
 * calls trigger(). A step that throws is a Fault; one that returns is Committed.
 */

const ROOT = 'test/determinism';
const ARCHIVES = path.join(ROOT, 'archives');
const VECTORS = path.join(ROOT, 'vectors');
const SPEC = 'docs/sandbox.md';

/*
 * Vectors that this engine does not pass yet, because it runs template logic
 * without a sandbox (#228). A test here passes while the gap remains, and fails
 * once the engine conforms, so the vector can be moved out of this list.
 */
const KNOWN_GAPS = new Set([
    'date-now', 'date-constructor', 'date-parse', 'performance-now', 'process-hrtime',
    'dayjs-now', 'dayjs-format',
    'math-random', 'crypto-random-uuid', 'crypto-get-random-values',
    'set-timeout', 'set-interval', 'set-immediate',
    'weak-ref', 'finalization-registry',
    'shared-array-buffer', 'atomics',
    'fetch', 'process-env',
    'caught-denial',
    ...['acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh', 'atan2', 'cbrt', 'cos', 'cosh',
        'exp', 'expm1', 'hypot', 'log', 'log1p', 'log10', 'log2', 'pow', 'sin', 'sinh',
        'tan', 'tanh'].map(fn => `math-${fn}`),
]);

type Step = {
    request: any;
    inputs: { now: string; [key: string]: any };
    expect: { result: 'Committed' | 'Rejection' | 'Fault'; body?: any };
};

type Vector = {
    id: string;
    semantics: string;
    recorded: boolean;
    archives: string[];
    agreement: {
        agreementId: string;
        primary: string;
        documents: { documentId: string; template: { hash: string }; data: any }[];
    };
    steps: Step[];
};

/**
 * Serialises a JSON value in the RFC 8785 canonical form: object keys sorted by
 * UTF-16 code unit, no whitespace, and ECMAScript number and string formatting.
 * @param {any} value the JSON value
 * @returns {string} the canonical JSON text
 */
function canonicalize(value: any): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function sha256(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

function listFiles(dir: string, prefix = ''): string[] {
    return readdirSync(dir).flatMap(name => {
        const rel = prefix ? `${prefix}/${name}` : name;
        return statSync(path.join(dir, name)).isDirectory() ? listFiles(path.join(dir, name), rel) : [rel];
    });
}

/**
 * The agreement-quarter template hash: sha256 of the canonical list of
 * { path, sha256 } for every file in the archive, sorted by path.
 * @param {string} dir the archive directory
 * @returns {string} the template hash
 */
function templateHash(dir: string): string {
    const entries = listFiles(dir)
        .sort()
        .map(p => ({ path: p, sha256: sha256(readFileSync(path.join(dir, p))) }));
    return sha256(canonicalize(entries));
}

function loadVectors(): Vector[] {
    return readdirSync(VECTORS)
        .filter(f => f.endsWith('.json'))
        .sort()
        .map(f => JSON.parse(readFileSync(path.join(VECTORS, f), 'utf-8')));
}

/**
 * Runs a vector against the current engine.
 * @param {Vector} vector the vector
 * @returns {Promise<string[]>} the mismatches, empty when the engine conforms
 */
async function runVector(vector: Vector): Promise<string[]> {
    const doc = vector.agreement.documents.find(d => d.documentId === vector.agreement.primary);
    if (!doc) {
        return [`primary document ${vector.agreement.primary} not found`];
    }
    const template = await Template.fromDirectory(path.join(ARCHIVES, doc.template.hash), { offline: true });
    const processor = new TemplateArchiveProcessor(template);

    const mismatches: string[] = [];
    let state: any;
    for (const [i, step] of vector.steps.entries()) {
        let result: string;
        let body: any;
        try {
            if (i === 0) {
                const init = await processor.init(doc.data, step.inputs.now, 0, true);
                state = init.state;
                body = { state };
            } else {
                const triggered = await processor.trigger(doc.data, step.request, state, step.inputs.now, 0, true);
                state = triggered.state ?? state;
                body = { response: triggered.result, state: triggered.state };
            }
            result = 'Committed';
        } catch {
            result = 'Fault';
            body = undefined;
        }

        if (result !== step.expect.result) {
            mismatches.push(`step ${i}: expected ${step.expect.result}, got ${result}`);
        } else if (step.expect.body !== undefined) {
            // the current engine has no CommittedBody, so compare only the fields given
            try {
                expect(body).toMatchObject(step.expect.body);
            } catch {
                mismatches.push(`step ${i}: body ${JSON.stringify(body)} does not match ${JSON.stringify(step.expect.body)}`);
            }
        }
    }
    return mismatches;
}

const vectors = loadVectors();

describe('determinism vectors', () => {
    test('every archive is stored under its template hash', () => {
        readdirSync(ARCHIVES).forEach(name => {
            expect(templateHash(path.join(ARCHIVES, name))).toBe(name);
        });
    });

    test('every vector names its archives and has a step 0', () => {
        vectors.forEach(v => {
            expect(v.steps.length).toBeGreaterThan(0);
            expect(v.steps[0].request).toBeNull();
            v.agreement.documents.forEach(d => {
                expect(v.archives).toContain(d.template.hash);
                expect(readdirSync(ARCHIVES)).toContain(d.template.hash);
            });
        });
    });

    test('the sandbox spec and the vectors list the same cases', () => {
        const linked = [...readFileSync(SPEC, 'utf-8').matchAll(/test\/determinism\/vectors\/([a-z0-9-]+)\.json/g)]
            .map(m => m[1]);
        expect([...new Set(linked)].sort()).toEqual(vectors.map(v => v.id).sort());
    });

    test('every known gap is a vector', () => {
        const ids = new Set(vectors.map(v => v.id));
        KNOWN_GAPS.forEach(id => expect(ids).toContain(id));
    });

    describe.each(vectors.map(v => [v.id, v] as [string, Vector]))('%s', (id, vector) => {
        if (KNOWN_GAPS.has(id)) {
            test('does not conform yet (known gap, #228)', async () => {
                const mismatches = await runVector(vector);
                if (mismatches.length === 0) {
                    throw new Error(`${id} now conforms: remove it from KNOWN_GAPS`);
                }
                // the only accepted gap is a denied use that commits instead of faulting
                mismatches.forEach(m => expect(m).toMatch(/^step [1-9]\d*: expected Fault, got Committed$/));
            });
        } else {
            test('conforms', async () => {
                expect(await runVector(vector)).toEqual([]);
            });
        }
    });
});
