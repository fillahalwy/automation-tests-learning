// scripts/sheets-updater.js
// Menulis hasil test ke Google Sheet:
//   - Tab "Summary"    : 1 baris per run pipeline
//   - Tab "Test Cases" : 1 baris per test case per run
// Baris terbaru selalu ditaruh paling atas (tepat di bawah header).

const { google } = require('googleapis');
const {
  loadResults,
  runContext,
  overallStatus,
  formatDuration,
  formatTestDuration,
  toWib,
} = require('./lib/results');

// ---------- Definisi tab ----------
const SUMMARY = {
  title: 'Summary',
  headers: [
    'Run #', 'Tanggal (WIB)', 'Status', 'Trigger', 'Branch', 'Commit', 'Actor',
    'Total', 'Passed', 'Failed', 'Skipped', 'Pass Rate (%)', 'Durasi', 'Report', 'GitHub Run',
  ],
  widths: [60, 170, 100, 130, 120, 90, 120, 60, 70, 70, 70, 100, 80, 110, 110],
  centerCols: [0, 2, 7, 8, 9, 10, 11, 12],
  statusCol: 2,
};

const CASES = {
  title: 'Test Cases',
  headers: ['Run #', 'Tanggal (WIB)', 'Modul', 'Spec File', 'Test Suite', 'Test Case', 'Status', 'Durasi', 'Error Message'],
  widths: [60, 170, 100, 220, 220, 320, 100, 80, 450],
  centerCols: [0, 2, 6, 7],
  statusCol: 6,
};

// ---------- Warna ----------
const WHITE = { red: 1, green: 1, blue: 1 };
const HEADER_BG = { red: 0.13, green: 0.2, blue: 0.33 };
const STATUS_RULES = [
  ['PASSED', { red: 0.85, green: 0.94, blue: 0.85 }, { red: 0.1, green: 0.5, blue: 0.2 }],
  ['FAILED', { red: 0.96, green: 0.8, blue: 0.8 }, { red: 0.7, green: 0.1, blue: 0.1 }],
  ['SKIPPED', { red: 1, green: 0.95, blue: 0.8 }, { red: 0.6, green: 0.45, blue: 0 }],
  ['NO RESULTS', { red: 0.99, green: 0.88, blue: 0.7 }, { red: 0.6, green: 0.3, blue: 0 }],
  ['CANCELLED', { red: 0.9, green: 0.9, blue: 0.9 }, { red: 0.3, green: 0.3, blue: 0.3 }],
];

// ---------- Helper Google Sheets ----------
function formatRequests(sheetId, def) {
  const n = def.headers.length;
  const reqs = [
    // Header: tebal, putih, background gelap
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: n },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, foregroundColor: WHITE },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 34 },
        fields: 'pixelSize',
      },
    },
    // Body: rata atas + wrap text
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: n },
        cell: { userEnteredFormat: { verticalAlignment: 'TOP', wrapStrategy: 'WRAP' } },
        fields: 'userEnteredFormat(verticalAlignment,wrapStrategy)',
      },
    },
    // Filter di header (bisa filter by Status / Modul)
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: n } } } },
  ];

  def.widths.forEach((px, i) =>
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: 'pixelSize',
      },
    })
  );

  def.centerCols.forEach((c) =>
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    })
  );

  // Warna otomatis di kolom Status
  STATUS_RULES.forEach(([text, bg, fg]) =>
    reqs.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: def.statusCol, endColumnIndex: def.statusCol + 1 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] },
            format: { backgroundColor: bg, textFormat: { bold: true, foregroundColor: fg } },
          },
        },
      },
    })
  );

  return reqs;
}

// Buat tab + header + format kalau belum ada. Kalau sudah ada, dipakai apa adanya.
async function ensureSheet(sheets, spreadsheetId, def, existing) {
  const found = existing.find((s) => s.properties.title === def.title);
  if (found) return { title: def.title, sheetId: found.properties.sheetId };

  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: def.title, gridProperties: { frozenRowCount: 1 } } } }],
    },
  });
  const sheetId = res.data.replies[0].addSheet.properties.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${def.title}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [def.headers] },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests(sheetId, def) },
  });

  console.log(`Tab "${def.title}" dibuat.`);
  return { title: def.title, sheetId };
}

// Sisipkan baris baru tepat di bawah header (data terbaru di atas)
async function prependRows(sheets, spreadsheetId, sheet, rows, valueInputOption) {
  if (!rows.length) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId: sheet.sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + rows.length },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheet.title}'!A2`,
    valueInputOption,
    requestBody: { values: rows },
  });
}

const link = (url, label) => `=HYPERLINK("${url}","${label}")`;
const oneLine = (s, max) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

// ---------- Main ----------
async function main() {
  const { GOOGLE_CREDENTIALS, GSHEET_ID } = process.env;
  if (!GOOGLE_CREDENTIALS || !GSHEET_ID) {
    console.log('::warning::GOOGLE_CREDENTIALS / GSHEET_ID belum di-set (mis. PR dari fork). Update Google Sheet dilewati.');
    return;
  }

  const ctx = runContext();
  const results = loadResults(process.env.RESULTS_FILE);
  const status = overallStatus(results, process.env.CYPRESS_RESULT);
  const s = results ? results.stats : { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0, durationMs: 0 };
  const when = toWib(results && s.start ? s.start : new Date());
  const reportOk = process.env.REPORT_RESULT === 'success';

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: GSHEET_ID });
  const existing = meta.data.sheets || [];
  const summarySheet = await ensureSheet(sheets, GSHEET_ID, SUMMARY, existing);
  const casesSheet = await ensureSheet(sheets, GSHEET_ID, CASES, existing);

  // Tab "Test Cases" (RAW: teks error tidak akan dianggap formula)
  if (results) {
    const caseRows = results.tests.map((t) => [
      Number(ctx.runNumber),
      when,
      t.module,
      t.spec,
      t.suite,
      t.title,
      t.state,
      formatTestDuration(t.durationMs),
      oneLine(t.error, 400),
    ]);
    await prependRows(sheets, GSHEET_ID, casesSheet, caseRows, 'RAW');
  }

  // Tab "Summary" (USER_ENTERED: supaya =HYPERLINK() berfungsi)
  const summaryRow = [
    Number(ctx.runNumber),
    when,
    status,
    ctx.event,
    ctx.branch,
    link(ctx.commitUrl, ctx.sha),
    ctx.actor,
    s.total,
    s.passed,
    s.failed,
    s.skipped,
    s.passRate,
    formatDuration(s.durationMs),
    reportOk ? link(ctx.reportUrl, 'Open Report') : 'N/A',
    link(ctx.runUrl, 'View Run'),
  ];
  await prependRows(sheets, GSHEET_ID, summarySheet, [summaryRow], 'USER_ENTERED');

  console.log(`Google Sheet diperbarui: run #${ctx.runNumber} (${status}), ${s.total} test case.`);
}

main().catch((err) => {
  console.error(`Gagal update Google Sheet: ${err.message}`);
  process.exit(1);
});