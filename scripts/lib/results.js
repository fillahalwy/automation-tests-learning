// scripts/lib/results.js
// Helper bersama untuk sheets-updater.js dan notify-discord.js:
// - membaca merged.json (hasil mochawesome-merge)
// - menormalkan hasil test jadi struktur yang mudah dipakai
// - membaca konteks run GitHub Actions dari environment variable

const fs = require('fs');

// Hapus kode warna ANSI dari pesan error Cypress
const stripAnsi = (s = '') => String(s).replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

function formatDuration(ms) {
  const total = Math.round((ms || 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTestDuration(ms) {
  const v = ms || 0;
  return v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`;
}

function toWib(date = new Date()) {
  return new Date(date).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + ' WIB';
}

// cart/add-to-cart.cy.js -> "cart" ; checkout.cy.js -> "checkout"
function moduleOf(spec) {
  const parts = spec.split('/');
  return parts.length > 1 ? parts[0] : spec.replace(/\.(cy|spec)\.[jt]sx?$/, '');
}

function walk(suites, parents, spec, out) {
  for (const s of suites || []) {
    const trail = s.title ? [...parents, s.title] : parents;
    for (const t of s.tests || []) {
      out.push({
        spec,
        module: moduleOf(spec),
        suite: trail.join(' › '),
        title: t.title,
        state: t.state === 'passed' ? 'PASSED' : t.state === 'failed' ? 'FAILED' : 'SKIPPED',
        durationMs: t.duration || 0,
        error: t.err && t.err.message ? stripAnsi(t.err.message).trim() : '',
      });
    }
    walk(s.suites, trail, spec, out);
  }
}

// Return null kalau file tidak ada / rusak (mis. Cypress crash sebelum menghasilkan report)
function loadResults(file = 'merged.json') {
  if (!fs.existsSync(file)) return null;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`::warning::Gagal parse ${file}: ${err.message}`);
    return null;
  }

  const tests = [];
  for (const r of data.results || []) {
    const rawPath = (r.fullFile || r.file || '').replace(/\\/g, '/');
    const spec =
      rawPath.replace(/^.*cypress\/e2e\//, '') ||
      (r.suites && r.suites[0] && r.suites[0].title) ||
      'unknown';
    walk([{ title: '', tests: r.tests, suites: r.suites }], [], spec, tests);
  }

  const count = (state) => tests.filter((t) => t.state === state).length;
  let total = tests.length;
  let passed = count('PASSED');
  let failed = count('FAILED');
  const skipped = count('SKIPPED');

  // Kegagalan di hook (before/beforeEach) tidak tercatat sebagai test, tapi masuk stats.failures
  const statFailures = (data.stats && data.stats.failures) || 0;
  if (statFailures > failed) {
    total += statFailures - failed;
    failed = statFailures;
  }

  const specs = {};
  for (const t of tests) {
    specs[t.spec] ||= { total: 0, passed: 0, failed: 0, skipped: 0 };
    specs[t.spec].total += 1;
    specs[t.spec][t.state.toLowerCase()] += 1;
  }

  const stats = {
    total,
    passed,
    failed,
    skipped,
    passRate: total ? Math.round((passed / total) * 1000) / 10 : 0,
    durationMs: (data.stats && data.stats.duration) || tests.reduce((a, t) => a + t.durationMs, 0),
    start: data.stats && data.stats.start,
  };

  return { tests, specs, stats };
}

// PASSED | FAILED | CANCELLED | NO RESULTS
function overallStatus(results, cypressJobResult) {
  if (!results) return 'NO RESULTS';
  if (results.stats.failed > 0) return 'FAILED';
  if (cypressJobResult && cypressJobResult !== 'success') {
    return cypressJobResult === 'cancelled' ? 'CANCELLED' : 'FAILED';
  }
  return 'PASSED';
}

function runContext() {
  const e = process.env;
  const repo = e.GITHUB_REPOSITORY || 'local/repo';
  const [owner, repoName] = repo.split('/');
  const server = e.GITHUB_SERVER_URL || 'https://github.com';
  const runNumber = e.GITHUB_RUN_NUMBER || '0';
  const sha = e.GITHUB_SHA || '';
  return {
    repo,
    repoName,
    runNumber,
    runUrl: `${server}/${repo}/actions/runs/${e.GITHUB_RUN_ID || ''}`,
    // Report di-deploy ke GitHub Pages: tiap run punya folder sendiri (run-<nomor>)
    reportUrl: `https://${owner.toLowerCase()}.github.io/${repoName}/run-${runNumber}/`,
    sheetUrl: e.GSHEET_URL || '',
    event: e.GITHUB_EVENT_NAME || 'manual',
    // Untuk pull_request, GITHUB_REF_NAME berisi "12/merge", jadi pakai HEAD_REF
    branch: e.GITHUB_HEAD_REF || e.GITHUB_REF_NAME || '-',
    sha: sha.slice(0, 7),
    commitUrl: `${server}/${repo}/commit/${sha}`,
    actor: e.GITHUB_ACTOR || '-',
  };
}

module.exports = {
  stripAnsi,
  formatDuration,
  formatTestDuration,
  toWib,
  loadResults,
  overallStatus,
  runContext,
};