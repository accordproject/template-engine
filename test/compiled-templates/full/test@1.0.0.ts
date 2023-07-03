/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: test@1.0.0

// imports
import {IConcept} from './concerto@1.0.0';

// interfaces
export interface IAddress extends IConcept {
   street: string;
   city: string;
   zip: string;
}

export interface IOrder extends IConcept {
   sku: string;
   amount: number;
}

export interface ILoyaltyStatus extends IConcept {
   level: string;
}

export interface IPreferences extends IConcept {
   favoriteColors?: string[];
}

export enum Gender {
   MALE = 'MALE',
   FEMALE = 'FEMALE',
   NOT_DISCLOSED = 'NOT_DISCLOSED',
}

export interface ITemplateData extends IConcept {
   firstName: string;
   lastName: string;
   middleNames: string[];
   gender?: Gender;
   active: boolean;
   lastVisit: Date;
   address: IAddress;
   orders: IOrder[];
   loyaltyStatus?: ILoyaltyStatus;
   preferences: IPreferences;
}

