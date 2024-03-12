import { getDrafter } from '../src/drafting';

describe('number to words format', ()=>{
    test('should format integer to words', ()=>{
        const drafter:any=getDrafter('Integer');
        expect(drafter(123,'word' )).toBe('One Hundred Twenty Three');
        expect(drafter(123456,'word' )).toBe('One Lakh Twenty Three Thousand Four Hundred Fifty Six');
    });
    test('should format double to words', ()=>{
        const drafter:any=getDrafter('Double');
        expect(drafter(123.045,'word' )).toBe('One Hundred Twenty Three Point Zero Four Five');
        expect(drafter(1234.045,'word' )).toBe('One Thousand Two Hundred Thirty Four Point Zero Four Five');
    });
});