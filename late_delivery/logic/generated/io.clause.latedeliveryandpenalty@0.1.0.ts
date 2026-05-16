/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: io.clause.latedeliveryandpenalty@0.1.0

// imports
import {IDuration,TemporalUnit} from './org.accordproject.time@0.3.0';
import {IClause} from './org.accordproject.contract@0.2.0';
import {IRequest,IResponse} from './org.accordproject.runtime@0.2.0';
import {IEvent,IConcept} from './concerto@1.0.0';

// interfaces
export interface ITemplateModel extends IClause {
   forceMajeure: boolean;
   penaltyDuration: IDuration;
   penaltyPercentage: number;
   capPercentage: number;
   termination: IDuration;
   fractionalPart: TemporalUnit;
}

export interface ILateDeliveryAndPenaltyRequest extends IRequest {
   forceMajeure: boolean;
   agreedDelivery: Date;
   deliveredAt?: Date;
   goodsValue: number;
}

export interface ILateDeliveryAndPenaltyResponse extends IResponse {
   penalty: number;
   buyerMayTerminate: boolean;
}

export interface ILateDeliveryAndPenaltyEvent extends IEvent {
   penaltyCalculated: boolean;
}

export interface ILateDeliveryAndPenaltyState extends IConcept {
   $identifier: string;
   count: number;
   lateDeliveryProcessed: boolean;
   totalPenalties: number;
}

