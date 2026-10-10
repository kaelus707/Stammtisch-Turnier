export const clock = (ts: number): string =>
  new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
