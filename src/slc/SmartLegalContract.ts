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

// The contract a template's logic/logic.ts implements. This file is the single
// source for these declarations: the package exports them, and
// TypeScriptCompilationContext type-checks template logic against the same text
// (embedded by scripts/updateRuntimeDependencies.js), with the runtime bounds
// block below replaced by unions derived from the template's model. Keep this
// file free of imports, because it is compiled inside each template's context.

export interface IConcept {
    $class: string;
}

export interface ITransaction extends IConcept {
    $timestamp: string;
}

export interface IEvent extends IConcept {
    $timestamp: string;
}

export interface IState {
    $identifier: string;
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

// @runtime-bounds-start
// The State, Request, Response and Event types a template's logic may use. When
// a template is compiled, TypeScriptCompilationContext replaces this block with
// the concrete types from the template's model that extend each base.
export type RuntimeState = IState;
export type RuntimeRequest = IRequest;
export type RuntimeResponse = IResponse;
export type RuntimeEvent = IEvent;
// @runtime-bounds-end

export interface EngineResponse<S extends RuntimeState = RuntimeState> {
    state?: S;
    events?: Array<RuntimeEvent>
}

export interface TriggerResponse<S extends RuntimeState = RuntimeState> extends EngineResponse<S> {
    result: RuntimeResponse;
}

export interface InitResponse<S extends RuntimeState = RuntimeState> extends EngineResponse<S> {}

export type TemplateData = IContract|IClause;

export abstract class TemplateLogic<T extends TemplateData, S extends RuntimeState = RuntimeState> {
    abstract trigger(data: T, request: RuntimeRequest, state:S) : Promise<TriggerResponse<S>>;
    // A concrete (stub) implementation, so the class has a runtime value that
    // template logic can extend and templates without state need not override.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    init(data: T) : Promise<InitResponse<S>|undefined> { return Promise.resolve(undefined); }
}
