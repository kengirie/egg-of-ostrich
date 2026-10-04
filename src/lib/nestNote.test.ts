import { describe, expect, it } from 'vitest';
import { buildNestNoteTemplate, defaultNestNoteText } from './nestNote';

const URL_ = 'https://abcnest.nsite.lol/';

describe('buildNestNoteTemplate', () => {
  it('posts the default text with the link, an r tag and the hashtag', () => {
    const t = buildNestNoteTemplate(defaultNestNoteText(URL_), URL_);
    expect(t.kind).toBe(1);
    expect(t.content.endsWith(URL_)).toBe(true);
    expect(t.tags).toContainEqual(['r', URL_]);
    expect(t.tags).toContainEqual(['t', 'eggofostriches']);
  });

  it('appends the link when the owner removed it', () => {
    const t = buildNestNoteTemplate('質問まってます', URL_);
    expect(t.content).toBe(`質問まってます\n${URL_}`);
    expect(t.tags).not.toContainEqual(['t', 'eggofostriches']);
    expect(buildNestNoteTemplate('   ', URL_).content).toBe(URL_);
  });

  it('refuses a non-https link', () => {
    expect(() => buildNestNoteTemplate('x', 'http://example.com/')).toThrow();
  });
});
