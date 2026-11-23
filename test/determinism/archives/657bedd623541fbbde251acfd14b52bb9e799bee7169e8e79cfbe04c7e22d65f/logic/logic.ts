import { ITemplateModel, IProbeRequest, IProbeResponse } from "./generated/org.accordproject.determinism.probe@0.1.0";
import dayjs from 'dayjs';

/*
 * Hostile probe logic for the determinism vectors (see docs/sandbox.md).
 *
 * Each request names one probe. A hostile probe uses a global that the sandbox
 * spec denies, so under an enforcing engine the trigger must end in a Fault.
 * A control probe uses only what the spec allows, so it must give the same
 * result on every engine.
 *
 * Host globals are reached through globalThis because the logic compiles
 * against the ES2022 lib, which does not declare timers, fetch or process.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const math = Math as any;

type Probe = (data: ITemplateModel, now: string) => unknown;

// ECMA-262 lets engines approximate these, so results can differ in the last bits.
const APPROXIMATED_MATH: Record<string, number[]> = {
    acos: [0.5], acosh: [1.5], asin: [0.5], asinh: [0.5], atan: [0.5], atanh: [0.5],
    atan2: [0.5, 0.25], cbrt: [0.5], cos: [0.5], cosh: [0.5], exp: [0.5], expm1: [0.5],
    hypot: [0.5, 0.25], log: [0.5], log1p: [0.5], log10: [0.5], log2: [0.5],
    pow: [0.5, 0.25], sin: [0.5], sinh: [0.5], tan: [0.5], tanh: [0.5],
};

const PROBES: Record<string, Probe> = {
    // clocks
    'date-now': () => Date.now(),
    'date-constructor': () => new Date().toISOString(),
    'date-parse': () => new Date('2026-01-01T00:00:00Z').getTime(),
    'performance-now': () => g.performance.now(),
    'process-hrtime': () => g.process.hrtime.bigint().toString(),
    'dayjs-now': () => dayjs().format(),
    'dayjs-format': (data, now) => dayjs(now).format('YYYY-MM-DD HH:mm'),

    // randomness
    'math-random': () => Math.random(),
    'crypto-random-uuid': () => g.crypto.randomUUID(),
    'crypto-get-random-values': () => g.crypto.getRandomValues(new Uint8Array(4)).join(','),

    // timers
    'set-timeout': () => g.clearTimeout(g.setTimeout(() => undefined, 0)),
    'set-interval': () => g.clearInterval(g.setInterval(() => undefined, 1000)),
    'set-immediate': () => g.clearImmediate(g.setImmediate(() => undefined)),

    // garbage-collector observation
    'weak-ref': () => new WeakRef({}).deref() !== undefined,
    'finalization-registry': () => new FinalizationRegistry(() => undefined).register({}, 'held'),

    // shared memory
    'shared-array-buffer': () => new SharedArrayBuffer(8).byteLength,
    'atomics': () => Atomics.load(new Int32Array(4), 0),

    // I/O and host access (fetch gets a data: URL, so no network traffic happens)
    'fetch': () => g.fetch('data:text/plain,probe'),
    'xml-http-request': () => new g.XMLHttpRequest(),
    'process-env': () => Object.keys(g.process.env).length,

    // a denied call that the logic catches and hides: still a Fault (fail fast)
    'caught-denial': () => {
        try {
            return Math.random();
        } catch {
            return 'caught';
        }
    },

    // controls: deterministic on every engine
    'control-arithmetic': (data) => data.amount * 3 + 1,
    'control-math-exact': (data) => [Math.floor(data.amount / 2), Math.sqrt(16), Math.max(1, data.amount)].join(','),
    'control-host-time': (data, now) => now,
    'control-uncaught-error': () => {
        throw new Error('the template logic failed');
    },
};

Object.entries(APPROXIMATED_MATH).forEach(([fn, args]) => {
    PROBES[`math-${fn}`] = () => math[fn](...args);
});

// @ts-expect-error TemplateLogic is imported by the runtime
class ProbeLogic extends TemplateLogic<ITemplateModel> {
    async trigger(data: ITemplateModel, request: IProbeRequest, state: unknown, now: string) {
        const probe = PROBES[request.probe];
        if (!probe) {
            throw new Error(`Unknown probe: ${request.probe}`);
        }
        const result: IProbeResponse = {
            $class: 'org.accordproject.determinism.probe@0.1.0.ProbeResponse',
            $timestamp: now,
            output: String(probe(data, now)),
        };
        return { result, events: [] };
    }
}

export default ProbeLogic;
