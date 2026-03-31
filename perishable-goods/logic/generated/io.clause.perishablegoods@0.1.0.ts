/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: io.clause.perishablegoods@0.1.0

// imports
import {TemporalUnit} from './org.accordproject.time@0.3.0';
import {IMonetaryAmount} from './org.accordproject.money@0.3.0';
import {IClause} from './org.accordproject.contract@0.2.0';
import {IRequest,IResponse} from './org.accordproject.runtime@0.2.0';
import {IConcept} from './concerto@1.0.0';

// interfaces
export interface ITemplateModel extends IClause {
   shipment: string;
   importer: string;
   grower: string;
   unitPrice: IMonetaryAmount;
   unit: string;
   minUnits: number;
   maxUnits: number;
   product: string;
   sensorReadingFrequency: number;
   duration: TemporalUnit;
   dueDate: Date;
   minTemperature: number;
   maxTemperature: number;
   minHumidity: number;
   maxHumidity: number;
   penaltyFactor: number;
}

export interface IPerishableGoodsState extends IConcept {
   $identifier: string;
   processed: boolean;
}

export interface ISensorReading extends IConcept {
   centigrade: number;
   humidity: number;
   transactionId?: string;
}

export interface IShipment extends IConcept {
   shipmentId: string;
   sensorReadings?: ISensorReading[];
}

export interface IShipmentReceived extends IRequest {
   unitCount: number;
   shipment: IShipment;
}

export interface IPriceCalculation extends IResponse {
   shipment: IShipment;
   totalPrice: IMonetaryAmount;
   penalty: IMonetaryAmount;
   late: boolean;
}

