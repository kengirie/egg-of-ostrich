import { describe, expect, it } from 'vitest';
import { pickAnswerCardVariant, wrapText } from './ogImage';

// jsdom has no canvas: every character is 10px wide, "…" too.
const measure = (s: string) => Array.from(s).length * 10;

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText(measure, 'ダチョウ', 100, 3)).toEqual(['ダチョウ']);
  });

  it('wraps CJK text per character', () => {
    expect(wrapText(measure, 'あいうえおかきくけこさしす', 50, 5)).toEqual(['あいうえお', 'かきくけこ', 'さしす']);
  });

  it('drops the leading space of a wrapped line without adding an ellipsis', () => {
    expect(wrapText(measure, 'abcde fghij', 50, 3)).toEqual(['abcde', 'fghij']);
  });

  it('limits the number of lines and ends with an ellipsis', () => {
    const lines = wrapText(measure, 'あいうえおかきくけこさしす', 50, 2);
    expect(lines).toEqual(['あいうえお', 'かきくけ…']);
    expect(lines.every((l) => measure(l) <= 50)).toBe(true);
  });

  it('truncates to a single line', () => {
    expect(wrapText(measure, 'とても長い名前のダチョウさん', 60, 1)).toEqual(['とても長い…']);
  });

  it('does not add an ellipsis when the text exactly fills the lines', () => {
    expect(wrapText(measure, 'あいうえおかきくけこ', 50, 2)).toEqual(['あいうえお', 'かきくけこ']);
  });

  it('keeps the ellipsis within maxWidth for wide ellipsis glyphs', () => {
    const wide = (s: string) => Array.from(s).reduce((w, c) => w + (c === '…' ? 30 : 10), 0);
    expect(wrapText(wide, 'abcdefghijkl', 50, 1)).toEqual(['ab…']);
  });

  it('treats emoji as single characters', () => {
    expect(wrapText(measure, '🥚🥚🥚🥚', 20, 2)).toEqual(['🥚🥚', '🥚🥚']);
  });

  it('returns no lines for empty text', () => {
    expect(wrapText(measure, '', 50, 3)).toEqual([]);
  });
});

describe('pickAnswerCardVariant', () => {
  it('rolls the golden egg below 0.1', () => {
    expect(pickAnswerCardVariant(() => 0.5)).toEqual({ golden: false });
    expect(pickAnswerCardVariant(() => 0.05)).toEqual({ golden: true });
    expect(pickAnswerCardVariant(() => 0.1)).toEqual({ golden: false });
  });

  it('hits roughly 10% over many rolls', () => {
    let golden = 0;
    for (let i = 0; i < 20000; i++) if (pickAnswerCardVariant().golden) golden++;
    expect(golden / 20000).toBeGreaterThan(0.08);
    expect(golden / 20000).toBeLessThan(0.12);
  });
});
