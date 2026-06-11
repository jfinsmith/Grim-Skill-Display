// 03-fetch-consumables.mjs
// Pulls battle consumables (Medicine = tinctures/potions) from the Item sheet
// and downloads their icons into resources/icons/. Writes resources/data/items.json
// mapping itemID -> { n:Name, i:icon6digit }.
//
// In the ACT log, using an item shows as actionID = 0x2000000 | itemID, so the
// overlay computes itemID = actionID & 0xffffff and looks it up here.
//
// Run: node tools/03-fetch-consumables.mjs

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
  const url = `${BASE}/asset?path=ui/icon/${folderOf(num)}/${num}_hr1.tex&format=png`;
  const r = await fetch(url);
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100) return false;
  await writeFile(new URL(`${num}.png`, ICON_DIR), buf);
  return true;
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  // page the Item sheet, keep only Medicine category (battle tinctures/potions)
  const items = {};
  let after = null, page = 0, kept = 0;
  while (true) {
    const cursor = after === null ? '' : `&after=${after}`;
    const url = `${BASE}/sheet/Item?limit=500${cursor}&fields=${encodeURIComponent('Name,Icon,ItemUICategory.Name')}`;
    const data = await getJSON(url);
    const rows = data.rows || [];
    if (!rows.length) break;
    for (const row of rows) {
      const f = row.fields || {};
      const cat = f.ItemUICategory?.fields?.Name || '';
      after = row.row_id;
      if (cat !== 'Medicine') continue;
      const i = iconNum(f.Icon);
      if (!f.Name || !i) continue;
      items[row.row_id] = { n: f.Name, i };
      kept++;
    }
    if (++page % 20 === 0) console.log(`  ...page ${page}, ${kept} medicines, cursor ${after}`);
  }
  await writeFile(new URL('../resources/data/items.json', import.meta.url), JSON.stringify(items));
  console.log(`\nMedicine items kept: ${kept}`);

  // download any icons not already present
  const have = new Set((await readdir(ICON_DIR)).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', '')));
  const need = [...new Set(Object.values(items).map((x) => x.i))].filter((n) => !have.has(n));
  console.log(`item icons to download: ${need.length}`);
  let ok = 0;
  for (const num of need) { if (await downloadIcon(num)) ok++; }
  console.log(`downloaded ${ok}/${need.length} item icons`);
  console.log('file written: resources/data/items.json');
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
