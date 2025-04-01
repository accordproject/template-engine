import { ILateDeliveryAndPenaltyRequest, ILateDeliveryAndPenaltyResponse, ITemplateModel } from "./generated/io.clause.latedeliveryandpenalty@0.1.0";

// demo utility function
function calc(input: number) : number {
    const result = input * 2.5;
    return result;
}

type LateDeliveryContractResponse = {
    result: ILateDeliveryAndPenaltyResponse;
}

// sample contract logic that is stateless
// - no init method
class LateDeliveryLogic extends TemplateLogic<ITemplateModel>  {
    async trigger(data: ITemplateModel, request:ILateDeliveryAndPenaltyRequest) : Promise<LateDeliveryContractResponse> {
        return {
            result: {
                penalty: data.penaltyPercentage * calc(request.goodsValue),
                buyerMayTerminate: true,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            }
        }
    }
}

export default LateDeliveryLogic;
