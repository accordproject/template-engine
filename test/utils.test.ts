import { wrapExpressionWithReturn } from '../src/utils';

describe('wrapExpressionWithReturn', () => {
    test('wraps a bare expression with return', () => {
        expect(wrapExpressionWithReturn('importerLOCAmount / 2.0')).toBe('return importerLOCAmount / 2.0;');
    });

    test('leaves explicit top-level return unchanged', () => {
        const code = 'const x = 1;\nreturn x + 2;';
        expect(wrapExpressionWithReturn(code)).toBe(code);
    });

    test('wraps when only a nested function/arrow contains return (regression for #146 follow-up)', () => {
        const code = '[1,2,3].map(x => { return x*2 })[0]';
        expect(wrapExpressionWithReturn(code)).toBe('return [1,2,3].map(x => { return x*2 })[0];');
    });

    test('wraps only the trailing expression of a multi-statement body', () => {
        const code = 'const x = 1;\nconst y = 2;\nx + y';
        expect(wrapExpressionWithReturn(code)).toBe('const x = 1;\nconst y = 2;\nreturn x + y;');
    });

    test('leaves a statements-only body (no trailing expression) unchanged', () => {
        const code = 'const x = 1;\nconst y = 2;';
        expect(wrapExpressionWithReturn(code)).toBe(code);
    });

    test('returns an empty string as-is', () => {
        expect(wrapExpressionWithReturn('')).toBe('');
        expect(wrapExpressionWithReturn('   \n\t  ')).toBe('');
    });
});
