// parser.js — interprets ACT log lines & combat data, drives every feature module.
// Battle-log handling is ported from kagami (handleAction / parseMessage) and extended
// with: local item lookup, GCD/clip tracking, live DoT detection, multi-metric meter.

import { Data, lookupAction, lookupItem, lookupMount } from './data.js';
import { get } from './store.js';
import { renderAction, renderAutoAttack, appendErrorIcon, clearBars } from './bar.js';
import { onStatusGain, onStatusLose, clearDots } from './dots.js';
import { updateMeter } from './meter.js';
import * as rot from './rotation.js';
import { updateHeader, setJobIcon } from './header.js';
import * as feat from './features.js';

const player = { charID: -1, charName: 'Grim', job: 'ADV', petID: -1 };
let active = false;
let lastTs = -1, lastId = -1;
let lastAutoAttack = -1;       // ms timestamp of previous auto-attack (for interval display)
let lastGcdMs = -1;            // ms timestamp of previous GCD (for downtime markers)
let lastCast = null;           // last casting action (for interrupt marking)
const petActions = [];         // pending pet actions for ghost validation
let petLastCast = null;
const recentCasts = new Map();  // `${actorID}:${actionID}` -> ms, to de-dupe cast-start vs completion

const ITEM_FLAG = 0x2000000;
const MOUNT_FLAG = 0x4000000;

/* ---------------- entry point ---------------- */
export function handleEvent(event) {
  const { type, message } = event;
  if (type === 'LogLine') parseLogLine(message);
  else if (type === 'ChangePrimaryPlayer') Object.assign(player, message);
  else if (type === 'CombatData') updateCombat(message);
}

/* ---------------- log lines ---------------- */
function parseLogLine(split) {
  const [code, ts, ...p] = split;
  switch (code) {
    case '00': feat.maybeCountdown(p); break;
    case '03': addPet(p); break;
    case '04': removePet(p); break;
    case '20': case '21': case '22': handleAction(code, ts, p); break;
    case '23': handleInterrupt(p); break;
    case '25': if (parseInt(p[0], 16) === player.charID) feat.onDeath(); break;
    case '26': onStatusGain(p, player.charID); feat.onBuffGain(p, player.charID); break;
    case '30': onStatusLose(p, player.charID); feat.onBuffLose(p, player.charID); break;
    case '37': handleHit(p); break;
    default: break;
  }
}

function addPet(p) {
  const id = parseInt(p[0], 16);
  const owner = parseInt(p[4], 16);
  const charType = parseInt(p[7], 16);
  if (charType === 0) return;               // chocobo, ignore
  if (owner === player.charID) player.petID = id;
}
function removePet(p) {
  const id = parseInt(p[0], 16);
  if (id === player.petID) ghostPet(id);
}

function handleHit(p) {
  const hitID = parseInt(p[2], 16);
  for (let i = petActions.length - 1; i >= 0; i--) {
    if (petActions[i].hitID === hitID) petActions.splice(i, 1);
  }
}

function ghostPet(petID) {
  if (!get('validatePetActions')) return;
  for (let i = petActions.length - 1; i >= 0; i--) {
    if (petActions[i].actorID === petID) {
      appendErrorIcon(petActions[i].iconEl, 'interrupted');
      rot.stats.petGhost++;
      petActions.splice(i, 1);
    }
  }
}

function handleInterrupt(p) {
  const actorID = parseInt(p[0], 16);
  if (lastCast && actorID === player.charID && actorID === lastCast.actorID) {
    appendErrorIcon(lastCast.iconEl, 'interrupted');
  } else if (petLastCast && actorID === player.petID && actorID === petLastCast.actorID) {
    appendErrorIcon(petLastCast.iconEl, 'interrupted');
    rot.stats.petGhost++;
  }
}

function handleAction(code, ts, p) {
  const actionID = parseInt(p[2], 16);
  const actorID = parseInt(p[0], 16);
  const castTime = code === '20' ? Math.ceil(parseFloat(p[6]) * 100) : 0;

  // de-dupe AoE (one cast -> many target lines)
  if (ts === lastTs && actionID === lastId) return;
  lastTs = ts; lastId = actionID;

  // who?
  let lane = null;
  if (actorID === player.charID) lane = 'player';
  else if (actorID === player.petID) lane = 'pet';
  else return;

  // auto-attacks (use the real crossed-swords icon; show interval to gauge skill/spell speed)
  if (actionID === 7 || actionID === 8) {
    if (lane === 'player' && get('showAutoAttacks')) {
      let interval = 0;
      if (lastAutoAttack > 0) interval = (Date.now() - lastAutoAttack) / 1000;
      lastAutoAttack = Date.now();
      renderAutoAttack({ icon: '000101', name: 'Auto-attack', cooldownGroup: [0, 0] }, interval);
    }
    return;
  }

  // resolve action / item / mount into a renderable
  const action = resolveAction(actionID, p);
  action.actorID = actorID;
  let ct = castTime;
  if (lane === 'player' && ct > 66) ct -= 66; // kagami: trim the ~animation lock

  const casting = code === '20';

  // suppress the generic "Mount" pre-cast (action ID 4) — the specific mount summon
  // (actionID >= 0x4000000) is shown instead. ID-based so it works in every language.
  if (actionID === 4) return;

  // cast de-duplication: by default ("press" mode) show one icon per skill use.
  // a hard cast fires a cast-start (20) then a completion (21) for the same id — keep the
  // cast-start (with its bar) and drop the matching completion so it isn't shown twice.
  const castKey = `${actorID}:${actionID}`;
  if (get('castMode') === 'press') {
    if (casting) {
      recentCasts.set(castKey, Date.now());
    } else if (recentCasts.has(castKey)) {
      const dt = Date.now() - recentCasts.get(castKey);
      recentCasts.delete(castKey);
      // this code-21 is the completion of a cast we already drew (and already counted at
      // cast-start), so just drop it — don't re-count or re-render.
      if (dt < 12000) return;
    }
  }

  const classes = [];
  if (casting) classes.push('casting');

  // positional + GCD/clip only for real player skills (not items/mounts)
  if (lane === 'player' && action.isReal) {
    if (get('checkPositionals') && rot.isPositional(actionID)) {
      const ok = rot.checkPositional({ id: actionID }, p);
      if (!ok) { classes.push('mispositional'); rot.stats.mispositional++; }
    }
    const gcd = Array.isArray(action.cooldownGroup) && action.cooldownGroup.includes(58);
    if (gcd && get('trackClipping')) rot.noteGcd(Date.now());
    // approximate downtime marker: a long gap between GCDs during combat
    if (gcd) {
      if (active && lastGcdMs > 0 && Date.now() - lastGcdMs > 6000 && get('showDeathMarkers')) {
        feat.addMarker('downtime', '↓');
      }
      lastGcdMs = Date.now();
    }
  }

  const iconEl = renderAction(action, { lane, castTime: ct, classes });
  action.iconEl = iconEl;

  // record for the pull review / summary
  feat.recordPullAction({
    t: Date.now(), name: action.name, icon: action.icon, lane,
    gcd: Array.isArray(action.cooldownGroup) && action.cooldownGroup.includes(58),
    error: classes.find((c) => c === 'mispositional' || c === 'interrupted') || '',
  });

  if (lane === 'player' && casting) lastCast = action;
  if (lane === 'pet') {
    if (casting) petLastCast = action;
    else if (get('validatePetActions')) {
      action.hitID = parseInt(p[42], 16);
      petActions.push(action);
      rot.stats.pet++;
    }
  }

  if (active) updateHeader(player.job);
}

// Build a renderable object from an action/item/mount id.
function resolveAction(actionID, p) {
  if (actionID >= MOUNT_FLAG) {
    const mountID = actionID & 0xffffff;
    const mt = lookupMount(mountID);
    return { id: actionID, name: mt?.name || p[3] || 'Mount', icon: mt?.icon || '000118', cooldownGroup: [0, 0], isReal: false };
  }
  if (actionID >= ITEM_FLAG) {
    let itemID = actionID & 0xffffff;
    if (itemID > 1000000) itemID -= 1000000; // HQ
    const it = lookupItem(itemID);
    return { id: actionID, name: it?.name || p[3] || 'Item', icon: it?.icon || '000044', cooldownGroup: [0, 0], isReal: false };
  }
  const a = lookupAction(actionID);
  // "General actions" (Desynthesis, Repair, Materia Extraction, etc.) log against an empty
  // combat-Action row -> the 000405 fallback icon. Recover the real icon by the logged name.
  const generalIcon = Data.generalActions[p[3]];
  if (a) {
    if (a.icon === '000405' && generalIcon) return { ...a, icon: generalIcon, name: a.name || p[3], isReal: true };
    return { ...a, isReal: true };
  }
  return { id: actionID, name: p[3] || '???', icon: generalIcon || '000405', cooldownGroup: [0, 0], isReal: true };
}

/* ---------------- combat data ---------------- */
function updateCombat(msg) {
  const { Encounter, Combatant, isActive } = msg;
  const you = Combatant?.YOU;

  if (you) {
    const job = String(you.Job || '').toUpperCase();
    if (job && job !== player.job) { player.job = job; setJobIcon(job); }
    updateMeter({ duration: Encounter?.duration, ENCDPS: Encounter?.ENCDPS }, you);
  }

  updateHeader(player.job, { duration: Encounter?.duration, you });

  const nowActive = !(isActive === 'false' || isActive === false);
  if (nowActive && !active) feat.onCombatStart();        // combat began
  if (!nowActive && active) feat.onCombatEnd(Encounter?.duration); // combat ended -> summary
  active = nowActive;
  if (!active) cleanup();
}

function cleanup() {
  lastTs = -1; lastId = -1; lastAutoAttack = -1; lastGcdMs = -1; lastCast = null; petLastCast = null;
  recentCasts.clear();
  petActions.length = 0;
  rot.resetStats();
  clearDots();
}

export function fullReset() { cleanup(); clearBars(); }
export const getPlayer = () => player;
