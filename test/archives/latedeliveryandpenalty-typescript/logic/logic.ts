/* eslint-disable @typescript-eslint/no-explicit-any */
export default function trigger(data: any, request:any) : any {
    return `Penalty percentage is ${data.penaltyPercentage} and goods value is ${request.goodsValue}!`;
}
