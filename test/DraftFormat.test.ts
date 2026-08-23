import { getDrafter } from '../src/drafting';
import { TextNumberDraftFormat } from '../src/drafting/DraftFormat';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('number format', ()=>{
    test('should format integer to number', ()=>{
        const drafter:any=getDrafter('Integer');
        expect(drafter(123)).toBe('123');
    });
    test('should format long to number', ()=>{
        const drafter:any=getDrafter('Long');
        expect(drafter(123)).toBe('123');
    });
    test('should format double to number', ()=>{
        const drafter:any=getDrafter('Integer');
        expect(drafter(123.123)).toBe('123.123');
    });
    test('should format integer to words', ()=>{
        const drafter:any=getDrafter('Integer');
        expect(drafter(123, TextNumberDraftFormat)).toBe('One Hundred Twenty Three');
        expect(drafter(123456, TextNumberDraftFormat)).toBe('One Lakh Twenty Three Thousand Four Hundred Fifty Six');
    });
    test('should group a negative integer without a separator after the sign', ()=>{
        const drafter:any=getDrafter('Integer');
        expect(drafter(-123, '0,0')).toBe('-123');
        expect(drafter(-999, '0,0')).toBe('-999');
        expect(drafter(-123456, '0,0')).toBe('-123,456');
        expect(drafter(-1234, '0,0')).toBe('-1,234');
    });
    test('should group a negative long without a separator after the sign', ()=>{
        const drafter:any=getDrafter('Long');
        expect(drafter(-123456, '0,0')).toBe('-123,456');
    });
    test('should group a negative double without a separator after the sign', ()=>{
        const drafter:any=getDrafter('Double');
        expect(drafter(-123, '0,0.00')).toBe('-123.00');
        expect(drafter(-123456.78, '0,0.00')).toBe('-123,456.78');
        expect(drafter(-1234.5, '0,0.00')).toBe('-1,234.50');
    });
    test('should still group positive numbers', ()=>{
        expect((getDrafter('Integer') as any)(123456, '0,0')).toBe('123,456');
        expect((getDrafter('Double') as any)(123456.78, '0,0.00')).toBe('123,456.78');
    });
    test('should format double to words', ()=>{
        const drafter:any=getDrafter('Double');
        expect(drafter(123.045, TextNumberDraftFormat)).toBe('One Hundred Twenty Three Point Zero Four Five');
        expect(drafter(1234.045, TextNumberDraftFormat)).toBe('One Thousand Two Hundred Thirty Four Point Zero Four Five');
    });
});
