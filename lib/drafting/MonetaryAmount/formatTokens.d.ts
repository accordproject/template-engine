/**
 * Symbol from a currency code
 * @param {string} c - the currency code
 * @returns {string} the symbol
 */
export declare function codeSymbol(c: string): string;
/**
 * Replaces currency tokens (K for symbol, CCC for code) in a format string
 * @param {string} format - the format string
 * @param {string} code - the currency code
 * @returns {string} the format string with tokens replaced
 */
export declare function replaceCurrencyTokens(format: string, code: string): string;
