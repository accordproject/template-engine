import { IAsset } from './concerto@1.0.0';
export interface IContract extends IAsset {
    contractId: string;
}
export interface IClause extends IAsset {
    clauseId: string;
}
