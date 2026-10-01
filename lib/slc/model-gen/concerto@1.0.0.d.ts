import type { IDuration, IPeriod } from './org.accordproject.time@0.3.0';
import type { IState } from './org.accordproject.runtime@0.2.0';
import type { IContract, IClause } from './org.accordproject.contract@0.2.0';
import type { IRequest, IResponse } from './org.accordproject.runtime@0.2.0';
import type { IObligation } from './org.accordproject.runtime@0.2.0';
export interface IConcept {
    $class: string;
}
export type ConceptUnion = IDuration | IPeriod;
export interface IAsset extends IConcept {
    $identifier: string;
}
export type AssetUnion = IState | IContract | IClause;
export interface IParticipant extends IConcept {
    $identifier: string;
}
export interface ITransaction extends IConcept {
    $timestamp: string;
}
export type TransactionUnion = IRequest | IResponse;
export interface IEvent extends IConcept {
    $timestamp: string;
}
export type EventUnion = IObligation;
