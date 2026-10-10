import { describe, expect, it } from 'vitest';
import { ago } from './format';

describe('ago', () => {
  it('formuliert die Zeit seit der letzten Aktualisierung', () => {
    expect(ago(2_000)).toBe('gerade eben');
    expect(ago(12_400)).toBe('vor 12 s');
    expect(ago(125_000)).toBe('vor 2 min');
    expect(ago(-500)).toBe('gerade eben');
  });
});
