import dayjs from 'dayjs';
import { JavaScriptEvaluator } from '../src/JavaScriptEvaluator';
import os from 'os';

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
        for(let n=0; n < 1000; n++) {
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