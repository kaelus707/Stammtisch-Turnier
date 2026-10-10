import { describe, expect, it } from 'vitest';
import { finalRanking, resolveMatches } from './bracket';
import { groupTable, ko, m } from './fixtures';

const A = ['a1', 'a2', 'a3', 'a4', 'a5'];
const B = ['b1', 'b2', 'b3', 'b4', 'b5'];

describe('resolveMatches', () => {
  it('löst Gruppenplätze erst nach Gruppenende auf', () => {
    const [x] = resolveMatches([ko(22, 'Halbfinale 1', 'A1', 'B2')], [groupTable('A', A, false), groupTable('B', B, true)]);
    expect(x.homeSide).toEqual({ team: null, label: 'A1' });
    expect(x.awaySide).toEqual({ team: 'b2', label: 'b2' });
  });

  it('zeigt „Los ausstehend“ statt eines unklaren Platzes', () => {
    const [x] = resolveMatches([ko(22, 'Halbfinale 1', 'A1', 'B2')], [groupTable('A', A, true, [0, 1]), groupTable('B', B)]);
    expect(x.homeSide).toEqual({ team: null, label: 'A1 (Los ausstehend)' });
  });

  it('löst Sieger und Verlierer der Halbfinals auf', () => {
    const tables = [groupTable('A', A), groupTable('B', B)];
    const res = resolveMatches([
      ko(22, 'Halbfinale 1', 'A1', 'B2', [2, 3]),
      ko(24, 'Halbfinale 2', 'A2', 'B1'),
      ko(26, 'Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2'),
      ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2'),
    ], tables);
    expect(res[0]).toMatchObject({ winner: 'b2', loser: 'a1', undecided: false });
    expect(res[2].homeSide).toEqual({ team: 'a1', label: 'a1' });
    expect(res[2].awaySide).toEqual({ team: null, label: 'Verlierer HF2' });
    expect(res[3].homeSide).toEqual({ team: 'b2', label: 'b2' });
  });

  it('lässt den Sieger bei Unentschieden im K.-o.-Spiel offen', () => {
    const res = resolveMatches(
      [ko(22, 'Halbfinale 1', 'A1', 'B2', [1, 1]), ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2')],
      [groupTable('A', A), groupTable('B', B)],
    );
    expect(res[0]).toMatchObject({ winner: null, undecided: true });
    expect(res[1].homeSide.label).toBe('Sieger HF1');
  });

  it('markiert ein Unentschieden im Gruppenspiel nicht als unentschieden-offen', () => {
    const [x] = resolveMatches([m(1, 'a1', 'a2', [1, 1])], [groupTable('A', A, false)]);
    expect(x).toMatchObject({ homeSide: { team: 'a1', label: 'a1' }, winner: null, undecided: false });
  });
});

describe('finalRanking', () => {
  it('ermittelt Platz 1–10 aus den Finalrundenspielen', () => {
    const res = resolveMatches([
      ko(21, 'Spiel um Platz 9', 'A5', 'B5', [0, 1]),
      ko(22, 'Halbfinale 1', 'A1', 'B2', [1, 0]),
      ko(23, 'Spiel um Platz 7', 'A4', 'B4', [2, 0]),
      ko(24, 'Halbfinale 2', 'A2', 'B1', [0, 2]),
      ko(25, 'Spiel um Platz 5', 'A3', 'B3', [6, 5]),
      ko(26, 'Spiel um Platz 3', 'Verlierer HF1', 'Verlierer HF2', [1, 0]),
      ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2', [3, 2]),
    ], [groupTable('A', A), groupTable('B', B)]);
    expect(finalRanking(res, 10)).toEqual(['a1', 'b1', 'b2', 'a2', 'a3', 'b3', 'a4', 'b4', 'b5', 'a5']);
  });

  it('lässt offene Plätze leer', () => {
    const res = resolveMatches([ko(27, 'Finale', 'Sieger HF1', 'Sieger HF2')], [groupTable('A', A), groupTable('B', B)]);
    expect(finalRanking(res, 10)).toEqual(Array(10).fill(null));
  });

  it('ignoriert Plätze jenseits der Teamanzahl', () => {
    const res = resolveMatches([ko(21, 'Spiel um Platz 9', 'a1', 'a2', [1, 0])], []);
    expect(finalRanking(res, 4)).toEqual([null, null, null, null]);
  });
});
