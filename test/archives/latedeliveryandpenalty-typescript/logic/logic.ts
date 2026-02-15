import { IEvent, InitResponse, TemplateLogic, TriggerResponse } from "../../../../src/slc/SmartLegalContract";
import { Decimal } from 'decimal.js';
import dayjs from 'dayjs';
import { ILateDeliveryAndPenaltyState, ILateDeliveryAndPenaltyRequest, ILateDeliveryAndPenaltyResponse, ILateDeliveryAndPenaltyEvent, ITemplateModel } from "./generated/io.clause.latedeliveryandpenalty@0.1.0";
import { TemporalUnit } from "./generated/org.accordproject.time@0.3.0";

function mapUnits(unit:TemporalUnit) {
    switch(unit) {
        case TemporalUnit.days:
            return 'day'
        case TemporalUnit.hours:
            return 'hour'
        case TemporalUnit.seconds:
            return 'second'
        case TemporalUnit.minutes:
            return 'minute'
        case TemporalUnit.weeks:
            return 'week'
        default:
            return 'milliseconds'
    }
}

interface LateDeliveryContractResponse extends TriggerResponse<ILateDeliveryAndPenaltyState> {
    result: ILateDeliveryAndPenaltyResponse;
    state: ILateDeliveryAndPenaltyState;
    events: IEvent[];
}

class LateDeliveryLogic extends TemplateLogic<ITemplateModel, ILateDeliveryAndPenaltyState>  {
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
        const now = dayjs(request.$timestamp);
        const dueDate = dayjs(request.agreedDelivery);
        const isLate = request.forceMajeure ? false : now.isAfter(dueDate);
        const lateInUnits = now.diff(dueDate, mapUnits(data.penaltyDuration.unit), true);
        const lateAmount = Math.ceil(lateInUnits);
        const latePenalty = new Decimal(lateAmount).times(data.penaltyPercentage).times(request.goodsValue).dividedBy(100).toNumber();
        const cappedLatePenalty = Math.min(latePenalty, new Decimal(data.capPercentage).times(request.goodsValue).dividedBy(100).toNumber());
        const terminationDate = dueDate.add(data.termination.amount, mapUnits(data.termination.unit))
        const buyerMayTerminate = now.isAfter(terminationDate);

        return {
            result: {
                penalty: isLate ? cappedLatePenalty : 0.0,
                buyerMayTerminate,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            },
            events: [event],
            state: newState
        }
    }
}

export default LateDeliveryLogic;