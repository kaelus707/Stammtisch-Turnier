import { describe, expect, it } from 'vitest';
import { fetchSheets, sheetUrl } from './sheets';

describe('sheetUrl', () => {
  it('baut die gviz-CSV-URL mit kodiertem Blattnamen', () => {
    expect(sheetUrl('abc', 'Spielplan', '/x/')).toBe(
      'https://docs.google.com/spreadsheets/d/abc/gviz/tq?tqx=out:csv&headers=1&sheet=Spielplan',
    );
  });

  it('nutzt ohne Sheet-ID die Demo-Dateien unter base', () => {
    expect(sheetUrl('', 'Teams', '/Stammtisch-Turnier/')).toBe('/Stammtisch-Turnier/demo/Teams.csv');
  });
});

describe('fetchSheets', () => {
  it('lädt alle 4 Blätter mit Timeout-Signal und ohne Cache', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(`csv:${url.split('/').pop()}`);
    }) as typeof fetch;
    const raw = await fetchSheets('', '/', fake);
    expect(raw.Spieler).toBe('csv:Spieler.csv');
    expect(calls).toHaveLength(4);
    expect(calls[0][1]?.cache).toBe('no-store');
    expect(calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('wirft bei HTTP-Fehlern', async () => {
    const fake = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(fetchSheets('', '/', fake)).rejects.toThrow('HTTP 404');
  });
});
