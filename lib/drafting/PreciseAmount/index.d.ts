import { MonetaryAmountFormat } from '../DraftFormat';
export type PreciseAmount = {
    unscaledValue: string;
    unit: {
        code: string;
        scheme?: string;
        identifier?: string;
        scale: number;
    };
};
/**
 * Creates a drafter for a precise amount
 * @param {object} value the precise amount
 * @param {string} format the format
 * @returns {string} the text
 */
export default function preciseAmountDrafter(value: PreciseAmount, format?: MonetaryAmountFormat): string;
