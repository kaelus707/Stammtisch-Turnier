export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'gerade eben';
  if (s < 60) return `vor ${s} s`;
  return `vor ${Math.floor(s / 60)} min`;
}

export const clock = (ts: number): string =>
  new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
