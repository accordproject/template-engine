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

/* eslint-disable @typescript-eslint/no-empty-object-type */

// we duplicate these interfaces here to avoid imports into the runtime
export interface IConcept {
    $class: string;
 }

export interface ITransaction extends IConcept {
    $timestamp: Date;
 }

export interface IEvent extends IConcept {
   $timestamp: Date;
}

export interface IState {
    $identifier: string;
}

export interface EngineResponse<S extends IState> {
    state?: S;
    events?: Array<IEvent>
}

export interface IRequest extends ITransaction {
}

export interface IResponse extends ITransaction {
}

export interface IAsset extends IConcept {
   $identifier: string;
}

export interface IContract extends IAsset {
   contractId: string;
}

export interface IClause extends IAsset {
   clauseId: string;
}

export interface TriggerResponse<S extends IState = IState> extends EngineResponse<S> {
    result: IResponse;
}

export interface InitResponse<S extends IState> extends EngineResponse<S> {}

export type TemplateData = IContract|IClause;

export abstract class TemplateLogic<T extends TemplateData, S extends IState = IState> {
    abstract trigger(data: T, request: IRequest, state:S) : Promise<TriggerResponse<S>>;
    abstract init(data: T) : Promise<InitResponse<S>|undefined>;
}
