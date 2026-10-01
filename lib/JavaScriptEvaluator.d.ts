import { EventEmitter } from 'node:events';
export type EvalOptions = {
    timeout: number;
};
export type EvalRequest = {
    verbose?: boolean;
    templateLogic?: boolean;
    code: string;
    functionName?: string;
    argumentNames: string[];
    arguments: any[];
};
type WorkItem = {
    pid?: number;
    startTime: number;
    expireTime: number;
    request: EvalRequest;
    resolve: (result: any) => void;
    reject: (result: any) => void;
};
export type EvalResponse = {
    result: any;
    timeout?: boolean;
    starvation?: boolean;
    message?: string;
    stack?: string;
    elapsed?: number;
    maxQueueDepthExceeded?: boolean;
};
export type JavaScriptEvaluatorOptions = {
    waitInterval: number;
    maxWorkers: number;
    maxQueueDepth: number;
};
type ChildProcess = {
    pid?: number;
} & EventEmitter;
export declare const dynamicImport: <T>(path: string, symbol?: string) => Promise<any>;
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
export declare class JavaScriptEvaluator {
    options: JavaScriptEvaluatorOptions;
    workers: Array<ChildProcess>;
    queue: Array<WorkItem>;
    constructor(options?: JavaScriptEvaluatorOptions);
    /**
     * Evaluates a JS function in process.
     * @param {EvalRequest} request - the eval request
     * @returns {Promise} a promise to the result
     */
    evalDangerously(request: EvalRequest): Promise<EvalResponse>;
    /**
     * Evaluates a JS function using a node child process
     * @param {EvalRequest} request the eval request
     * @param {EvalOptions} options the options for the request
     * @returns {Promise<EvalResponse>} the async result
     */
    evalChildProcess(request: EvalRequest, options?: EvalOptions): Promise<EvalResponse>;
    private processQueue;
    private getWorkerPath;
    private doWork;
}
export {};
