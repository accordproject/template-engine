import childProcess, { ChildProcess } from 'child_process';
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

describe('javascript evaluator request deadlines', () => {
    let evaluator: JavaScriptEvaluator;
    let workers: ChildProcess[];
    let fork: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        evaluator = new JavaScriptEvaluator({ maxWorkers: 1, waitInterval: 10, maxQueueDepth: 3 });
        workers = [];
        fork = jest.spyOn(childProcess, 'fork').mockImplementation(() => {
            const worker = Object.assign(new ChildProcess(), { pid: workers.length + 1, send: jest.fn() });
            workers.push(worker);
            return worker;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    function complete(index: number) {
        workers[index].emit('message', SIMPLE_RESULT);
        workers[index].emit('close', 0);
    }

    test('deducts time in the queue from the worker timeout', async () => {
        const first = evaluator.evalChildProcess(SIMPLE, { timeout: 1000 });
        const second = evaluator.evalChildProcess(SIMPLE, { timeout: 1000 });
        await jest.advanceTimersByTimeAsync(690);
        complete(0);
        await jest.advanceTimersByTimeAsync(10);
        complete(1);
        await Promise.all([first, second]);

        expect(fork).toHaveBeenNthCalledWith(2, expect.any(String), { timeout: 300, env: {} });
    });

    test.each([[1000, 250], [250, 1000]])(
        'uses the selected request deadline (selected timeout %i, polling timeout %i)',
        async (selectedTimeout, pollingTimeout) => {
            const first = evaluator.evalChildProcess(SIMPLE, { timeout: 2000 });
            const selected = evaluator.evalChildProcess(NOW, { timeout: selectedTimeout });
            await jest.advanceTimersByTimeAsync(11);
            const later = evaluator.evalChildProcess(SIMPLE, { timeout: pollingTimeout });
            // After the selected request polls at 20 ms, the later request polls next at 21 ms.
            await jest.advanceTimersByTimeAsync(9);
            complete(0);
            await jest.advanceTimersByTimeAsync(1);
            complete(1);
            await jest.advanceTimersByTimeAsync(9);
            complete(2);
            await Promise.all([first, selected, later]);

            expect(workers[1].send).toHaveBeenCalledWith(NOW);
            expect(fork).toHaveBeenNthCalledWith(2, expect.any(String), {
                timeout: selectedTimeout - 21, env: {}
            });
        }
    );

    test('does not fork when the deadline expires between queue selection and launch', async () => {
        const first = evaluator.evalChildProcess(SIMPLE, { timeout: 100 });
        const result = evaluator.evalChildProcess(SIMPLE, { timeout: 10 }).catch(error => error);
        complete(0);
        jest.spyOn(Date.prototype, 'getTime').mockReturnValueOnce(9); // queue selection
        await jest.advanceTimersByTimeAsync(10); // dispatch
        workers[1]?.emit('close', null);
        await first;
        const outcome = await result;

        expect(fork).toHaveBeenCalledTimes(1);
        expect(outcome).toEqual({ timeout: true, starvation: true, elapsed: 10 });
        expect(evaluator.workers).toHaveLength(0);
    });

    test('does not send work if the deadline expires during fork', async () => {
        fork.mockImplementationOnce(() => {
            const worker = Object.assign(new ChildProcess(), { pid: 1, send: jest.fn(), kill: jest.fn() });
            workers.push(worker);
            jest.setSystemTime(2);
            return worker;
        });
        const expired = evaluator.evalChildProcess(SIMPLE, { timeout: 1 }).catch(error => error);
        const waiting = evaluator.evalChildProcess(NOW, { timeout: 100 });

        expect(fork).toHaveBeenNthCalledWith(1, expect.any(String), { timeout: 1, env: {} });
        expect(fork).toHaveBeenCalledTimes(1);
        expect(workers[0].send).not.toHaveBeenCalled();
        expect(workers[0].kill).toHaveBeenCalledTimes(1);

        workers[0].emit('close', 0);
        expect(await expired).toEqual({ timeout: true, elapsed: 2 });
        await jest.advanceTimersByTimeAsync(10);
        expect(workers[1].send).toHaveBeenCalledWith(NOW);
        complete(1);
        await expect(waiting).resolves.toMatchObject(SIMPLE_RESULT);
        expect(evaluator.workers).toHaveLength(0);
    });

    test('rejects a successful worker close at the request deadline', async () => {
        const result = evaluator.evalChildProcess(SIMPLE, { timeout: 100 });
        workers[0].emit('message', SIMPLE_RESULT);
        await jest.advanceTimersByTimeAsync(100);
        workers[0].emit('close', 0);

        await expect(result).rejects.toEqual({ timeout: true, elapsed: 100 });
        expect(evaluator.workers).toHaveLength(0);
    });
});
