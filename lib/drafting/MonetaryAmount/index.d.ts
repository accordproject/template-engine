import { MonetaryAmountFormat } from '../DraftFormat';
type MonetaryAmount = {
    doubleValue: number;
    currencyCode: string;
};
/**
 * Creates a drafter for a monetary amount
 * @param {object} value the monetary amount
 * @param {string} format the format
 * @returns {string} the text
 */
export default function monetaryAmountDrafter(value: MonetaryAmount, format?: MonetaryAmountFormat): string;
export {};
