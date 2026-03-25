// import { EngineResponse, TemplateLogic } from "../../../../src/slc/SmartLegalContract";
import { ILateDeliveryAndPenaltyState, ILateDeliveryAndPenaltyRequest, ILateDeliveryAndPenaltyResponse, ILateDeliveryAndPenaltyEvent, ITemplateModel } from "./generated/io.clause.latedeliveryandpenalty@0.1.0";

// TODO: come up with an automated solution to generated files being available at runtime.
// Inline types from org.accordproject.time@0.3.0 since generated files may not be available at runtime
// These types are needed for duration conversion
enum TemporalUnit {
    seconds = 'seconds',
    minutes = 'minutes',
    hours = 'hours',
    days = 'days',
    weeks = 'weeks',
}

interface IDuration {
    amount: number;
    unit: TemporalUnit;
}

// @ts-expect-error EngineResponse is imported by the runtime
interface LateDeliveryContractResponse extends EngineResponse<ILateDeliveryAndPenaltyState> {
    result: ILateDeliveryAndPenaltyResponse;
    state: object;
    events: object[];
}

// @ts-ignore TemplateLogic is imported by the runtime
class LateDeliveryLogic extends TemplateLogic<ITemplateModel, ILateDeliveryAndPenaltyState>  {
    // @ts-expect-error InitResponse is imported by the runtime
    async init(data: ITemplateModel) : Promise<InitResponse<ILateDeliveryAndPenaltyState>> {
        return {
            state: {
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
                $identifier: data.$identifier,
                count: 0,
                lateDeliveryProcessed: false,
                totalPenalties: 0.0,
            }
        }
    }

    /**
     * Convert Duration to milliseconds
     * Manual conversion without requiring dayjs duration plugin, note that this is simplified and will likely break with daylight savings time changes and leap years
     */
    private convertDurationToMilliseconds(duration: IDuration): number {
        const amount = duration.amount;
        const unit = duration.unit;
        
        // Conversion factors to milliseconds
        const MS_PER_SECOND = 1000;
        const MS_PER_MINUTE = MS_PER_SECOND * 60;
        const MS_PER_HOUR = MS_PER_MINUTE * 60;
        const MS_PER_DAY = MS_PER_HOUR * 24;
        const MS_PER_WEEK = MS_PER_DAY * 7;
        
        switch (unit) {
            case TemporalUnit.seconds:
                return amount * MS_PER_SECOND;
            case TemporalUnit.minutes:
                return amount * MS_PER_MINUTE;
            case TemporalUnit.hours:
                return amount * MS_PER_HOUR;
            case TemporalUnit.days:
                return amount * MS_PER_DAY;
            case TemporalUnit.weeks:
                return amount * MS_PER_WEEK;
            default:
                throw new Error(`Unsupported temporal unit: ${unit}`);
        }
    }

    async trigger(data: ITemplateModel, request: ILateDeliveryAndPenaltyRequest, state: ILateDeliveryAndPenaltyState) : Promise<LateDeliveryContractResponse> {
        // Use deliveredAt if present, otherwise use now()
        // Using native Date objects for date operations
        const agreedDelivery = new Date(request.agreedDelivery);
        const effectiveDelivery = request.deliveredAt ? new Date(request.deliveredAt) : new Date();

        // Early guard: cannot exercise before agreed delivery date
        if (agreedDelivery.getTime() > effectiveDelivery.getTime()) {
            throw new Error('Cannot exercise late delivery before delivery date');
        }

        let penalty = 0.0;
        let buyerMayTerminate = false;

        // Ergo-style force majeure: only if both contract and request have force majeure
        if (data.forceMajeure && request.forceMajeure) {
            // Force majeure applies - no penalty, but buyer may terminate
            buyerMayTerminate = true;
        } else {
            // Calculate the time difference between effective delivery and agreed delivery
            const delayMs = effectiveDelivery.getTime() - agreedDelivery.getTime();
            const penaltyDurationMs = this.convertDurationToMilliseconds(data.penaltyDuration);
            const terminationMs = this.convertDurationToMilliseconds(data.termination);

            // Calculate ratio (can be fractional)
            const diffRatio = delayMs / penaltyDurationMs;

            // If delivered on time or early, or no positive delay, no penalty
            if (diffRatio > 0) {
                // Penalty formula: ratio * penaltyPercentage/100 * goodsValue
                const penaltyRaw = diffRatio * (data.penaltyPercentage / 100.0) * request.goodsValue;
                // Cap
                const maxPenalty = (data.capPercentage / 100.0) * request.goodsValue;
                penalty = Math.min(penaltyRaw, maxPenalty);
                // Termination
                buyerMayTerminate = delayMs > terminationMs;
            }
        }

        // Update state: mark late delivery as processed if penalty > 0, and add to running total
        const newState: ILateDeliveryAndPenaltyState = {
            $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
            $identifier: state.$identifier,
            count: state.count + 1,
            lateDeliveryProcessed: penalty > 0 || state.lateDeliveryProcessed,
            totalPenalties: state.totalPenalties + penalty,
        };

        const event: ILateDeliveryAndPenaltyEvent = {
            $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyEvent',
            $timestamp: new Date(),
            penaltyCalculated: penalty > 0
        };

        return {
            result: {
                penalty: penalty,
                buyerMayTerminate: buyerMayTerminate,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            },
            events: [event],
            state: newState
        };
    }
}

export default LateDeliveryLogic;
