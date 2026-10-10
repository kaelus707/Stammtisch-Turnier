import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import { planRows, sideLabel, type Group, type PlanSide } from './schedule-gen.ts';

/** Zeile im Blatt Teams: A1–A5 in Zeile 2–6, B1–B5 in Zeile 7–11 */
export const teamRow = (group: Group, i: number): number => 2 + (group === 'B' ? 5 : 0) + i;

const ROWS = planRows();
/** Spielplan-Zeile einer Runde, z. B. „Halbfinale 1“ → 23 */
export const PLAN_ROW = (round: string): number => 2 + ROWS.findIndex((x) => x.round === round);

export const fx = (formula: string) => ({ formula }) as ExcelJS.CellFormulaValue;
export const CODES = 'Teams!$A$2:$A$11';
export const nameOf = (code: string) => `IFERROR(INDEX(Teams!$B$2:$B$11,MATCH(${code},${CODES},0)),"")`;

// Gruppenspiele stehen im Spielplan in Zeile 2–21
const P = {
  round: 'Spielplan!$D$2:$D$21', codeA: 'Spielplan!$E$2:$E$21', codeB: 'Spielplan!$G$2:$G$21',
  goalsA: 'Spielplan!$I$2:$I$21', goalsB: 'Spielplan!$J$2:$J$21',
};
const DONE = `(${P.goalsA}<>"")*(${P.goalsB}<>"")`;
const INPUT: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const CALC: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };

export function sheet(wb: ExcelJS.Workbook, name: string, columns: [string, number][]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  return ws;
}

/** [Code-Zelle, Platzhalter-Ausdruck oder null bei festem Team] */
function side(s: PlanSide): [string | ExcelJS.CellFormulaValue, string | null] {
  if ('i' in s) return [sideLabel(s), null];
  if ('place' in s) return [fx(`'Gruppe ${s.group}'!$M$${s.place + 1}`), `'Gruppe ${s.group}'!$N$${s.place + 1}`];
  return [fx(`$${s.result === 'Sieger' ? 'L' : 'M'}$${PLAN_ROW(`Halbfinale ${s.semi}`)}`), `"${sideLabel(s)}"`];
}

function planSheet(wb: ExcelJS.Workbook) {
  const plan = sheet(wb, 'Spielplan', [
    ['Nr.', 5], ['Phase', 16], ['Zeit', 7], ['Runde', 18], ['Code A', 8], ['Team A', 26], ['Code B', 8], ['Team B', 26],
    ['Tore A', 7], ['Tore B', 7], ['Sieger', 26], ['Sieger-Code', 11], ['Verlierer-Code', 13],
  ]);
  for (const [k, x] of ROWS.entries()) {
    const r = k + 2;
    const team = (codeCol: string, label: string | null) =>
      fx(label === null ? nameOf(`${codeCol}${r}`) : `IF(${codeCol}${r}="",${label},${nameOf(`${codeCol}${r}`)})`);
    const [codeA, labelA] = side(x.home);
    const [codeB, labelB] = side(x.away);
    const open = `OR(I${r}="",J${r}="")`;
    const row = plan.addRow([
      x.nr, x.phase,
      fx(`TEXT(TIMEVALUE(Einstellungen!$B$4)+(A${r}-1)*(VALUE(Einstellungen!$B$5)+VALUE(Einstellungen!$B$6))/1440,"hh:mm")`),
      x.round, codeA, team('E', labelA), codeB, team('G', labelB), null, null,
      fx(`IF(${open},"",IF(I${r}>J${r},F${r},IF(J${r}>I${r},H${r},"Unentschieden")))`),
      fx(`IF(${open},"",IF(I${r}>J${r},E${r},IF(J${r}>I${r},G${r},"")))`),
      fx(`IF(${open},"",IF(I${r}>J${r},G${r},IF(J${r}>I${r},E${r},"")))`),
    ]);
    row.getCell(9).fill = INPUT;
    row.getCell(10).fill = INPUT;
  }
  plan.getColumn(12).hidden = true;
  plan.getColumn(13).hidden = true;
}

const CALC_COLS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA',
];

function groupSheet(wb: ExcelJS.Workbook, g: Group) {
  const ws = sheet(wb, `Gruppe ${g}`, [
    ['Platz', 6], ['Code', 6], ['Team', 24], ['Sp', 5], ['S', 5], ['U', 5], ['N', 5], ['Tore', 6], ['Gegentore', 10],
    ['Diff', 6], ['Pkt', 6], ['Hinweis', 16], ['KO-Code', 9], ['Platzhalter', 26],
  ]);
  // Rechenhilfe: eine Zeile pro Team X1–X5 in Zeile 10–14
  const first = 10;
  const codes = [1, 2, 3, 4, 5].map((n) => `${g}${n}`);
  const all = (c: string) => `$${c}$${first}:$${c}$${first + 4}`;
  ws.getCell('A8').value = 'Rechenhilfe – nicht bearbeiten';
  ws.getCell('A8').font = { bold: true };
  ws.getRow(9).values = [
    'Code', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Gegentore', 'Diff', 'Pkt',
    ...codes.map((c) => `Mini-Pkt ${c}`), ...codes.map((c) => `Mini-Diff ${c}`),
    'Mini-Pkt', 'Mini-Diff', 'Los', 'Schlüssel', 'Rang', 'Los offen', 'Anzeigeplatz',
  ];
  for (const [k, code] of codes.entries()) {
    const r = first + k;
    const me = `$A${r}`;
    const home = `(${P.codeA}=${me})`;
    const away = `(${P.codeB}=${me})`;
    // Mini-Tabelle: nur Spiele gegen Teams mit gleichen Punkten und gleicher Tordifferenz zählen
    const vs = (j: number, pts: boolean) => {
      const opp = `$A$${first + j}`;
      const tie = `($J$${first + j}=$J${r})*($I$${first + j}=$I${r})`;
      const v = pts
        ? `SUMPRODUCT(${home}*(${P.codeB}=${opp})*${DONE}*(3*(${P.goalsA}>${P.goalsB})+(${P.goalsA}=${P.goalsB})))` +
          `+SUMPRODUCT(${away}*(${P.codeA}=${opp})*${DONE}*(3*(${P.goalsB}>${P.goalsA})+(${P.goalsA}=${P.goalsB})))`
        : `SUMPRODUCT(${home}*(${P.codeB}=${opp})*${DONE}*(${P.goalsA}-${P.goalsB}))+SUMPRODUCT(${away}*(${P.codeA}=${opp})*${DONE}*(${P.goalsB}-${P.goalsA}))`;
      return fx(`(${v})*${tie}`);
    };
    const lot = `INDEX(Teams!$D$2:$D$11,MATCH(${me},${CODES},0))`;
    ws.getRow(r).values = [
      code,
      fx(nameOf(me)),
      fx(`SUMPRODUCT((${home}+${away})*${DONE})`),
      fx(`SUMPRODUCT(${home}*${DONE}*(${P.goalsA}>${P.goalsB}))+SUMPRODUCT(${away}*${DONE}*(${P.goalsB}>${P.goalsA}))`),
      fx(`SUMPRODUCT((${home}+${away})*${DONE}*(${P.goalsA}=${P.goalsB}))`),
      fx(`C${r}-D${r}-E${r}`),
      fx(`SUMPRODUCT(${home}*${DONE}*${P.goalsA})+SUMPRODUCT(${away}*${DONE}*${P.goalsB})`),
      fx(`SUMPRODUCT(${home}*${DONE}*${P.goalsB})+SUMPRODUCT(${away}*${DONE}*${P.goalsA})`),
      fx(`G${r}-H${r}`),
      fx(`3*D${r}+E${r}`),
      ...[0, 1, 2, 3, 4].map((j) => vs(j, true)),
      ...[0, 1, 2, 3, 4].map((j) => vs(j, false)),
      fx(`SUM(K${r}:O${r})`),
      fx(`SUM(P${r}:T${r})`),
      fx(`IF(${lot}="","",${lot})`),
      // Punkte, Diff, Mini-Pkt, Mini-Diff, Tore als eine Zahl (< 15 Stellen, also exakt)
      fx(`J${r}*10^11+(I${r}+500)*10^8+U${r}*10^6+(V${r}+500)*10^3+G${r}`),
      fx(`1+SUMPRODUCT(--(${all('X')}>X${r}))+SUMPRODUCT((${all('X')}=X${r})*(${all('W')}<>"")*(W${r}<>"")*(${all('W')}<W${r}))`),
      fx(`IF(SUMPRODUCT((${all('X')}=X${r})*(${all('A')}<>A${r})*(((${all('W')}="")+(W${r}="")+(${all('W')}=W${r}))>0))>0,1,0)`),
      fx(`Y${r}+SUMPRODUCT((${all('Y')}=Y${r})*(${all('A')}<A${r}))`),
    ];
    for (const c of CALC_COLS) ws.getCell(`${c}${r}`).fill = CALC;
  }
  ws.getCell('A16').value = 'Gruppe komplett';
  ws.getCell('B16').value = fx(`IF(SUMPRODUCT((${P.round}="Gruppe ${g}")*${DONE})=10,1,0)`);

  // Anzeige: Platz p holt die Zeile mit Anzeigeplatz p
  for (let p = 1; p <= 5; p++) {
    const row = p + 1;
    const at = (c: string) => fx(`INDEX(${all(c)},MATCH($A${row},${all('AA')},0))`);
    ws.getRow(row).values = [
      p, at('A'), at('B'), at('C'), at('D'), at('E'), at('F'), at('G'), at('H'), at('I'), at('J'),
      fx(`IF(AND($B$16=1,INDEX(${all('Z')},MATCH($A${row},${all('AA')},0))=1),"Los ausstehend","")`),
      fx(`IF(AND($B$16=1,L${row}=""),B${row},"")`),
      fx(`A${row}&". Gr. ${g}"&IF(L${row}<>""," (Los ausstehend)","")`),
    ];
  }
}

export function buildWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const settings = sheet(wb, 'Einstellungen', [['Feld', 22], ['Wert', 30]]);
  settings.addRows([
    ['Turniername', 'Stammtischturnier 2026'],
    ['Datum', '14.11.2026'],
    ['Startzeit', '14:00'],
    ['Spieldauer (Min.)', '10'],
    ['Pause (Min.)', '2'],
  ]);
  // gviz wählt pro Spalte einen Datentyp und leert Zellen anderer Typen – daher alles als Text
  settings.getColumn(2).eachCell((c) => (c.numFmt = '@'));

  const teams = sheet(wb, 'Teams', [['Code', 6], ['Team', 24], ['Gruppe', 8], ['Los', 6]]);
  for (const g of ['A', 'B'] as const)
    for (let i = 1; i <= 5; i++) {
      const row = teams.addRow([`${g}${i}`, `Team ${g}${i}`, g, null]);
      row.getCell(2).fill = INPUT;
      row.getCell(4).fill = INPUT;
    }

  planSheet(wb);
  groupSheet(wb, 'A');
  groupSheet(wb, 'B');

  const players = sheet(wb, 'Spieler', [['Name', 24], ['Team', 24], ['Tore', 6]]);
  players.addRow(['Max Mustermann', 'Team A1', 0]);

  return wb;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('vorlage', { recursive: true });
  await buildWorkbook().xlsx.writeFile('vorlage/stammtisch-turnier.xlsx');
  console.log('vorlage/stammtisch-turnier.xlsx geschrieben');
}
