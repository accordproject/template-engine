import { NumberDraftFormat } from '../DraftFormat';
/**
 * Creates a drafter for Double
 * @param {number} value - the double
 * @returns {string} the text
 */
export declare function draftDoubleIEEE(value: number): string;
/**
 * Creates a drafter for a formatted Double
 * @param {number} value - the Double
 * @param {NumberDraftFormat} format - the format
 * @returns {string} formatted double value as string
 */
export declare function draftDoubleFormat(value: number, format: NumberDraftFormat): string;
