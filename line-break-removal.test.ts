import { describe, it, expect } from 'vitest';

// Logic extracted from main.ts for isolated testing
function removeLineBreaks(text: string): string {
    return text.replace(/([^\n])\n([^\n])/g, '$1 $2');
}

describe('removeLineBreaks', () => {
    it('should remove single line breaks', () => {
        const input = 'This is a sentence\nthat is broken.';
        const expected = 'This is a sentence that is broken.';
        expect(removeLineBreaks(input)).toBe(expected);
    });

    it('should preserve double line breaks (paragraphs)', () => {
        const input = 'Paragraph 1.\n\nParagraph 2.';
        const expected = 'Paragraph 1.\n\nParagraph 2.';
        expect(removeLineBreaks(input)).toBe(expected);
    });

    it('should handle multiple single line breaks', () => {
        const input = 'Line 1\nLine 2\nLine 3';
        const expected = 'Line 1 Line 2 Line 3';
        expect(removeLineBreaks(input)).toBe(expected);
    });

    it('should handle mixed single and double line breaks', () => {
        const input = 'Para 1 line 1\nPara 1 line 2\n\nPara 2 line 1\nPara 2 line 2';
        const expected = 'Para 1 line 1 Para 1 line 2\n\nPara 2 line 1 Para 2 line 2';
        expect(removeLineBreaks(input)).toBe(expected);
    });

    it('should not affect text without line breaks', () => {
        const input = 'Single line text.';
        const expected = 'Single line text.';
        expect(removeLineBreaks(input)).toBe(expected);
    });
});
