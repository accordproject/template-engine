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
    test('should format double to words', ()=>{
        const drafter:any=getDrafter('Double');
        expect(drafter(123.045, TextNumberDraftFormat)).toBe('One Hundred Twenty Three Point Zero Four Five');
        expect(drafter(1234.045, TextNumberDraftFormat)).toBe('One Thousand Two Hundred Thirty Four Point Zero Four Five');
    });
});
