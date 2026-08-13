# Effects Upgrade — Progress (memory)

Goal: vault-quality **2D + 3D** motion graphics, 100% cloud / headless / free (no After
Effects), so it scales for a subscription app. Stack: **Remotion** (2D) + **@remotion/lottie**
(pro 2D) + **@remotion/three** (3D) + optional **Blender** (photoreal 3D). Full plan lives in
`~/.claude/plans/i-wanna-make-an-modular-clarke.md` (section "EFFECTS UPGRADE PLAN").

Legend: [ ] todo · [~] in progress · [x] done

## Phase A — 2D polish (free, cloud, ships now)
- [x] A1 Captions v2 — Anton font, thick stroke, spring bounce, active-word highlight/box,
      karaoke fill, typewriter. (`src/remotion/theme.ts`, `src/remotion/components/Captions.tsx`)
- [x] A2 Dense **auto-captions** from the full transcript (buildAutoCaptions in
      `timeline.ts`); Gemini caption ops now just set STYLE over their ranges.
- [x] A3 Polished LowerThirds (glass + animated accent), StatCallouts (glass + count-up +
      glow), TitleCards (Anton + gradient). (Transitions left as-is; fine for now.)
- [x] A4 Editor-brain **prompt v2** — retention/density, hook, pattern interrupts, stat on
      every number, captions-are-automatic guidance. (`analyze/prompt.ts`)
- [x] A5 Rendered sample + frames verified: pro captions, glass stat card w/ count-up,
      glass lower third, title card all look YouTube-ready (11 dense captions in test).
- [ ] A6 **5-minute real raw video** test end-to-end (download a talking-head clip).

## Phase B — Lottie lane (pro 2D)   ✅ ENGINE DONE
- [x] Installed @remotion/lottie + lottie-web. Two free Lottie assets in
      public/lottie/ (confetti, checkmark).
- [x] `lottie` EDL op + catalog + response schema; `lottieRegistry.ts` (shared);
      `LottieLayer.tsx` (loads bundled JSON, positions full/center/corner);
      timeline mapping; Edit + renderFinal wiring; Gemini picks a template by id.
- [x] Verified live: confetti Lottie composited over b-roll in a real render.
- [x] GREW THE LIBRARY to 5: confetti, checkmark, trophy (LottieFiles free) +
      underline, swipe_wipe (self-authored, owned). Verified underline renders.
      Adding more = drop JSON + registry entry (see docs/LOTTIE.md). (Ongoing.)

## Phase C — Three.js 3D lane        ✅ DONE
- [x] C0 verified WebGL renders headless via **software WebGL `gl:'swangle'`** (no
      GPU). `angle` needs a GPU; `swangle` works (and is Lambda's default).
- [x] @remotion/three + three + @react-three/fiber. `three` EDL op + catalog +
      threeRegistry (stat_orb, card_3d) + Three3DLayer (ThreeCanvas scenes +
      crisp 2D text overlay); schema/timeline/Edit/renderFinal wiring;
      renderFinal sets gl:'swangle' when the plan has 3D.
- [x] Verified live: the glass **stat orb** (glossy 3D sphere w/ specular +
      "$1.2M") renders correctly over the video; card_3d uses the same engine.
- ⚠️ 3D is CPU-heavy (software WebGL): ~260s for a short clip on the 1-core
      sandbox. Use the **Lambda backend** (parallel) or a multi-core box for real
      speed. Prompt tells Gemini to use 3D rarely.

## Phase D — Blender (optional)      — not started (only if a photoreal 3D need arises)

## Phase E — Agentic editor brain (multi-stage, per-moment vault)   ✅ DONE
- [x] PLAN stage (`analyze/plan.ts`): Gemini watches the video → editorial plan
      (niche/tone/segments/beats, each beat w/ intent + vault searchQuery).
- [x] Per-moment vault search (`analyze/build.ts`): each beat searches ALL 451 refs
      via its searchQuery → its own matches (uses many refs across a video, not 24).
- [x] BUILD stage: text-only Gemini turns plan + per-beat refs + catalog → EDL,
      mapping each beat to the closest 2D/Lottie/3D effect, citing its ref.
- [x] RESEARCH stage (`analyze/research.ts`, env `EDIT_RESEARCH=on`): Gemini Google
      Search grounding brief. NOTE: `googleSearch` tool unsupported by @google/
      generative-ai@0.21 for the model → returns nothing (gated + graceful). To enable
      later: upgrade the SDK or call the REST grounding API.
- [x] analyzeVideo rewired: PLAN → (RESEARCH) → per-moment retrieve → BUILD, with
      key rotation + 429/5xx failover around all stages. Meta adds beats + researched.
- [x] Verified live (20s clip): 4 beats, 15 distinct beat-refs, EDL grounded per beat
      incl. three[card_3d] from a "3D card" vault ref. 2 Gemini calls (~95s here).

## Phase F — Vault-quality effect overhaul (2026-08)   ✅ DONE
Studied the REAL Inspiration Vault (scraped 26 animated GIFs via Playwright +
chrome-headless-shell → frame contact sheets). The old templates rendered flat
dark stat cards that looked nothing like the vault. Rebuilt the effect set to
match its signature look:
- [x] `italic` + `textCase` on text; check/cross annotations now bold + bright +
      glowing (emoji-like); left/right text anchoring for clean list rows.
- [x] New `meter` IR layer + MeterRenderer: bar | gauge (red→green) | counter.
- [x] `checklist` redesigned to the clean bold-italic ✓/✗ overlay (no card, soft
      left scrim) — matches the "EXPERTISE ✓ / LABOUR ✗" vault staple.
- [x] New `stack_list` (outline pills / numbered badges / top-left to-do) and
      `progress` (bar/gauge/counter) templates; brighter `metric_pop` (accent
      number + border) and `comparison`.
- [x] Wired so the AI can emit them: new stack_list + progress EDL ops, catalog
      entries + Gemini response-schema fields for annotate/name_tag/checklist/
      comparison/stack_list/progress (previously un-emittable), prompt mapping.
- [x] Dev tool: `scripts/render-templates.mjs` renders each template to a still
      for visual review against the vault frames.

## Phase G — Backlog items 1–3 + 5 (toward vault parity)   ✅ DONE
From the vault taxonomy (`docs/VAULT_TAXONOMY.md`), knocked out the highest-ROI
self-contained gaps (coverage ~55% → ~66%):
- [x] 1 — **Chart primitive**: `chart` IR layer + ChartRenderer (bar/line/area/
      donut; gradient rounded bars grow + count-up, lines draw on with area fill,
      donut sweeps). ~22 refs.
- [x] 2 — **Progress extensions**: timeline (milestones), scale (number-line +
      pointer), slider (knob) added to the meter widget. ~24 refs now fully done.
- [x] 3 — **Portrait/Shorts tuning**: `orientation()` factor (fs=1.5 portrait,
      landscape byte-identical); comparison stacks vertically, chart/meter widen;
      renderers self-tune from W/H. Verified every template at 720×1280.
- [x] 5 — **Illustration library**: `illustration` IR layer + IllustrationRenderer
      + 18 animated vector icons/stickers (money/growth/rocket/target/idea/…),
      brand-tintable, pop/float/draw. Extensible (drop a component + registry
      entry). Seeds the ~96 illustrated refs.
All wired to the AI (EDL ops + catalog + Gemini response schema + prompt) and
covered by tests (198 total). Next: **Phase 6 — Creative Director** (compose
multi-element scenes), then grow assets / 3D / Visual-QA.

## Phase 6 — Creative Director (composed scenes)   ✅ DONE (opt-in)
The AI now DESIGNS COMPOSITIONS instead of picking one op per moment. Gated behind
`MOTION_PROGRAM=on` (analysis) + `renderEngine:'program'` (auto when a program is
present); the EDL 'motion' path stays the default until parity.
- [x] 6a — `motion/program/{schema,compile}.ts`: a MotionProgram is SCENES, each a
      composed moment of 1–6 coordinated ELEMENTS (illustration + stat + name-tag +
      arrow, staggered by `delay`). Elements reuse the live-validated EDL op
      vocabulary but drop their own timing/ids (inherited from the scene).
      `parseProgram` self-heals + injects timing via parseEdl reuse; `programToMotion`
      composites each scene into ONE layered IR composition (shares the EDL path's
      cut remap + template compiler + dense captions).
- [x] 6b — `analyze/program.ts`: `buildProgramPrompt` (Creative Director, with
      worked composition examples) + `PROGRAM_RESPONSE_SCHEMA` (shares
      EFFECT_PARAM_PROPS with the EDL schema). Live-validated: 4/5 scenes composed.
- [x] 6c — `generateProgram` with a REPAIR pass (recovers dropped data elements);
      wired into analyzeVideo (gated) + steps.ts ('program' engine, reuses
      broll/music; silence-only EDL from program.cuts drives the cut) +
      `programDecisionLog`. Project gains `program?` (no migration).
- ⚠️ **Known tradeoff (honest):** the deeply-nested scenes→elements schema is
      harder for the model than the flat EDL — under load it often substitutes a
      simpler element (stat_callout/lottie) for a rich data-viz element (chart /
      stack_list / comparison items), even after repair. Composition works and
      degrades gracefully; rich data-viz WITHIN a composed scene is model-limited.
      Future lever: a focused per-scene "fill the data" pass, or a stronger model
      for the program stage. Scripts: `_smoke-program.mjs` (live E2E),
      `_program-render.mjs` (render a composed scene).

## Notes / decisions
- Installed: `@remotion/google-fonts`. Fonts: Anton (display) + Inter (body).
- Asset licensing: only bundle CC0 / free-for-commercial Lottie/3D assets; log sources here.
