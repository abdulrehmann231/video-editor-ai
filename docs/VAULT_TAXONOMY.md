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

_Updated after backlog items 1–3 + 5 (chart primitive, progress timeline/scale/
slider, portrait tuning, 18-icon illustration library)._

| Bucket | Refs | Share |
|---|---|---|
| ✅ **Covered now** (good quality) | ~296 | **~66%** |
| ⚠️ **Partial** (works for a subset; gaps remain) | ~111 | ~25% |
| ❌ **Not covered** (needs a future phase / asset system) | ~39 | **~9%** |
| Uncategorized | ~5 | ~1% |

_Prior (before items 1–3, 5): 55% covered / 9% partial / 35% not covered._

**Reading:** the current system does the *talking-head overlay* family well. The
remaining ~35% — illustrated scenes, charts, flow diagrams, arbitrary 3D — is the
part that needs Phases 6/8/13 **plus an asset library that does not exist yet**.

---

## Family → coverage → phase

| Family | ~Refs | Status | Renders it today | To reach vault parity |
|---|---|---|---|---|
| **Kinetic typography / caption / word pop** | ~126 | ✅ good | `kinetic_text` + `caption` (12 styles) | Phase 3/4 **done**. Polish: more entrance variety. |
| **Illustrated scene / character / mascot** | ~96 | ⚠️ partial | `illustration` (18-icon library) | Single-concept icons/stickers ✅. Full multi-element **scenes** (mascots, layered illustrations) still need **more assets + Phase 6** composition. Biggest remaining gap. |
| **Stat / metric callout / badge** | ~34 | ✅ good | `metric_pop`, `three:stat_orb` | Done; 3D orb variant needs GPU/Lambda. |
| **Checklist / numbered list / steps** | ~29 | ✅ good | `checklist`, `stack_list` (Phase F) | Done. |
| **Comparison / vs / two-column** | ~28 | ✅ good | `comparison` (Phase F) | Done; add split-screen video variant. |
| **Progress / meter / gauge / timeline / scale** | ~24 | ✅ good | `progress` (bar/gauge/counter/timeline/scale/slider) | Done (item 2). |
| **Chart / graph (bar, line, curve)** | ~22 | ✅ good | `chart` (bar/line/area/donut) | Done (item 1). |
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

## Prioritized backlog

Done:
1. ✅ **Chart/graph primitive** — `chart` (bar/line/area/donut).
2. ✅ **Extend `progress`** — timeline / number-line scale / slider.
3. ✅ **Portrait/Shorts tuning** — orientation-aware templates + renderers.
5. ✅ **Illustration library** — 18 animated vector icons/stickers (extensible).

Next:
4. **Phase 6 — Creative Director** — the AI *composes* multi-element scenes
   (icon + arrow + label + graph) instead of picking one op → one template.
   Unlocks the ~96 illustrated + ~21 flow refs (pairs with growing the asset
   library). Largest remaining lever.
6. **Grow the illustration/asset library** (mascots, UI/phone mockups, more scenes)
   — feeds Phase 6.
7. **Phase 13 — 3D pipeline** (~18 refs) — after a GPU/Lambda render path is default.
8. **Phase 10 — Visual-QA loop** — the quality *guarantee* (auto-verify a render
   matches intent); pixel goldens are currently skipped in CI.

**Net:** ~66% of the vault is reproducible at good quality now (up from ~55%).
Reaching ~90% is mainly **Phase 6 + a bigger asset library**; the last ~9%
(arbitrary 3D, heavy multi-element illustration) is Phase-13 + a real asset pipeline.
