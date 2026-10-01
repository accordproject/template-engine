import { NumberDraftFormat } from '../DraftFormat';
/**
 * Creates a drafter for Integer
 * @param {number} value - the integer
 * @returns {string} the text
 */
export declare function draftInteger(value: number): string;
/**
 * Creates a drafter for a formatted Integer
 * @param {number} value - the Integer
 * @param {NumberDraftFormat} format - the format
 * @returns {string} formatted integer value as string
 */
export declare function draftIntegerFormat(value: number, format: NumberDraftFormat): string;
