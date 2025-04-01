/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: org.accordproject.contract@0.2.0

// imports

// Warning: Beware of circular dependencies when modifying these imports
import {IAsset} from './concerto@1.0.0';

// interfaces
export interface IContract extends IAsset {
   contractId: string;
}

export interface IClause extends IAsset {
   clauseId: string;
}
