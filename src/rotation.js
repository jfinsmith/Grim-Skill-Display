// rotation.js — rotation quality analysis.
//  * positional miss detection (ported from kagami; per-job flag checks)
//  * GCD clip / drift detection (new, self-calibrating to the player's actual GCD)
// Exposes running counters for the header stats.

import { get } from './store.js';

export const stats = {
  positional: 0, mispositional: 0,
  gcds: 0, clips: 0,
  pet: 0, petGhost: 0,
};

export function resetStats() {
  stats.positional = 0; stats.mispositional = 0;
  stats.gcds = 0; stats.clips = 0;
  stats.pet = 0; stats.petGhost = 0;
  clip.lastGcdTime = -1; clip.minGap = Infinity;
}

/* ---------- positionals (kagami-derived; IDs may need per-patch refresh) ---------- */
const REAR_FLANK = {
  monk: [53, 56, 54, 74, 61, 66],
  dragoon: [88, 79, 3554, 3556],
  ninja: [2255, 3563],
  samurai: [7481, 7482],
  reaper: [24382, 24383],
};
const all = (o) => Object.values(o).flat();
const POSITIONAL_IDS = new Set(all(REAR_FLANK));

export function isPositional(id) { return POSITIONAL_IDS.has(id); }

// returns true on success, false on miss; only call for positional actions.
export function checkPositional(action, logParameter) {
  const id = action.id;
  stats.positional++;
  const flags = logParameter.slice(8, 22);
  if (REAR_FLANK.monk.includes(id)) return flags.includes('1B');
  if (REAR_FLANK.dragoon.includes(id)) return flags.includes(id === 88 ? '11B' : '1B');
  if (REAR_FLANK.ninja.includes(id)) return flags.includes('11B');
  if (REAR_FLANK.samurai.includes(id)) {
    return flags.includes('11B') || (logParameter[6] || '').includes('4871') || (logParameter[6] || '').includes('2171');
  }
  if (REAR_FLANK.reaper.includes(id)) {
    return (logParameter[6] || '').includes('D710') || (logParameter[6] || '').includes('B710');
  }
  return true;
}

/* ---------- GCD clip / drift ----------
   We don't know the player's exact GCD (skill/spell speed varies), so we learn it:
   the smallest gap observed between two GCDs is treated as the "clean" GCD length.
   Any gap exceeding that floor by > tolerance is counted as a clip/drift.        */
const clip = { lastGcdTime: -1, minGap: Infinity, tolerance: 0.15 };

// Call for every GCD fired. timestampMs = Date.now(). Returns true if this GCD was clipped.
export function noteGcd(timestampMs) {
  stats.gcds++;
  if (clip.lastGcdTime > 0) {
    const gap = (timestampMs - clip.lastGcdTime) / 1000;
    // ignore absurd gaps (downtime / new pull): > 6s means we weren't actually GCD-chaining
    if (gap > 0.5 && gap < 6) {
      if (gap < clip.minGap) clip.minGap = gap;
      if (clip.minGap !== Infinity && gap > clip.minGap + clip.tolerance) {
        stats.clips++;
        clip.lastGcdTime = timestampMs;
        return true;
      }
    }
  }
  clip.lastGcdTime = timestampMs;
  return false;
}

// GCD uptime estimate: (GCDs fired × learned clean-GCD length) / combat duration.
export function gcdUptime(durationSec) {
  if (!durationSec || !stats.gcds || clip.minGap === Infinity) return null;
  return Math.min(100, Math.round((stats.gcds * clip.minGap / durationSec) * 100));
}

/* ---------- formatted header strings ---------- */
export function positionalText(lang) {
  const rate = stats.positional ? Math.round((stats.mispositional / stats.positional) * 100) : 0;
  return `${lang('mispositional') || 'positional miss'}: ${stats.mispositional}/${stats.positional} (${rate}%)`;
}
export function clipText() {
  const rate = stats.gcds ? Math.round((stats.clips / stats.gcds) * 100) : 0;
  return `clips: ${stats.clips}/${stats.gcds} (${rate}%)`;
}
export function petText(lang) {
  const rate = stats.pet ? Math.round((stats.petGhost / stats.pet) * 100) : 0;
  return `${lang('pet-action') || 'pet ghosted'}: ${stats.petGhost}/${stats.pet} (${rate}%)`;
}
