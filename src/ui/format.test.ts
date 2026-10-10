import { describe, expect, it } from 'vitest';
import { clock } from './format';

describe('clock', () => {
  it('zeigt Stunden und Minuten zweistellig', () => {
    expect(clock(new Date(2026, 9, 10, 20, 57).getTime())).toBe('20:57');
    expect(clock(new Date(2026, 9, 10, 9, 5).getTime())).toBe('09:05');
  });
});
