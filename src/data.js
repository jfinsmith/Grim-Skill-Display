// data.js — loads all bundled JSON once at startup (zero build step; plain fetch).

const json = (path) => fetch(path).then((r) => r.json());

export const Data = {
  actions: {},   // id -> {n,i,cd,p,j,cat,lvl}
  items: {},     // itemId -> {n,i}
  mounts: {},    // mountId -> {n,i}
  classjob: {},  // ABBR -> [flags]
  lang: {},      // dictionary
  settings: {},  // default settings
  jobOrder: [],  // ABBR list, index = jobCode used by classjob spritesheet
};

export async function loadData() {
  const [actions, items, mounts, classjob, lang, settings] = await Promise.all([
    json('./resources/data/actions.json'),
    json('./resources/data/items.json'),
    json('./resources/data/mounts.json'),
    json('./resources/data/classjob.json'),
    json('./resources/data/lang.json'),
    json('./resources/data/settings.json'),
  ]);
  Data.actions = actions;
  Data.items = items;
  Data.mounts = mounts;
  Data.classjob = classjob;
  Data.lang = lang;
  Data.settings = settings;
  Data.jobOrder = Object.keys(classjob);
  return Data;
}

// Resolve a local icon path from a 6-digit icon number.
export const iconPath = (num) => (num ? `./resources/icons/${num}.png` : '');

// Look up an action; returns a normalized object or null.
export function lookupAction(actionID) {
  const a = Data.actions[actionID];
  if (!a) return null;
  return {
    id: actionID,
    name: a.n,
    icon: a.i,
    cooldownGroup: a.cd || [0, 0],
    isPlayer: a.p === 1,
    job: a.j || '',
    category: a.cat || 0,
    level: a.lvl || 0,
  };
}

// Look up a consumable item (for item-use actions). Returns {name, icon} or null.
export function lookupItem(itemID) {
  const it = Data.items[itemID];
  return it ? { name: it.n, icon: it.i } : null;
}

// Look up a mount (for mount-summon actions). Returns {name, icon} or null.
export function lookupMount(mountID) {
  const m = Data.mounts[mountID];
  return m ? { name: m.n, icon: m.i } : null;
}
