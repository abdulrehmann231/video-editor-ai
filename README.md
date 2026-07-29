# edit-ai

AI-assisted **non-generative** B2B video editor. A user uploads a raw talking-head
video; **Gemini** decides the edits (cuts, captions, zooms, b-roll, lower thirds) and
emits a structured **Edit Decision List**; a deterministic renderer (**FFmpeg + Remotion**)
executes it. The AI never regenerates pixels — it edits like a human editor.

See the full design in `/.claude/plans/…` (architecture, phases, effect catalog).

## Status — Phase 0 (upload & ingest) ✅

- Next.js (App Router) app with a drag-and-drop upload page.
- Direct browser → **Cloudflare R2** uploads via presigned PUT URLs.
- **ffprobe** ingest (duration / resolution / fps / codecs / audio).
- Project records stored as JSON in R2 (a real DB arrives in Phase 1).
- Client libs: R2, Gemini (with **API-key round-robin + 429 failover**), Pexels.
- Live **credential smoke test** + unit tests.

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
