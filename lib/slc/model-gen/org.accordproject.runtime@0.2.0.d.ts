import { IContract } from './org.accordproject.contract@0.2.0';
import { ITransaction, IEvent, IParticipant, IAsset } from './concerto@1.0.0';
export interface IRequest extends ITransaction {
}
export interface IResponse extends ITransaction {
}
export interface IObligation extends IEvent {
    $identifier: string;
    contract: IContract;
    promisor?: IParticipant;
    promisee?: IParticipant;
    deadline?: Date;
}
export interface IState extends IAsset {
}
