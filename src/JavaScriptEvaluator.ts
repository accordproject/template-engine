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

export type EvalOptions = {
    timeout: number
}

export type EvalRequest = {
    code: string,
    argumentNames: string[]
    arguments: any[] // these have to be serializable to JSON!
}

export type EvalResponse = {
    result: any // success if not null
    timeout?: boolean // if true the promise is rejected
    message?: string; // if promise rejected due to a caught exception this will be set
}

export class JavaScriptEvaluator {
    static async evalDangerous(request: EvalRequest) : Promise<EvalResponse> {
        return new Promise((resolve,reject) => {
            try {
                const fun = new Function(...['dayjs', 'jp', ...request.argumentNames], request.code);
                const result = fun(...[dayjs, jp, ...request.arguments]);
                resolve({result});
            }
            catch(err:any) {
                reject({
                    message: err.message
                });
            }
        });
    }
    static async evalSafe(request: EvalRequest, options: EvalOptions = { timeout: 5000 }) : Promise<EvalResponse> {
        return new Promise((resolve, reject) => {
            // check for browser
            if(!child_process.fork) {
                reject({message: 'Cannot use evalSafe because child_process.fork is not defined.'});
            }
            // on timeout will send SIGTERM
            const worker = child_process.fork('./dist/worker.js', {timeout: options.timeout, env: {} });
            let result:any;
            worker.on('error', (err: any) => {
                reject({message: err.message});
            });
            worker.on('message', (msg: any) => {
                result = msg;
            });
            worker.on('exit', (code: any) => {
                if(code === null) {
                    reject({timeout: true});
                }
                else if (code === 0 && result) {
                    // result will be undefined
                    // if the user code called process.exit()...
                    resolve(result);
                } else {
                    reject({code, result});
                }
            });
            worker.send(request);
        });
    }
}