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

/* ---------- positionals ----------
   Which skills have a rear/flank bonus comes from the data (actions.json `pos`, derived from
   each skill's description by tools/resync.ps1), so new jobs and reworks need no code change.

   Whether the bonus landed is read from the action's effect entries in the log line (kagami's
   observation): a combo-type effect entry (type 0x1B) is written as "11B" when the positional
   succeeded; for skills that are not combo follow-ups the bare "1B" entry only appears on a
   success. SAM / RPR damage-flag fallbacks are kept from kagami for older log formats. */
const LEGACY_DAMAGE_FLAGS = { 7481: ['4871', '2171'], 7482: ['4871', '2171'], 24382: ['D710', 'B710'], 24383: ['D710', 'B710'] };

export function isPositional(action) { return !!action?.positional; }

// returns true on success, false on miss; only call for positional actions.
export function checkPositional(action, logParameter) {
  stats.positional++;
  const effects = logParameter.slice(8, 22).map((s) => String(s || '').toUpperCase());
  if (effects.includes('11B')) return true;
  if (!action.combo && effects.includes('1B')) return true;
  const dmg = String(logParameter[6] || '').toUpperCase();
  return (LEGACY_DAMAGE_FLAGS[action.id] || []).some((f) => dmg.includes(f));
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
