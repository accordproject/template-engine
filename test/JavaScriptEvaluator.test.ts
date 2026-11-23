import dayjs from 'dayjs';
import { JavaScriptEvaluator } from '../src/JavaScriptEvaluator';
import os from 'os';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SECONDS = 1000;
jest.setTimeout(70 * SECONDS)

const now = '2023-03-17T00:00:00.000Z';

// simple
const SIMPLE = {code: 'return a+b', argumentNames: ['a', 'b'], arguments: [1,2]};
const SIMPLE_RESULT = {result: 3};

// // now
const NOW = {code: 'return dayjs(now).year() + a', argumentNames: ['a', 'now'], arguments: [1, now]};
const NOW_RESULT = {result: dayjs(now).year()+1};

// infinite
const INFINITE = {code: 'while(true); return 42;', argumentNames: [], arguments: []};
const INFINITE_RESULT = {timeout: true};

// exception
const EXCEPTION = {code: 'throw "my error"; return 42;', argumentNames: [], arguments: []};
const EXCEPTION_RESULT = {code: 1, result: {message: 'my error'}};

const OPEN_HANDLE = {code: 'setInterval(() => {}, 1000); return 42;', argumentNames: [], arguments: []};
const OPEN_HANDLE_ERROR = {code: 'setInterval(() => {}, 1000); throw "my error";', argumentNames: [], arguments: []};

// crash - faking a successful return
const CRASH = {code: 'process.exit(); return 42;', argumentNames: [], arguments: []};
const CRASH_RESULT = {code: 0, result: undefined};

// crash - unsuccessful return
const CRASH_ERROR = {code: 'process.exit(1); return 42;', argumentNames: [], arguments: []};
const CRASH_ERROR_RESULT = {code: 1, result: undefined};

const availableProcessors = os.availableParallelism();
const javaScriptEvaluator = new JavaScriptEvaluator({
    maxWorkers: availableProcessors, // how many child processes
    waitInterval: 50, // how long to wait before rescheduling work
    maxQueueDepth: 1000 // how many requests to queue
});

describe('javascript evaluator', () => {
    test('should pass stress test with javascript safe', async () => {
        const promises = [];
        for(let n=0; n < 100; n++) {
            const p = javaScriptEvaluator.evalChildProcess(SIMPLE, {timeout: 60000});
            promises.push(p);
        }
        return Promise.all(promises)
            .catch((error:any) => {
                expect(error).toBeFalsy();
            });
    }, 60000);
    test('should eval simple javascript safe', async () => {
        const result = await javaScriptEvaluator.evalChildProcess(SIMPLE);
        delete result.elapsed;
        expect(result).toEqual(SIMPLE_RESULT);
    });
    test('should eval simple javascript danger', async () => {
        const result = await javaScriptEvaluator.evalDangerously(SIMPLE);
        delete result.elapsed;
        expect(result).toEqual(SIMPLE_RESULT);
    });
    test('should eval now javascript safe', async () => {
        const result = await javaScriptEvaluator.evalChildProcess(NOW);
        delete result.elapsed;
        expect(result).toEqual(NOW_RESULT);
    });
    test('should eval now javascript danger', async () => {
        const result = await javaScriptEvaluator.evalDangerously(NOW);
        delete result.elapsed;
        expect(result).toEqual(NOW_RESULT);
    });
    test('should eval infinite javascript safe', async () => {
        try {
            await javaScriptEvaluator.evalChildProcess(INFINITE, {timeout: 1000});
            expect(false).toBeTruthy();
        }
        catch(err:any) {
            delete err.elapsed;
            expect(err).toEqual(INFINITE_RESULT);
        }
    });
    test('should eval exception javascript safe', async () => {
        try {
            await javaScriptEvaluator.evalChildProcess(EXCEPTION);
            expect(false).toBeTruthy();
        }
        catch(err:any) {
            delete err.elapsed;
            expect(err).toEqual(EXCEPTION_RESULT);
        }
    });
    test('should exit after successful code leaves an open handle', async () => {
        const result = await javaScriptEvaluator.evalChildProcess(OPEN_HANDLE, {timeout: 1000});
        delete result.elapsed;
        expect(result).toEqual({result: 42});
    });
    test('should exit after failing code leaves an open handle', async () => {
        try {
            await javaScriptEvaluator.evalChildProcess(OPEN_HANDLE_ERROR, {timeout: 1000});
            expect(false).toBeTruthy();
        }
        catch(err:any) {
            delete err.elapsed;
            expect(err).toEqual(EXCEPTION_RESULT);
        }
    });
    test('should eval crash javascript safe', async () => {
        try {
            await javaScriptEvaluator.evalChildProcess(CRASH);
            expect(false).toBeTruthy();
        }
        catch(err:any) {
            delete err.elapsed;
            expect(err).toEqual(CRASH_RESULT);
        }
    });
    test('should eval crash error javascript safe', async () => {
        try {
            await javaScriptEvaluator.evalChildProcess(CRASH_ERROR);
            expect(false).toBeTruthy();
        }
        catch(err:any) {
            delete err.elapsed;
            expect(err).toEqual(CRASH_ERROR_RESULT);
        }
    });
});

describe('javascript evaluator in-process error normalization', () => {
    test('preserves exact Error reference equality through evaluation', async () => {
        const originalError = new TypeError('original failure');

        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw err;',
            argumentNames: ['err'],
            arguments: [originalError]
        });

        const caught = await promise.catch(error => error);

        expect(caught).toBe(originalError);
    });

    test('preserves standard Error instance, message, and stack trace', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw new Error("standard error");',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('standard error');
        expect(err.stack).toContain('standard error');
        expect(String(err)).toBe('Error: standard error');
    });

    test('preserves Error subclasses and their specific prototypes', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw new RangeError("index out of bounds");',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(RangeError);
        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.name).toBe('RangeError');
        expect(err.message).toBe('index out of bounds');
        expect(String(err)).toBe('RangeError: index out of bounds');
    });

    test('preserves nested Error cause', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw new Error("outer error", { cause: new TypeError("inner root cause") });',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('outer error');
        expect((err as any).cause).toBeInstanceOf(TypeError);
        expect(((err as any).cause as TypeError).message).toBe('inner root cause');
    });

    test('normalizes primitive string throws into an Error', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw "string failure";',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('string failure');
        expect(String(err)).toBe('Error: string failure');
    });

    test('normalizes null, undefined, and number throws into Error instances', async () => {
        const nullPromise = javaScriptEvaluator.evalDangerously({
            code: 'throw null;',
            argumentNames: [],
            arguments: []
        });
        await expect(nullPromise).rejects.toBeInstanceOf(Error);
        const nullErr = await nullPromise.catch(e => e);
        expect(nullErr.message).toBe('null');

        const undefinedPromise = javaScriptEvaluator.evalDangerously({
            code: 'throw undefined;',
            argumentNames: [],
            arguments: []
        });
        await expect(undefinedPromise).rejects.toBeInstanceOf(Error);
        const undefErr = await undefinedPromise.catch(e => e);
        expect(undefErr.message).toBe('undefined');

        const numberPromise = javaScriptEvaluator.evalDangerously({
            code: 'throw 404;',
            argumentNames: [],
            arguments: []
        });
        await expect(numberPromise).rejects.toBeInstanceOf(Error);
        const numErr = await numberPromise.catch(e => e);
        expect(numErr.message).toBe('404');
    });

    test('normalizes plain object with message property and preserves it as cause', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw { message: "custom object error", code: "ERR_CUSTOM" };',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('custom object error');
        expect(err.cause).toEqual({ message: 'custom object error', code: 'ERR_CUSTOM' });
    });

    test('safely normalizes hostile objects with throwing getters', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw { get message() { throw new Error("getter bomb"); }, toString() { throw new Error("toString bomb"); } };',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('[Unserializable value]');
    });

    test('retains enumerable message and stack so JSON.stringify serializes diagnostics', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'throw new Error("serializable diagnostic");',
            argumentNames: [],
            arguments: []
        });

        const err = await promise.catch(e => e);
        const json = JSON.stringify(err);
        expect(json).toContain('"message":"serializable diagnostic"');
        expect(json).toContain('"stack"');
    });

    test('normalizes compilation SyntaxError from new Function', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            code: 'const a = {;',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(SyntaxError);
        const err = await promise.catch(e => e);
        expect(err.message).toBeTruthy();
    });

    test('normalizes explicit missing function name rejection in templateLogic path', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            templateLogic: true,
            code: 'export default class MyLogic {}',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('No function name specified for template logic');
    });

    test('normalizes module dynamic import failure in templateLogic path', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            templateLogic: true,
            functionName: 'trigger',
            code: 'export default class ??? syntax error',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(Error);
        const err = await promise.catch(e => e);
        expect(err.message).toBeTruthy();
    });

    test('normalizes constructor failure in templateLogic path', async () => {
        const promise = javaScriptEvaluator.evalDangerously({
            templateLogic: true,
            functionName: 'trigger',
            code: 'export default class FailingLogic { constructor() { throw new TypeError("constructor exploded"); } }',
            argumentNames: [],
            arguments: []
        });

        await expect(promise).rejects.toBeInstanceOf(TypeError);
        const err = await promise.catch(e => e);
        expect(err.message).toBe('constructor exploded');
    });
});
