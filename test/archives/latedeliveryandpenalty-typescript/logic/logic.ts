// import { EngineResponse, TemplateLogic } from "../../../../src/slc/SmartLegalContract";
import { ILateDeliveryAndPenaltyState, ILateDeliveryAndPenaltyRequest, ILateDeliveryAndPenaltyResponse, ILateDeliveryAndPenaltyEvent, ITemplateModel } from "./generated/io.clause.latedeliveryandpenalty@0.1.0";
// demo utility function
function calc(input: number) : number {
    const result = input * 2.5;
    return result;
}

// @ts-expect-error EngineResponse is imported by the runtime
interface LateDeliveryContractResponse extends EngineResponse<ILateDeliveryAndPenaltyState> {
    result: ILateDeliveryAndPenaltyResponse;
    state: object;
    events: object[];
}

// sample contract logic that is stateless
// - no init method
// @ts-expect-error TemplateLogic is imported by the runtime
class LateDeliveryLogic extends TemplateLogic<ITemplateModel, ILateDeliveryAndPenaltyState>  {
    // @ts-expect-error InitResponse is imported by the runtime
    async init(data: ITemplateModel) : Promise<InitResponse<ILateDeliveryAndPenaltyState>> {
        return {
            state: {
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
                $identifier: data.$identifier,
                count: 0,
            }
        }
    }
    async trigger(data: ITemplateModel, request:ILateDeliveryAndPenaltyRequest, state:ILateDeliveryAndPenaltyState) : Promise<LateDeliveryContractResponse> {
        const event:ILateDeliveryAndPenaltyEvent = {
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyEvent',
                $timestamp: new Date(),
                penaltyCalculated: true
            };
        const newState:ILateDeliveryAndPenaltyState = {
            $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
            $identifier: state.$identifier,
            count: state.count + 1,
        }
        return {
            result: {
                penalty: data.penaltyPercentage * calc(request.goodsValue),
                buyerMayTerminate: true,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            },
            events: [event],
            state: newState
        }
    }
}

export default LateDeliveryLogic;
