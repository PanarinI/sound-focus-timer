// ustanovka.mjs — что открывает расширение при установке (14.11).
// Ставит в безголовый Chrome копию сборки «как прод» (без version_name: дев-сборка welcome не открывает нарочно)
// и печатает вкладки, открытые после установки. Живой сайт отрезан (--host-resolver-rules): вкладка откроется,
// но страница не загрузится, и счётчики не засчитают ложную установку.
//   node ustanovka.mjs [путь к dist/unpacked-<в>-dev]
// Ждём: через ~1 с — https://panarini.github.io/focus-pages/welcome/?pinned=1|0&id=<id>
import { spawn } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.argv[2] || join(HERE, '../../../dist/unpacked-1.2.2-dev'));
const work = mkdtempSync(join(tmpdir(), 'welcome-ustanovka-'));
const ext = join(work, 'ext'), prof = join(work, 'prof');
cpSync(SRC, ext, { recursive: true });
const m = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
delete m.version_name;                                   // «как прод»
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(m, null, 2));

const ch = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--use-mock-keychain',
  '--host-resolver-rules=MAP panarini.github.io 127.0.0.1, MAP *.googletagmanager.com 127.0.0.1',
  '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', 'about:blank'
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const out = ch.stdio[3], inp = ch.stdio[4];
let buf = '', seq = 0; const waiting = new Map(); const seen = [];
inp.on('data', (d) => {
  buf += d.toString(); let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    else if (/^Target\.target(Created|InfoChanged)$/.test(msg.method) && msg.params.targetInfo.type === 'page')
      seen.push([Date.now(), msg.params.targetInfo.url]);
  }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; waiting.set(id, r); out.write(JSON.stringify({ id, method, params }) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await sleep(1200);
  await send('Target.setDiscoverTargets', { discover: true });
  const t0 = Date.now();
  const ld = await send('Extensions.loadUnpacked', { path: ext });
  console.log('расширение:', ld.result ? ld.result.id : JSON.stringify(ld.error));
  await sleep(3500);
  const urls = [...new Map(seen.filter(([, u]) => u && u !== 'about:blank').map(([t, u]) => [u, t - t0])).entries()];
  if (!urls.length) console.log('вкладок не открыто');
  for (const [u, t] of urls) console.log(`+${t} мс  ${u}`);
} finally {
  ch.kill(); await sleep(300); rmSync(work, { recursive: true, force: true });
}
