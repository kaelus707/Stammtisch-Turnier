import { SHEET_NAMES, type RawSheets, type SheetName } from './parse';

const TIMEOUT_MS = 15_000;

export function sheetUrl(sheetId: string, sheet: SheetName, base: string): string {
  if (!sheetId) return `${base}demo/${sheet}.csv`;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheet)}`;
}

export async function fetchSheets(sheetId: string, base: string, fetchFn: typeof fetch = fetch): Promise<RawSheets> {
  const texts = await Promise.all(
    SHEET_NAMES.map(async (sheet) => {
      // Timeout, damit eine hängende Anfrage die Refresh-Schleife nicht blockiert
      const res = await fetchFn(sheetUrl(sheetId, sheet, base), { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Blatt „${sheet}“: HTTP ${res.status}`);
      return res.text();
    }),
  );
  return Object.fromEntries(SHEET_NAMES.map((s, i) => [s, texts[i]])) as RawSheets;
}
