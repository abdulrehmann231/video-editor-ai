# edit-ai

AI-assisted **non-generative** B2B video editor. A user uploads a raw talking-head
video; **Gemini** decides the edits (cuts, captions, zooms, b-roll, lower thirds) and
emits a structured **Edit Decision List**; a deterministic renderer (**FFmpeg + Remotion**)
executes it. The AI never regenerates pixels — it edits like a human editor.

See the full design in `/.claude/plans/…` (architecture, phases, effect catalog).

## Status

### Phase 0 — upload & ingest ✅
- Next.js (App Router) app with a drag-and-drop upload page.
- Direct browser → **Cloudflare R2** uploads via presigned PUT URLs.
- **ffprobe** ingest (duration / resolution / fps / codecs / audio).
- Project records stored as JSON in R2 (a real DB arrives later).
- Client libs: R2, Gemini (with **API-key round-robin + 429 failover**), Pexels.
- Live **credential smoke test** + unit tests.

### Phase 1 — analysis → Edit Decision List (the brain) ✅
- **Gemini File API** watches the video and emits a validated, timestamped
  **EDL** (never regenerates pixels) — ops chosen from a fixed **Effect Catalog**
  (`silence_cut`, `caption`, `zoom_punch`, `lower_third`, `broll`), each with a
  `reason` that powers the persisted **decision log**.
- **ffmpeg silencedetect** pre-pass seeds precise silence-cut ranges.
- **Local Whisper** (transformers.js, `whisper-tiny.en`) for word-level caption
  timing — no API key, deployable in the Node worker.
- Structured output via `responseSchema` + Zod validation + one repair pass;
  Gemini key rotation/failover re-uploads under a fresh key on 429 / transient 5xx.
- **Optional user prompt** steers the edit — captured at upload and editable on
  the project page (re-run to re-steer). Threaded into the analysis as
  highest-priority instructions (e.g. tone, speaker name, what b-roll to add).
- `POST /api/projects/:id/analyze`; project page shows the plan + decision log.

### Phase 2 — deterministic FFmpeg cut renderer ✅
- Turns the EDL's `silence_cut` ops into **keep-segments** (merge → invert →
  drop slivers) and stitches them back in a **single ffmpeg pass**
  (`select`/`aselect` + `setpts`), re-encoding to mp4 with **EBU R128 loudness
  normalization**. Output uploaded to R2, served via the public domain.
- `POST /api/projects/:id/render`; project page shows the rendered cut with a
  download button and before/after stats (duration, seconds removed, segments).

### Phase 3 — Remotion motion-graphics (the "AE" layer) ✅
- **Timeline remapping**: EDL/transcript times are in source-time; overlays are
  remapped through the keep-segments onto the compressed cut timeline (ops inside
  a removed gap are dropped). Heavily unit-tested (`timeline.ts`).
- **Remotion composition** over the cut video (`OffthreadVideo` base):
  **punch-in zooms**, **word-by-word captions** (active word highlighted),
  **lower thirds**, and **b-roll** (full / picture-in-picture).
- **Pexels b-roll**: each `broll` op's query is resolved to a stock clip; a
  missing result is skipped and logged (non-fatal).
- Rendered headless via `@remotion/bundler` + `@remotion/renderer`, uploaded to
  R2. `POST /api/projects/:id/render-final` (auto-renders a fresh cut first).

**Full pipeline:** upload (+prompt) → ingest → Gemini EDL + Whisper → FFmpeg cut
→ Remotion final render → downloadable B2B-styled MP4.

### Phase 4 — fully-automatic pipeline ✅
- Ingest **auto-starts** the pipeline (`analyze → cut → final render`) — no button
  clicks. `POST /api/projects/:id/pipeline` (202, fire-and-forget); the client
  polls `GET /api/projects/:id` for a live stepper.
- Shared step functions (`pipeline/steps.ts`) back both the manual routes and the
  orchestrator, so there's one code path per step. In-memory guard prevents
  duplicate concurrent runs (swap for Redis/BullMQ for multi-instance scale).
- Unified **PipelinePanel** hero: step progress, final video + download, and the
  persisted **decision log** (every edit with Gemini's reason). Manual per-step
  controls remain under "Advanced".
- Re-edit anytime with new instructions (re-runs the whole pipeline).

Runs in-process on the long-lived Node server (Railway/Render). Verified live:
fresh upload → `autostarted: true` → `done` with a final render, no interaction.

### Phase 5 — more effects + 9:16 output ✅
- **Title cards**: intro/CTA full-screen cards (`title_card` op) overlaid on the
  footage (no added time); Gemini can place a topic intro and a CTA outro.
- **Progress bar**: thin brand-gradient bar across the whole video (default on).
- **Background music + ducking**: a looping ambient bed
  (`public/music/ambient.m4a` — swap for real royalty-free tracks) mixed under the
  voice with **ffmpeg sidechain compression** (music dips when the speaker talks),
  padded to fill the full length. Default on (`project.music`).
- **9:16 Shorts**: `POST /api/projects/:id/render-final?format=shorts` renders a
  vertical 720×1280 version (base cover-fit; all overlays reposition). Stored under
  `shorts*` fields; a "Make 9:16 Shorts" panel shows it with a download.

Verified live: title card, progress bar, and ducked music render correctly; a
9:16 export produced a valid vertical MP4 with every overlay.

## Deployment notes
The render worker needs these system deps (already handled on Railway/Render via
a Docker base image):
- **ffmpeg** (cuts, audio, silencedetect, audio extraction).
- **Headless Chrome libs** for Remotion: `libnss3 libnspr4 libatk1.0-0
  libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1
  libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0
  libcairo2 libatspi2.0-0 libxshmfence1 fonts-liberation` (Remotion downloads the
  Chrome Headless Shell itself). Render concurrency scales with CPU cores.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values (see below)
npm run smoke          # validates R2 + Gemini + Pexels live
npm run dev            # http://localhost:3000
```

### Environment

| Var | Notes |
|-----|-------|
| `R2_ENDPOINT` | Account URL **without** bucket path, e.g. `https://<acct>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | From an R2 API token (Object Read & Write) |
| `R2_BUCKET` | **`edit-ai`** (hyphen, not underscore) |
| `R2_PUBLIC_HOST` | `videos.abdulrehmann.com` |
| `GEMINI_API_KEYS` | Comma-separated; the app round-robins and fails over on 429 |
| `GEMINI_MODEL` | Default `gemini-flash-latest` (alias available across accounts) |
| `PEXEL_API_KEY` | Note: singular name |

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test` — unit tests (Vitest)
- `npm run smoke` — live credential validation (R2 round-trip, each Gemini key, Pexels)
- `npm run typecheck`

## Flow (Phase 0)

`upload UI → POST /api/uploads/presign → browser PUT to R2 → POST /api/projects/:id/ingest (ffprobe) → /projects/:id`

## Next: Phase 1

Send the uploaded video to Gemini (File API) → produce a validated Edit Decision List
(JSON) with per-edit reasons; run local Whisper for word-level caption timing.
