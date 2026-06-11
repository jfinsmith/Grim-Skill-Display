// header.js — header text, job icon, and rotation stat lines.

import { Data } from './data.js';
import { get } from './store.js';
import { lang } from './lang.js';
import * as rot from './rotation.js';

let durationEl, descEl, mispEl, clipEl, petEl, uptimeEl, jobIconEl;

export function initHeader() {
  durationEl = document.getElementById('duration');
  descEl = document.getElementById('desc');
  mispEl = document.getElementById('stat-mispositional');
  clipEl = document.getElementById('stat-clip');
  petEl = document.getElementById('stat-pet');
  uptimeEl = document.getElementById('stat-uptime');
  jobIconEl = document.getElementById('job-icon');
}

export function setJobIcon(job) {
  const code = Data.jobOrder.indexOf(job);
  jobIconEl.className = `job-icon classjob classjob-${code !== -1 ? String(code).padStart(2, '0') : '00'}`;
}

export function updateHeader(job, combat) {
  if (combat?.duration) durationEl.textContent = combat.duration;
  if (descEl) descEl.classList.add('hide');

  // GCD uptime % (all jobs)
  const dur = combat?.duration ? parseDur(combat.duration) : 0;
  const up = rot.gcdUptime(dur);
  toggleStat(uptimeEl, get('showGcdUptime') && up != null, up != null ? `uptime: ${up}%` : '');

  const flags = Data.classjob[job] || [];
  // positional miss (jobs flagged 'mispositional')
  toggleStat(mispEl, get('checkPositionals') && flags.includes('mispositional') && rot.stats.positional > 0,
    rot.positionalText(lang));
  // clip rate (all jobs)
  toggleStat(clipEl, get('trackClipping') && rot.stats.gcds > 0, rot.clipText());
  // pet ghost (pet jobs)
  toggleStat(petEl, get('validatePetActions') && flags.includes('pet-action') && rot.stats.pet > 0,
    rot.petText(lang));
}

function toggleStat(el, show, text) {
  if (!el) return;
  el.classList.toggle('hide', !show);
  if (show) el.textContent = text;
}

export function setActive(on) {
  durationEl?.classList.toggle('active', on);
}

function parseDur(d) {
  const x = String(d).split(':').map(Number);
  return x.length === 2 ? x[0] * 60 + x[1] : (x.length === 3 ? x[0] * 3600 + x[1] * 60 + x[2] : 0);
}
