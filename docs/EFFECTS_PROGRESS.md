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

## Phase C — Three.js 3D lane        — not started (C0 = verify WebGL in headless Chrome)
## Phase D — Blender (optional)      — not started

## Notes / decisions
- Installed: `@remotion/google-fonts`. Fonts: Anton (display) + Inter (body).
- Asset licensing: only bundle CC0 / free-for-commercial Lottie/3D assets; log sources here.
