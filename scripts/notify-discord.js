// scripts/notify-discord.js
// Mengirim ringkasan hasil test ke Discord (embed) lewat webhook.
// Tidak butuh dependency tambahan (memakai fetch bawaan Node 18+).

const {
  loadResults,
  runContext,
  overallStatus,
  formatDuration,
  toWib,
} = require('./lib/results');

const UI = {
  PASSED: { icon: '✅', verb: 'has passed', color: 3066993 },
  FAILED: { icon: '❌', verb: 'has failed', color: 15158332 },
  CANCELLED: { icon: '⚪', verb: 'was cancelled', color: 9807270 },
  'NO RESULTS': { icon: '⚠️', verb: 'finished without any test results', color: 15844367 },
};

const oneLine = (s, max) => {
  const t = String(s || '').replace(/`/g, "'").replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

// Gabung baris-baris sampai batas karakter field Discord (1024)
function joinLimit(lines, limit = 1024) {
  let out = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const next = out ? `${out}\n${lines[i]}` : lines[i];
    if (next.length > limit - 30) break;
    out = next;
  }
  if (i < lines.length) out += `\n…dan ${lines.length - i} lainnya`;
  return out;
}

async function main() {
  const webhook = process.env.DISCORD_WEBHOOK;
  if (!webhook) {
    console.log('::warning::DISCORD_WEBHOOK belum di-set. Notifikasi Discord dilewati.');
    return;
  }

  const ctx = runContext();
  const results = loadResults(process.env.RESULTS_FILE);
  const status = overallStatus(results, process.env.CYPRESS_RESULT);
  const ui = UI[status];

  const reportOk = process.env.REPORT_RESULT === 'success';
  const sheetOk = process.env.SHEET_RESULT === 'success' && ctx.sheetUrl;

  const fields = [];

  if (results) {
    const s = results.stats;

    fields.push({
      name: '📊 Results',
      value:
        '```\n' +
        `Total Runs : ${s.total}\n` +
        `✅ Passed  : ${s.passed}\n` +
        `❌ Failed  : ${s.failed}\n` +
        `⏭️ Skipped : ${s.skipped}\n` +
        `Pass Rate  : ${s.passRate}%\n` +
        '```',
    });

    fields.push({
      name: '🕒 Execution',
      value: `🗓 ${toWib(s.start || new Date())}\n⏱ ${formatDuration(s.durationMs)}`,
    });

    // Ringkasan per spec file
    const specLines = Object.entries(results.specs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([spec, c]) => {
        const icon = c.failed > 0 ? '❌' : c.skipped === c.total ? '⏭️' : '✅';
        return `${icon} \`${spec}\` — ${c.passed}/${c.total} passed`;
      });
    if (specLines.length) fields.push({ name: '🧪 Test Suite', value: joinLimit(specLines) });

    // Detail test yang gagal
    const failedTests = results.tests.filter((t) => t.state === 'FAILED');
    if (failedTests.length) {
      const failLines = failedTests.map(
        (t) => `• **${oneLine(`${t.module} › ${t.title}`, 110)}**\n  ↳ ${oneLine(t.error, 120) || 'tanpa pesan error'}`
      );
      fields.push({ name: `🔥 Failed Tests (${failedTests.length})`, value: joinLimit(failLines) });
    }
  } else {
    fields.push({
      name: '⚠️ Tidak ada hasil test',
      value:
        'Cypress tidak menghasilkan report (kemungkinan gagal saat install/konfigurasi atau crash). ' +
        'Cek log di GitHub Actions.',
    });
  }

  fields.push(
    { name: 'Trigger', value: ctx.event, inline: true },
    { name: 'Branch', value: `${ctx.branch} @ ${ctx.sha}`, inline: true },
    { name: 'Author', value: ctx.actor, inline: true }
  );

  const links = [];
  if (reportOk) links.push(`[📊 HTML Report](${ctx.reportUrl})`);
  if (sheetOk) links.push(`[📗 Google Sheet](${ctx.sheetUrl})`);
  links.push(`[🔎 GitHub Run](${ctx.runUrl})`);
  fields.push({ name: '🔗 Links', value: links.join('  •  ') });

  const notes = [];
  if (process.env.REPORT_RESULT && !reportOk) notes.push('⚠️ Deploy report gagal');
  if (process.env.SHEET_RESULT && process.env.SHEET_RESULT !== 'success') notes.push('⚠️ Update Google Sheet gagal');
  if (notes.length) fields.push({ name: 'Catatan Pipeline', value: notes.join('\n') });

  const payload = {
    username: 'QA Automation',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `Automation Report ${ui.icon}`,
        url: reportOk ? ctx.reportUrl : ctx.runUrl,
        description: `Test Run [#${ctx.runNumber}](${ctx.runUrl}) of the **${ctx.repoName}** ${ui.verb}.`,
        color: ui.color,
        fields,
        footer: { text: `${ctx.repo} | ${ctx.branch} | ${ctx.event}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Discord menolak request: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Notifikasi Discord terkirim (${status}).`);
}

main().catch((err) => {
  console.error(`Gagal kirim notifikasi Discord: ${err.message}`);
  process.exit(1);
});