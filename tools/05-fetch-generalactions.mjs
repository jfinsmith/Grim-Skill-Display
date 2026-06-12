// 05-fetch-generalactions.mjs
// "General actions" (Desynthesis, Repair, Materia Extraction, Teleport, Return, etc.) aren't
// combat Actions — they log against an empty Action row whose icon is the 000405 fallback, so
// they'd show the generic icon. This builds a Name -> icon map from the GeneralAction sheet,
// which the overlay uses as a fallback (by the log's action name), and downloads any icons we
// don't already have.
//
// Run: node tools/05-fetch-generalactions.mjs

import { writeFile, mkdir, readdir } from 'node:fs/promises';

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
  const data = await getJSON(`${BASE}/sheet/GeneralAction?limit=200&fields=${encodeURIComponent('Name,Icon')}`);
  const map = {};
  for (const row of data.rows || []) {
    const f = row.fields || {};
    const i = iconNum(f.Icon);
    if (!f.Name || !i || i === '000405' || i === '000000') continue;
    map[f.Name] = i;
  }
  await writeFile(new URL('../resources/data/generalactions.json', import.meta.url), JSON.stringify(map));
  console.log(`general actions mapped: ${Object.keys(map).length}`);

  const have = new Set((await readdir(ICON_DIR)).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', '')));
  const need = [...new Set(Object.values(map))].filter((n) => !have.has(n));
  console.log(`icons to download: ${need.length}`);
  let ok = 0;
  for (const num of need) { if (await downloadIcon(num)) ok++; }
  console.log(`downloaded ${ok}/${need.length}`);
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
