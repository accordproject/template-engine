/* eslint-disable indent */
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
import child_process from 'child_process';
import jp from 'jsonpath';
import dayjs from 'dayjs';
import { EventEmitter } from 'node:events';

export type EvalOptions = {
    timeout: number
}

export type EvalRequest = {
    code: string,
    argumentNames: string[]
    arguments: any[] // these have to be serializable to JSON!
}

type WorkItem = {
    pid?: number;
    timerId?: any;
    startTime: number;
    expireTime: number;
    request: EvalRequest;
    resolve: (result: any) => void;
    reject: (result: any) => void;
}

export type EvalResponse = {
    result: any // success if not null
    timeout?: boolean // if true the promise is rejected
    message?: string; // if promise rejected due to a caught exception this will be set
    elapsed?: number;
}

export type JavaScriptEvaluatorOptions = {
    waitInterval: number;
    maxQueueDepth: number;
    maxWorkers: number;
}

type ChildProcess = {
    pid?: number
} & EventEmitter;

async function sleep(msec: number) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

export class JavaScriptEvaluator {
    options: JavaScriptEvaluatorOptions;
    workers: Array<ChildProcess>; // child processes
    queue: Array<WorkItem>; // queue of work to do

    constructor(options: JavaScriptEvaluatorOptions) {
        this.options = options;
        this.workers = [];
        this.queue = [];
    }

    async evalDangerous(request: EvalRequest): Promise<EvalResponse> {
        return new Promise((resolve, reject) => {
            try {
                const start = new Date().getTime();
                const fun = new Function(...['dayjs', 'jp', ...request.argumentNames], request.code);
                const result = fun(...[dayjs, jp, ...request.arguments]);
                const end = new Date().getTime();
                resolve({ result, elapsed: end-start });
            }
            catch (err: any) {
                reject({
                    message: err.message
                });
            }
        });
    }
    evalSafe(request: EvalRequest, options: EvalOptions = { timeout: 10000 }): Promise<EvalResponse> {
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
            this.processQueue(workItem, options);
        });
    }
    private processQueue(workItem: WorkItem, options: EvalOptions) {
        const now = new Date().getTime();
        if(this.queue.length > this.options.maxQueueDepth) {
            workItem.reject({ timeout: true, maxQueueDepth: true, elapsed: now - workItem.startTime });
        }
        else {
            this.queue.push(workItem);
            const notExpired = this.queue.filter(w => (now < w.expireTime));
            const expired = this.queue.filter(w => (now >= w.expireTime));
            this.queue = notExpired;
            expired.forEach(w => {
                w.reject({ timeout: true, starvation: true, elapsed: now - w.startTime });
            });
            const next = this.queue.shift();
            if (next) {
                if (this.workers.length < this.options.maxWorkers) {
                    this.doWork(next, options)
                        .then(result => next.resolve(result))
                        .catch(error => next.reject(error));
                }
                else {
                    sleep(this.options.waitInterval)
                        .then(() => {
                            this.processQueue(next, options);
                        });
                }
            }
        }
    }
    private doWork(work: WorkItem, options: EvalOptions = { timeout: 5000 }): Promise<EvalResponse> {
        return new Promise((resolve, reject) => {
            const start = new Date().getTime();
            // check for browser
            if (!child_process.fork) {
                reject({ message: 'Cannot use evalSafe because child_process.fork is not defined.' });
            }
            // on timeout will send SIGTERM
            const worker = child_process.fork('./dist/worker.js', { timeout: options.timeout, env: {} });
            this.workers.push(worker);
            if (!worker.pid) {
                throw new Error('Failed to fork child process');
            }
            work.pid = worker.pid;
            let result: any;
            worker.on('error', (err: any) => {
                this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                const end = new Date().getTime();
                reject({ message: err.message, elapsed: end-start });
            });
            worker.on('message', (msg: any) => {
                result = msg;
            });
            worker.on('exit', (code: any) => {
                if (code === null) {
                    this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                    const end = new Date().getTime();
                    reject({ timeout: true, elapsed: end-start });
                }
                else if (code === 0 && result) {
                    // result will be undefined
                    // if the user code called process.exit()...
                    this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                    const end = new Date().getTime();
                    resolve({...result, elapsed: end-start});
                } else {
                    this.workers = this.workers.filter((w: ChildProcess) => w.pid !== worker.pid);
                    const end = new Date().getTime();
                    reject({ code, result, elapsed: end-start});
                }
            });
            worker.send(work.request);
        });
    }
}