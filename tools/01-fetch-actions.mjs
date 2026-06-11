// 01-fetch-actions.mjs
// Pulls the COMPLETE Action sheet from XIVAPI v2 (Boilmaster), paginated.
// Writes resources/data/actions.json  (compact id -> {n,i,cd,p,j,cat,lvl})
// and prints stats so we know how many icons we need to bundle.
//
// Run: node tools/01-fetch-actions.mjs
//
// Schema of each entry (kept short to keep the file small):
//   n   = Name
//   i   = icon number as 6-digit string (local file resources/icons/<i>.png)
//   cd  = [CooldownGroup, AdditionalCooldownGroup]  (58 => GCD, like Kagami)
//   p   = IsPlayerAction (1/0)
//   j   = primary ClassJob abbreviation ("" if none)
//   cat = ActionCategory id (1 Auto,2 Spell,3 Weaponskill,4 Ability,...)
//   lvl = ClassJobLevel

import { writeFile } from 'node:fs/promises';

const BASE = 'https://v2.xivapi.com/api';
const FIELDS = [
  'Name', 'Icon', 'CooldownGroup', 'AdditionalCooldownGroup',
  'IsPlayerAction', 'ClassJob.Abbreviation', 'ActionCategory', 'ClassJobLevel',
].join(',');

// icon path "ui/icon/000000/000158.tex" -> "000158"
const iconNum = (icon) => {
  if (!icon || !icon.path) return '';
  const m = /(\d{6})\.tex$/.exec(icon.path);
  return m ? m[1] : '';
};

async function getJSON(url, tries = 4) {
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (t === tries) throw e;
      await new Promise((res) => setTimeout(res, 600 * t));
    }
  }
}

async function main() {
  const out = {};
  let after = null; // cursor (omitted on first page)
  let page = 0;
  let total = 0;

  while (true) {
    const cursor = after === null ? '' : `&after=${after}`;
    const url = `${BASE}/sheet/Action?limit=500${cursor}&fields=${encodeURIComponent(FIELDS)}`;
    const data = await getJSON(url);
    const rows = data.rows || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const f = row.fields || {};
      const i = iconNum(f.Icon);
      // skip rows with no name AND no icon (empty padding rows)
      if (!f.Name && !i) { after = row.row_id; continue; }
      out[row.row_id] = {
        n: f.Name || '',
        i,
        cd: [f.CooldownGroup ?? 0, f.AdditionalCooldownGroup ?? 0],
        p: f.IsPlayerAction ? 1 : 0,
        j: f.ClassJob?.fields?.Abbreviation || '',
        cat: typeof f.ActionCategory === 'object' ? (f.ActionCategory.value ?? 0) : (f.ActionCategory ?? 0),
        lvl: f.ClassJobLevel ?? 0,
      };
      total++;
      after = row.row_id;
    }
    page++;
    if (page % 10 === 0) console.log(`  ...page ${page}, ${total} actions, cursor ${after}`);
  }

  await writeFile(
    new URL('../resources/data/actions.json', import.meta.url),
    JSON.stringify(out)
  );

  // stats
  const all = Object.values(out);
  const playerActs = all.filter((a) => a.p === 1);
  const uniqAll = new Set(all.map((a) => a.i).filter(Boolean));
  const uniqPlayer = new Set(playerActs.map((a) => a.i).filter(Boolean));

  console.log('\n==== ACTIONS DONE ====');
  console.log('total action rows kept :', total);
  console.log('player actions         :', playerActs.length);
  console.log('unique icons (all)     :', uniqAll.size);
  console.log('unique icons (player)  :', uniqPlayer.size);
  console.log('file written           : resources/data/actions.json');
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
