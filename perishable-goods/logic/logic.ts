import {
  IPriceCalculation,
  IShipmentReceived,
  ISensorReading,
  ITemplateModel,
  IPerishableGoodsState,
} from "./generated/io.clause.perishablegoods@0.1.0";

type ResponseType = {
  result: IPriceCalculation;
  state: IPerishableGoodsState;
  events: object[];
};

class PerishableGoodsLogic extends TemplateLogic<ITemplateModel> {
  async init(data: ITemplateModel): Promise<{ state: IPerishableGoodsState }> {
    return {
      state: {
        $class: "io.clause.perishablegoods@0.1.0.PerishableGoodsState",
        $identifier: data.clauseId,
        processed: false,
      },
    };
  }

  private calculateTempPenalty(
    minTemperature: number,
    maxTemperature: number,
    penaltyFactor: number,
    readings: ISensorReading[]
  ): number {
    const temps = readings.map(r => r.centigrade);
    const lowest = Math.min(...temps);
    const highest = Math.max(...temps);

    if (lowest < minTemperature) {
      return (minTemperature - lowest) * penaltyFactor;
    } else if (highest > maxTemperature) {
      return (highest - maxTemperature) * penaltyFactor;
    }
    return 0;
  }

  private calculateHumPenalty(
    minHumidity: number,
    maxHumidity: number,
    penaltyFactor: number,
    readings: ISensorReading[]
  ): number {
    const hums = readings.map(r => r.humidity);
    const lowest = Math.min(...hums);
    const highest = Math.max(...hums);

    if (lowest < minHumidity) {
      return (minHumidity - lowest) * penaltyFactor;
    } else if (highest > maxHumidity) {
      return (highest - maxHumidity) * penaltyFactor;
    }
    return 0;
  }

  async trigger(
    data: ITemplateModel,
    request: IShipmentReceived,
    state: IPerishableGoodsState
  ): Promise<ResponseType> {
    if (!(data.minUnits <= request.unitCount && request.unitCount <= data.maxUnits)) {
      throw new Error("Units received out of range for the contract");
    }

    const zeroMoney = {
      $class: "org.accordproject.money@0.3.0.MonetaryAmount",
      doubleValue: 0,
      currencyCode: data.unitPrice.currencyCode,
    };

    if (!(new Date() < new Date(data.dueDate))) {
      return {
        result: {
          $class: "io.clause.perishablegoods@0.1.0.PriceCalculation",
          $timestamp: new Date(),
          shipment: request.shipment,
          totalPrice: zeroMoney,
          penalty: zeroMoney,
          late: true,
        },
        state: {
          ...state,
          processed: true,
        },
        events: [],
      };
    }

    const readings = request.shipment.sensorReadings ?? [];
    if (readings.length === 0) {
      throw new Error("No temperature readings received");
    }

    const payOut = data.unitPrice.doubleValue * request.unitCount;

    const penalty =
      this.calculateTempPenalty(
        data.minTemperature,
        data.maxTemperature,
        data.penaltyFactor,
        readings
      ) +
      this.calculateHumPenalty(
        data.minHumidity,
        data.maxHumidity,
        data.penaltyFactor,
        readings
      );

    const totalPenaltyValue = penalty * request.unitCount;
    const totalPriceValue = Math.max(payOut - totalPenaltyValue, 0);

    const totalPenalty = {
      $class: "org.accordproject.money@0.3.0.MonetaryAmount",
      doubleValue: totalPenaltyValue,
      currencyCode: data.unitPrice.currencyCode,
    };

    const totalPrice = {
      $class: "org.accordproject.money@0.3.0.MonetaryAmount",
      doubleValue: totalPriceValue,
      currencyCode: data.unitPrice.currencyCode,
    };

    return {
      result: {
        $class: "io.clause.perishablegoods@0.1.0.PriceCalculation",
        $timestamp: new Date(),
        shipment: request.shipment,
        totalPrice,
        penalty: totalPenalty,
        late: false,
      },
      state: {
        ...state,
        processed: true,
      },
      events: [
        {
          $class: "org.accordproject.obligation.PaymentObligation",
          description: `${data.importer} should pay shipment amount to ${data.grower}`,
        },
      ],
    };
  }
}

export default PerishableGoodsLogic;