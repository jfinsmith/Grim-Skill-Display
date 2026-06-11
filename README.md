# Grim Skill Display

A FFXIV skill-rotation overlay for **Advanced Combat Tracker (ACT)** + **OverlayPlugin**.
Your skills scroll across a music-bar timeline as you cast them — a modern, self-contained
replacement for the unmaintained *Kagami* overlay.

> **Why this exists:** Kagami fetched every icon live from the old XIVAPI and shipped a skill
> list frozen at patch 7.0, so anything added since showed up as `??` with no icon. Grim
> **bundles every icon and the full current skill list inside the repo**, so it never breaks
> when an external service goes down — and a one-command script re-syncs it after each patch.

---

## Features

- **Music-bar timeline** of your skills (and pet skills), scrolling R→L or L→R.
- **GCD vs oGCD distinction** — GCDs render larger with an accent border, oGCDs smaller, so
  your rotation's rhythm is readable at a glance.
- **Live mini-meter** (top-right) — click to cycle **Personal DPS → Healing/s → Damage taken/s
  → Raid DPS → off**.
- **DoT / debuff tracker** — live countdown pips for every damage-debuff you apply; they flash
  when it's time to refresh. Works for every job automatically (no per-job setup).
- **Rotation analysis** — positional-miss %, **GCD clip/drift %** (self-calibrating), and pet
  ghost-action %.
- **Cast bars**, interrupt markers, auto-attack lane, consumable (pot/tincture) icons.
- **Theming** — dark / light / job-color themes, custom accent + background color, icon
  shape (square/rounded/circle), scale, display time, GCD beat-grid.
- **Snapshot export** — save the last ~15 seconds of your bar as a PNG to share a rotation.
- **Zero build step** — plain HTML/CSS/JS. Nothing to compile.

---

## Install (ACT / OverlayPlugin)

You need [ACT](https://advancedcombattracker.com/download.php), the
[FFXIV ACT Plugin](https://github.com/ravahn/FFXIV_ACT_Plugin/releases/latest), and
[OverlayPlugin (ngld)](https://github.com/ngld/OverlayPlugin/releases/latest) already working.

1. In ACT: **Plugins → OverlayPlugin.dll → New**.
2. Set **Preset = Custom**, **Type = MiniParse**, give it any name (e.g. `Grim`), click OK.
3. Select the new overlay on the left, and set the **URL** to:

   ```
   https://jfinsmith.github.io/Grim-Skill-Display/
   ```

4. Click **Reload**. The bar appears. Hover the top edge for the header; click the **⚙ gear**
   for all settings. Drag to move, drag the corner to resize, then **lock** the overlay.

### Use in OBS
Start **OverlayPlugin → WSServer**, copy the generated overlay URL, and add it as a **Browser
Source** in OBS. Right-click the source → **Interact** to open settings (OBS sources don't share
ACT's settings). Settings are saved per-source in the browser's local storage.

---

## Updating after a game patch

Icons and skill data are bundled, so Grim keeps working through patches. When a patch adds new
skills, re-sync the data (needs [Node.js](https://nodejs.org) 18+):

```bash
node tools/01-fetch-actions.mjs      # refresh the skill list
node tools/02-fetch-icons.mjs        # download only the new icons
node tools/03-fetch-consumables.mjs  # refresh pots/tinctures
git add resources && git commit -m "Resync data for patch X.Y" && git push
```

Data comes from [XIVAPI v2](https://v2.xivapi.com/). Game content © SQUARE ENIX.

---

## Project layout

```
index.html              entry point (loads the modules + OverlayPlugin bridge)
src/                     ES modules (no build step)
  app.js                  orchestrator
  act.js                  ACT / OverlayPlugin / WebSocket listener
  parser.js               interprets battle-log lines -> features
  bar.js                  the scrolling skill bar
  meter.js / dots.js      live meter / DoT tracker
  rotation.js             positional + GCD-clip analysis
  header.js / settings-ui.js / snapshot.js / store.js / data.js / lang.js
resources/
  data/*.json             actions, items, jobs, language, default settings
  icons/*.png             ~2,300 bundled HD skill icons
  classjob/               job-icon spritesheet
tools/*.mjs               data-regeneration scripts (run with Node; not shipped to users)
```

## Credits

- Original concept & much of the battle-log handling: **Kagami** by *ram* / fork by *sgosiaco*
  (MIT). Grim is an independent modernization.
- Game data & icons via **XIVAPI v2**. All FFXIV content is property of **SQUARE ENIX**.

MIT License — see [LICENSE](LICENSE).
