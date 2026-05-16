// @ts-nocheck - Suppress type checking for runtime mocks
// Mock the runtime imports before importing logic
declare global {
    var TemplateLogic: any;
    var EngineResponse: any;
    var InitResponse: any;
}

// Mock the runtime imports
(global as any).TemplateLogic = class TemplateLogic<T, S> {
    async init(data: T): Promise<any> { return { state: {} }; }
    async trigger(data: T, request: any, state: S): Promise<any> { return {}; }
} as any;

(global as any).EngineResponse = class EngineResponse<S> {} as any;
(global as any).InitResponse = class InitResponse<S> {} as any;

// Now import after mocks are set up
import LateDeliveryLogic from './logic';
import { ITemplateModel, ILateDeliveryAndPenaltyRequest, ILateDeliveryAndPenaltyState, ILateDeliveryAndPenaltyResponse, ILateDeliveryAndPenaltyEvent } from './generated/io.clause.latedeliveryandpenalty@0.1.0';

describe('LateDeliveryLogic', () => {
    let logic: LateDeliveryLogic;
    let mockTemplateModel: ITemplateModel;
    let initialState: ILateDeliveryAndPenaltyState;

    beforeEach(() => {
        logic = new LateDeliveryLogic();
        mockTemplateModel = {
            forceMajeure: false,
            penaltyDuration: {
                $class: 'org.accordproject.time@0.3.0.Duration',
                amount: 2,
                unit: 'days' as any
            },
            penaltyPercentage: 10.5,
            capPercentage: 55.0,
            termination: {
                $class: 'org.accordproject.time@0.3.0.Duration',
                amount: 15,
                unit: 'days' as any
            },
            fractionalPart: 'days' as any,
            clauseId: 'test-clause-id',
            $identifier: 'test-clause-id',
            $class: 'io.clause.latedeliveryandpenalty@0.1.0.TemplateModel'
        };

        initialState = {
            $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
            $identifier: 'test-clause-id',
            count: 0,
            lateDeliveryProcessed: false,
            totalPenalties: 0.0
        };
    });

    describe('init method', () => {
        it('should initialize state with default values', async () => {
            const result = await logic.init(mockTemplateModel);
            
            expect(result.state).toEqual({
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyState',
                $identifier: 'test-clause-id',
                count: 0,
                lateDeliveryProcessed: false,
                totalPenalties: 0.0
            });
        });

        it('should use the template model identifier', async () => {
            mockTemplateModel.$identifier = 'custom-id-123';
            const result = await logic.init(mockTemplateModel);
            
            expect((result.state as ILateDeliveryAndPenaltyState).$identifier).toBe('custom-id-123');
        });
    });

    describe('trigger method', () => {
        describe('Force Majeure scenarios', () => {
            it('should return zero penalty only if both contract and request have force majeure', async () => {
                // Only request.forceMajeure true
                let request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: true,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-10'),
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                let result = await logic.trigger(mockTemplateModel, request, initialState);
                
                // Should calculate penalty as normal (force majeure not in contract)
                const delayMs = new Date('2024-01-10').getTime() - new Date('2024-01-01').getTime();
                const penaltyDurationMs = 2 * 24 * 60 * 60 * 1000;
                const diffRatio = delayMs / penaltyDurationMs;
                const penaltyRaw = diffRatio * 0.105 * 10000;
                const maxPenalty = 0.55 * 10000;
                const expectedPenalty = Math.min(penaltyRaw, maxPenalty);

                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);

                // Both contract and request force majeure
                mockTemplateModel.forceMajeure = true;
                result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.result.penalty).toBe(0.0);
                expect(result.result.buyerMayTerminate).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(false); // No penalty, so flag stays false
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBe(0.0);
            });
        });

        describe('No delivery scenarios', () => {
            it('should use now() if deliveredAt is not specified', async () => {
                const agreed = new Date();
                agreed.setDate(agreed.getDate() - 5); // 5 days ago

                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: agreed,
                    deliveredAt: undefined,
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // Since we're using now(), we can't predict the exact penalty
                // Just verify it's calculated and state is updated
                expect(result.result.penalty).toBeGreaterThan(0);
                expect(result.result.penalty).toBeLessThan(5500); // Should be less than cap
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeGreaterThan(0);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeLessThan(5500);
            });
        });

        describe('On-time and early delivery scenarios', () => {
            it('should return zero penalty when delivered on time', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-01'),
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.result.penalty).toBe(0.0);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBe(0.0);
            });

            it('should throw if exercised before agreed delivery date', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2023-12-30'),
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                await expect(logic.trigger(mockTemplateModel, request, initialState))
                    .rejects.toThrow('Cannot exercise late delivery before delivery date');
            });
        });

        describe('Late delivery penalty calculations', () => {
            it('should calculate penalty for 1 day late delivery (ratio-based)', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-02'), // 1 day late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 1 day / 2 days = 0.5
                const expectedPenalty = 0.5 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
                expect(result.events).toHaveLength(1);
                expect(result.events[0]).toHaveProperty('penaltyCalculated', true);
            });

            it('should calculate penalty for 2 days late delivery (ratio-based)', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-03'), // 2 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 2 days / 2 days = 1
                const expectedPenalty = 1 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });

            it('should calculate penalty for 4 days late delivery (ratio-based)', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-05'), // 4 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 4 days / 2 days = 2
                const expectedPenalty = 2 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });

            it('should allow fractional penalty (no rounding up)', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01T00:00:00'),
                    deliveredAt: new Date('2024-01-02T12:00:00'), // 1.5 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 1.5 days / 2 days = 0.75
                const expectedPenalty = 0.75 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });
        });

        describe('Penalty cap scenarios', () => {
            it('should apply penalty cap when calculated penalty exceeds cap', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-20'), // 19 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 19 days / 2 days = 9.5, penaltyRaw = 9.5 * 0.105 * 10000 = 9975, capped at 5500
                expect(result.result.penalty).toBeCloseTo(5500, 6);
                expect(result.result.buyerMayTerminate).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(5500, 6);
            });

            it('should not apply cap when calculated penalty is below cap', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-10'), // 9 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 9 days / 2 days = 4.5, penaltyRaw = 4.5 * 0.105 * 10000 = 4725
                expect(result.result.penalty).toBeCloseTo(4725, 6);
                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(4725, 6);
            });
        });

        describe('Termination scenarios', () => {
            it('should allow termination only if delay is strictly greater than threshold', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-17'), // 16 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // Termination threshold is 15 days, so 16 > 15 triggers termination
                expect(result.result.buyerMayTerminate).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
            });

            it('should not allow termination if delay is equal to threshold', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-16'), // 15 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.result.buyerMayTerminate).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
            });
        });

        describe('State management', () => {
            it('should track lateDeliveryProcessed flag when penalty is calculated', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-03'), // 2 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).count).toBe(1);
            });

            it('should maintain lateDeliveryProcessed flag once set to true', async () => {
                const stateWithFlag: ILateDeliveryAndPenaltyState = {
                    ...initialState,
                    lateDeliveryProcessed: true,
                    count: 5
                };

                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-01'), // On time, no penalty
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, stateWithFlag);

                // Flag should remain true even though this trigger has no penalty
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).count).toBe(6);
            });

            it('should accumulate totalPenalties across multiple triggers', async () => {
                const request1: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-03'), // 2 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result1 = await logic.trigger(mockTemplateModel, request1, initialState);
                const expectedPenalty1 = 1 * 0.105 * 10000;

                expect((result1.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty1, 6);
                expect((result1.state as ILateDeliveryAndPenaltyState).count).toBe(1);

                // Second trigger with different delay
                const request2: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-10'),
                    deliveredAt: new Date('2024-01-12'), // 2 days late again
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result2 = await logic.trigger(mockTemplateModel, request2, result1.state as ILateDeliveryAndPenaltyState);
                const expectedPenalty2 = 1 * 0.105 * 10000;
                const expectedTotal = expectedPenalty1 + expectedPenalty2;

                expect((result2.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedTotal, 6);
                expect((result2.state as ILateDeliveryAndPenaltyState).count).toBe(2);
                expect((result2.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
            });

            it('should increment count on each trigger', async () => {
                let currentState = initialState;

                for (let i = 1; i <= 5; i++) {
                    const request: ILateDeliveryAndPenaltyRequest = {
                        forceMajeure: false,
                        agreedDelivery: new Date('2024-01-01'),
                        deliveredAt: new Date('2024-01-01'), // On time
                        goodsValue: 10000,
                        $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                        $timestamp: new Date()
                    };

                    const result = await logic.trigger(mockTemplateModel, request, currentState);
                    expect((result.state as ILateDeliveryAndPenaltyState).count).toBe(i);
                    currentState = result.state as ILateDeliveryAndPenaltyState;
                }
            });
        });

        describe('Different time units', () => {
            it('should handle hours as penalty duration unit (ratio-based)', async () => {
                mockTemplateModel.penaltyDuration = {
                    $class: 'org.accordproject.time@0.3.0.Duration',
                    amount: 24,
                    unit: 'hours' as any
                };

                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01T00:00:00'),
                    deliveredAt: new Date('2024-01-02T12:00:00'), // 36 hours late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 36/24 = 1.5
                const expectedPenalty = 1.5 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });

            it('should handle weeks as penalty duration unit (ratio-based)', async () => {
                mockTemplateModel.penaltyDuration = {
                    $class: 'org.accordproject.time@0.3.0.Duration',
                    amount: 1,
                    unit: 'weeks' as any
                };

                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-15'), // 14 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 14 days / 7 days = 2
                const expectedPenalty = 2 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });
        });

        describe('Edge cases', () => {
            it('should handle zero goods value', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-10'),
                    goodsValue: 0,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.result.penalty).toBe(0.0);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(false);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBe(0.0);
            });

            it('should handle very large goods value', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-02'),
                    goodsValue: 1000000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 1 day / 2 days = 0.5
                const expectedPenalty = 0.5 * 0.105 * 1000000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });

            it('should handle very small delay (less than 1 penalty unit, ratio-based)', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01T00:00:00'),
                    deliveredAt: new Date('2024-01-01T12:00:00'), // 0.5 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                // 0.5 days / 2 days = 0.25
                const expectedPenalty = 0.25 * 0.105 * 10000;
                expect(result.result.penalty).toBeCloseTo(expectedPenalty, 6);
                expect((result.state as ILateDeliveryAndPenaltyState).lateDeliveryProcessed).toBe(true);
                expect((result.state as ILateDeliveryAndPenaltyState).totalPenalties).toBeCloseTo(expectedPenalty, 6);
            });
        });

        describe('Response structure', () => {
            it('should return correct response structure', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-03'),
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.result).toHaveProperty('penalty');
                expect(result.result).toHaveProperty('buyerMayTerminate');
                expect(result.result).toHaveProperty('$timestamp');
                expect(result.result).toHaveProperty('$class');
                expect(result.state).toHaveProperty('count');
                expect(result.state).toHaveProperty('lateDeliveryProcessed');
                expect(result.state).toHaveProperty('totalPenalties');
                expect(result.events).toBeDefined();
                expect(Array.isArray(result.events)).toBe(true);
            });
        });

        describe('Events', () => {
            it('should emit event with penaltyCalculated true when penalty > 0', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-03'), // 2 days late
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.events).toHaveLength(1);
                expect(result.events[0]).toHaveProperty('$class', 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyEvent');
                expect(result.events[0]).toHaveProperty('penaltyCalculated', true);
                expect(result.events[0]).toHaveProperty('$timestamp');
            });

            it('should emit event with penaltyCalculated false when penalty = 0', async () => {
                const request: ILateDeliveryAndPenaltyRequest = {
                    forceMajeure: false,
                    agreedDelivery: new Date('2024-01-01'),
                    deliveredAt: new Date('2024-01-01'), // On time
                    goodsValue: 10000,
                    $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyRequest',
                    $timestamp: new Date()
                };

                const result = await logic.trigger(mockTemplateModel, request, initialState);

                expect(result.events).toHaveLength(1);
                expect(result.events[0]).toHaveProperty('penaltyCalculated', false);
            });
        });
    });
});

