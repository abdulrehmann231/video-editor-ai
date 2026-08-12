# Inspiration Vault — Effect Taxonomy & Coverage Map

**Purpose:** turn "make every vault effect at vault quality" into a ranked, buildable
backlog. Every one of the **451** references (`src/lib/vault/vault.json`) is classified
into an effect *family*; each family is mapped to what renders it today and which
**engine phase** (see `plan/MOTION_GRAPHICS_ENGINE_PLAN.md`) must deliver full parity.

**Method:** keyword classifier over each ref's `name + what + use + b2b + motion + tags`,
first-match-wins, specific families first. Counts are **±~5% approximate** (some refs
span families). Visual grounding: 26 GIFs scraped + the per-ref `what` descriptions.
Regenerate with the classifier snippet in git history (commit that added this file).

---

## Coverage headline

| Bucket | Refs | Share |
|---|---|---|
| ✅ **Covered now** (good quality) | ~250 | **~55%** |
| ⚠️ **Partial** (works for a subset; gaps remain) | ~39 | ~9% |
| ❌ **Not covered** (needs a future phase / asset system) | ~157 | **~35%** |
| Uncategorized | ~5 | ~1% |

**Reading:** the current system does the *talking-head overlay* family well. The
remaining ~35% — illustrated scenes, charts, flow diagrams, arbitrary 3D — is the
part that needs Phases 6/8/13 **plus an asset library that does not exist yet**.

---

## Family → coverage → phase

| Family | ~Refs | Status | Renders it today | To reach vault parity |
|---|---|---|---|---|
| **Kinetic typography / caption / word pop** | ~126 | ✅ good | `kinetic_text` + `caption` (12 styles) | Phase 3/4 **done**. Polish: more entrance variety. |
| **Illustrated scene / character / mascot** | ~96 | ❌ none | — | **Asset library (vector/illustration) + Phase 6** to compose scenes. Biggest single gap. |
| **Stat / metric callout / badge** | ~34 | ✅ good | `metric_pop`, `three:stat_orb` | Done; 3D orb variant needs GPU/Lambda. |
| **Checklist / numbered list / steps** | ~29 | ✅ good | `checklist`, `stack_list` (Phase F) | Done. |
| **Comparison / vs / two-column** | ~28 | ✅ good | `comparison` (Phase F) | Done; add split-screen video variant. |
| **Progress / meter / gauge / timeline / scale** | ~24 | ⚠️ partial | `progress` (bar/gauge/counter, Phase F) | **Add**: horizontal timeline, number-line/scale, slider. Phase 3 extend. |
| **Chart / graph (bar, line, curve)** | ~22 | ❌ none | — | **New chart primitive/renderer** (animated bars/lines/area) — Phase 2/3. High ROI, self-contained. |
| **Flow / process / connector diagram** | ~21 | ❌ none | — | **Connector primitive + Phase 6** (multi-node layout). |
| **3D scene / object (orb, product, room, block)** | ~18 | ⚠️ partial | `three` (only `stat_orb`, `card_3d`) | **Phase 13**: 3D asset/scene pipeline (Blender worker); GPU. |
| **Transition (glitch / wipe / zoom / shake)** | ~11 | ✅ basic | `transition` (glitch/flash/zoom_blur) | Add wipe/whip-pan/parallax match-cut. Phase 3. |
| **B-roll / screenshot / UI mockup / social proof** | ~11 | ⚠️ partial | `broll` (full/pip) | Stock b-roll ✅. **UI/browser/phone mockups + screenshot framing** need an asset/mockup system + Phase 6. |
| **Annotation (arrow/circle/marker/highlight)** | ~9 | ✅ good | `annotate`, `name_tag` (Phase F) | Add document/article **highlighter** variant. |
| **Counter / odometer / number roll** | ~6 | ✅ good | `progress:counter` (Phase F) | Done; add odometer digit-roll style. |
| **Sticker / emoji / icon pop** | ~4 | ⚠️ partial | `lottie` (5 assets) | **Grow the Lottie/icon library**; reliable emoji font. |
| **Lower third / name tag / label** | ~4 | ✅ good | `lower_third`, `name_tag` | Done. |
| **Title / intro / outro / logo** | ~3 | ⚠️ partial | `title_card` | Logo-sting / animated-logo reveal not covered (asset-driven). |

---

## Where the recent work (Effects Phase F) landed

Phase F **widened Phases 2–3** (primitives + template library) — it did **not** advance
to Phase 6+. It brought these families from "flat/absent" to good quality:
checklist, stack_list, comparison, progress (bar/gauge/counter), annotation, brighter
stat. That is the reason "Covered now" is ~55% and not ~35%.

It did **not** raise the ceiling: the AI still emits an **EDL (1 op → 1 template)**, so
it cannot yet *compose* a novel multi-element scene (icon + arrow + label + rising graph).
That composition ability is **Phase 6 (Creative Director)** and is the gate for most of
the illustrated/flow/chart families.

---

## Prioritized backlog (highest value first)

1. **Chart/graph primitive** (~22 refs, ❌→✅) — animated bar/line/area/curve renderer.
   Self-contained (like the `meter` layer), no Phase 6 dependency. **Best ROI.**
2. **Extend `progress`** with timeline / number-line / slider (~part of 24). Cheap.
3. **Portrait/Shorts tuning** of all Phase-F templates (correctness, not new effects).
4. **Phase 6 — Creative Director** (unlocks illustrated + flow + complex compositions,
   ~130+ refs). Largest lever; largest effort. Prereq for the illustration/asset work.
5. **Asset/illustration library** (vector scenes, mascots, UI mockups) — pairs with #4;
   nothing renders the ~96 illustrated refs without it.
6. **Phase 13 — 3D pipeline** (~18 refs) — only after a GPU/Lambda render path is default.
7. **Phase 10 — Visual-QA loop** — the quality *guarantee* (auto-verify a render matches
   the intended look); currently pixel goldens are skipped in CI.

**Net:** ~55% of the vault is reproducible at good quality today. Reaching ~90% is a
Phase-6 + chart-primitive + asset-library program; the last ~10% (arbitrary 3D, heavy
illustration) is Phase-13 + a real asset pipeline.
