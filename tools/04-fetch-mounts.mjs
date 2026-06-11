// 04-fetch-mounts.mjs
// Pulls the Mount sheet and downloads mount icons. Writes resources/data/mounts.json
// mapping mountID -> { n:Name, i:icon6digit }.
// In the ACT log a mount summon shows as actionID = 0x4000000 | mountID.
//
// Run: node tools/04-fetch-mounts.mjs

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

const BASE = 'https://v2.xivapi.com/api';
const ICON_DIR = new URL('../resources/icons/', import.meta.url);
const folderOf = (num) => String(Math.floor(parseInt(num, 10) / 1000) * 1000).padStart(6, '0');
const iconNum = (icon) => (icon?.path ? (/(\d{6})\.tex$/.exec(icon.path)?.[1] || '') : '');

async function getJSON(url, tries = 4) {
  for (let t = 1; t <= tries; t++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    catch (e) { if (t === tries) throw e; await new Promise((s) => setTimeout(s, 600 * t)); }
  }
}
async function downloadIcon(num) {
  const r = await fetch(`${BASE}/asset?path=ui/icon/${folderOf(num)}/${num}_hr1.tex&format=png`);
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100) return false;
  await writeFile(new URL(`${num}.png`, ICON_DIR), buf);
  return true;
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  const mounts = {};
  let after = null, page = 0, kept = 0;
  while (true) {
    const cursor = after === null ? '' : `&after=${after}`;
    const url = `${BASE}/sheet/Mount?limit=500${cursor}&fields=${encodeURIComponent('Singular,Icon')}`;
    const data = await getJSON(url);
    const rows = data.rows || [];
    if (!rows.length) break;
    for (const row of rows) {
      const f = row.fields || {};
      after = row.row_id;
      const i = iconNum(f.Icon);
      const name = f.Singular || '';
      if (!name || !i) continue;
      mounts[row.row_id] = { n: name.replace(/\b\w/g, (c) => c.toUpperCase()), i };
      kept++;
    }
    if (++page % 5 === 0) console.log(`  ...page ${page}, ${kept} mounts`);
  }
  await writeFile(new URL('../resources/data/mounts.json', import.meta.url), JSON.stringify(mounts));
  console.log(`mounts kept: ${kept}`);

  const have = new Set((await readdir(ICON_DIR)).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', '')));
  const need = [...new Set(Object.values(mounts).map((x) => x.i))].filter((n) => !have.has(n));
  console.log(`mount icons to download: ${need.length}`);
  let ok = 0;
  const q = [...need];
  await Promise.all(Array.from({ length: 12 }, async () => { while (q.length) { if (await downloadIcon(q.shift())) ok++; } }));
  console.log(`downloaded ${ok}/${need.length} mount icons`);
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
