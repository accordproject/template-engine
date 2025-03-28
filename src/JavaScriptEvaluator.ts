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

import child_process from 'child_process';
import jp from 'jsonpath';
import dayjs from 'dayjs';
import { EventEmitter } from 'node:events';
import path from 'path';

export type EvalOptions = {
    timeout: number // timeout in milliseconds for this eval request
}

export type EvalRequest = {
    code: string, // JS code to eval
    argumentNames: string[] // names of function args
    arguments: any[] // function arg values, these have to be serializable to JSON!
}

type WorkItem = {
    pid?: number; // process if assigned to the workitem
    startTime: number; // timestamp when workitem created
    expireTime: number; // timestamp for when work must be completed
    request: EvalRequest; // payload to process
    resolve: (result: any) => void; // promise callback for success
    reject: (result: any) => void; // promise callback for failure
}

export type EvalResponse = {
    result: any // success if not null
    timeout?: boolean // if true the promise is rejected due to timeout
    starvation?: boolean // if true the promise is rejected due to lack of child process
    message?: string; // if promise rejected due to a caught exception this will be set
    elapsed?: number; // the elapsed time in ms to process the work item
    maxQueueDepthExceeded?: boolean // if true the promise is rejected because the queue is full
}

export type JavaScriptEvaluatorOptions = {
    waitInterval: number; // time to wait in ms for a free worker
    maxWorkers: number; // the max number of worker processes
    maxQueueDepth: number; // the max queue depth for the waiting queue
}

type ChildProcess = {
    pid?: number
} & EventEmitter;

async function sleep(msec: number) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

/**
 * This class implements two JS function evaluation strategies:
 * 1. evalDangerously which creates a dynamic function and run it in-process
 * This should only be used with trusted code, or within a sandbox (e.g. the browser)
 * 2. evalChildProcess which spins up a child Node process to eval the function
 * The maximum number of child processes is capped via JavaScriptEvaluatorOptions
 * as well as the maximum queue depth for the queue used to wait for a free worker
 * child process. Not that to prevent cross-request contamination
 * child processes are NOT pooled and are never reused.
 */
export class JavaScriptEvaluator {
    options: JavaScriptEvaluatorOptions;
    workers: Array<ChildProcess>; // child processes
    queue: Array<WorkItem>; // queue of work to do

    constructor(options: JavaScriptEvaluatorOptions = {waitInterval: 50, maxWorkers: 8, maxQueueDepth: 1000}) {
        this.options = options;
        this.workers = [];
        this.queue = [];
    }

    /**
     * Evaluates a JS function in process.
     * @param {EvalRequest} request - the eval request
     * @returns {Promise} a promise to the result
     */
    async evalDangerously(request: EvalRequest): Promise<EvalResponse> {
        return new Promise((resolve, reject) => {
            try {
                const start = new Date().getTime();
                const fun = new Function(...['dayjs', 'jp', ...request.argumentNames], request.code);
                const result = fun(...[dayjs, jp, ...request.arguments]);
                const end = new Date().getTime();
                resolve({ result, elapsed: end - start });
            }
            catch (err: any) {
                reject({
                    message: err.message
                });
            }
        });
    }
    /**
     * Evaluates a JS function using a node child process
     * @param {EvalRequest} request the eval request
     * @param {EvalOptions} options the options for the request
     * @returns {Promise<EvalResponse>} the async result
     */
    async evalChildProcess(request: EvalRequest, options: EvalOptions = { timeout: 10000 }): Promise<EvalResponse> {
        // console.log('Workers count: ' + this.workers.length);
        return new Promise((resolve, reject) => {
            const now = new Date().getTime();
            const workItem: WorkItem = {
                startTime: now,
                expireTime: now + options.timeout,
                request,
                resolve,
                reject
            };
            if(this.queue.length >= this.options.maxQueueDepth) {
                reject({ maxQueueDepthExceeded: true, elapsed: 0 });
            }
            this.queue.push(workItem);
            this.processQueue(options);
        });
    }
    private processQueue(options: EvalOptions) {
        const now = new Date().getTime();
        const notExpired = this.queue.filter(w => (now < w.expireTime));
        const expired = this.queue.filter(w => (now >= w.expireTime));
        this.queue = notExpired;
        expired.forEach(w => {
            w.reject({ timeout: true, starvation: true, elapsed: now - w.startTime });
        });
        if (this.workers.length < this.options.maxWorkers) {
            // we have a free worker
            const next = this.queue.shift();
            if (next) {
                this.doWork(next, options)
                    .then(result => next.resolve(result))
                    .catch(error => next.reject(error));
            }
        }
        else {
            // no free worker, so sleep and then try again
            sleep(this.options.waitInterval)
                .then(() => {
                    this.processQueue(options);
                });
        }
    }
    private getWorkerPath() : string {
        try {
            const thisPath = require.resolve('@accordproject/template-engine');
            return path.join(thisPath,'..','worker.js');
        } catch(err) { // eslint-disable-line @typescript-eslint/no-unused-vars
            // if we cannot load the module it likely means we are running
            // a unit test inside the module...
            return path.join(__dirname, '..', 'dist', 'worker.js');
        }
    }
    private doWork(work: WorkItem, options: EvalOptions): Promise<EvalResponse> {
        return new Promise((resolve, reject) => {
            const start = new Date().getTime();
            // check for browser
            if (!child_process.fork) {
                reject({ message: 'Cannot use evalChildProcess because child_process.fork is not defined.' });
            }
            // on timeout will send SIGTERM
            const workerPath = this.getWorkerPath();
            // console.debug(`Worker path: ${workerPath}`);
            const worker = child_process.fork(workerPath, { timeout: options.timeout, env: {} });
            if (!worker.pid) {
                throw new Error('Failed to fork child process');
            }
            this.workers.push(worker);
            work.pid = worker.pid;
            let result: any;
            worker.on('error', (err: any) => {
                this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                const end = new Date().getTime();
                reject({ message: err.message, elapsed: end - start });
            });
            worker.on('message', (msg: any) => {
                result = msg;
            });
            worker.on('exit', (code: any) => {
                if (code === null) {
                    this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                    const end = new Date().getTime();
                    reject({ timeout: true, elapsed: end - start });
                }
                else if (code === 0 && result) {
                    // success!
                    this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                    const end = new Date().getTime();
                    resolve({ ...result, elapsed: end - start });
                } else {
                    // null result or non-zero code from worker means an error
                    // result will be undefined if the user code calls process.exit()
                    this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                    const end = new Date().getTime();
                    reject({ code, result, elapsed: end - start });
                }
            });
            // send the request to the child process
            worker.send(work.request);
        });
    }
}
