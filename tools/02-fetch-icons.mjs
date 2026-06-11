// 02-fetch-icons.mjs
// Reads resources/data/actions.json, collects every unique icon number,
// and downloads each as an HD PNG into resources/icons/<num>.png.
// Resumable: skips icons already on disk. Re-run any time (e.g. after a patch).
//
// Run: node tools/02-fetch-icons.mjs

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ICON_DIR = new URL('../resources/icons/', import.meta.url);
const CONCURRENCY = 12;

const folderOf = (num) => String(Math.floor(parseInt(num, 10) / 1000) * 1000).padStart(6, '0');
const assetURL = (num) =>
  `https://v2.xivapi.com/api/asset?path=ui/icon/${folderOf(num)}/${num}_hr1.tex&format=png`;

async function download(num, tries = 4) {
  const dest = new URL(`${num}.png`, ICON_DIR);
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(assetURL(num));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) throw new Error('tiny/empty');
      await writeFile(dest, buf);
      return true;
    } catch (e) {
      if (t === tries) { console.warn(`  ! failed ${num}: ${e.message}`); return false; }
      await new Promise((res) => setTimeout(res, 500 * t));
    }
  }
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  const actions = JSON.parse(await readFile(new URL('../resources/data/actions.json', import.meta.url)));

  const wanted = [...new Set(Object.values(actions).map((a) => a.i).filter(Boolean))].sort();
  const have = new Set((await readdir(ICON_DIR)).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', '')));
  const todo = wanted.filter((n) => !have.has(n));

  console.log(`unique icons wanted : ${wanted.length}`);
  console.log(`already on disk      : ${have.size}`);
  console.log(`to download          : ${todo.length}`);

  let ok = 0, fail = 0, done = 0;
  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const num = queue.shift();
      const r = await download(num);
      r ? ok++ : fail++;
      if (++done % 100 === 0) console.log(`  ...${done}/${todo.length} (${ok} ok, ${fail} fail)`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\n==== ICONS DONE ====`);
  console.log(`downloaded ok : ${ok}`);
  console.log(`failed        : ${fail}`);
  console.log(`total on disk : ${(await readdir(ICON_DIR)).filter((f) => f.endsWith('.png')).length}`);
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
