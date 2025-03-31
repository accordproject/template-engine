/* eslint-disable @typescript-eslint/no-explicit-any */

import { ILateDeliveryAndPenaltyRequest, ILateDeliveryAndPenaltyResponse, ITemplateModel } from "./generated/io.clause.latedeliveryandpenalty@0.1.0";

// all of this is either runtime defined or generated from model
type ContractRequest = object;

type ContractEvent = object;

type ContractResponse = {
    result: any;
    events?: Array<ContractEvent>
}

type InitResponse = {
    state?: any;
    events?: Array<ContractEvent>
}

// ContractRequest can be a union of all the request types defined in the model
// ContractResponse can be a union of all the response types defined in the model

abstract class TemplateLogic<ContractData, State> {
    abstract trigger(data: ContractData, request: ContractRequest, state:State) : Promise<ContractResponse>;
    async init() : Promise<InitResponse> {
        return {};
    }
}

// ********* contract logic *******

// demo utility function
function calc(input: number) : number {
    const result = input * 2.5;
    return result;
}

// generated from model
type LateDeliveryContractState = object;

type LateDeliveryContractResponse = {
    result: ILateDeliveryAndPenaltyResponse;
}

// skeleton is generated from model...
class LateDeliveryLogic extends TemplateLogic<ITemplateModel, LateDeliveryContractState>  {
    async trigger(data: ITemplateModel, request:ILateDeliveryAndPenaltyRequest) : Promise<LateDeliveryContractResponse> {
        return {
            result: {
                penalty: calc(request.goodsValue),
                buyerMayTerminate: true,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            }
        }
    }
}

export default LateDeliveryLogic;
