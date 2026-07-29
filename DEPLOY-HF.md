# Deploying to Hugging Face Spaces (Docker)

This app runs as a single Docker container: Next.js UI/API + the render pipeline
(ffmpeg + headless-Chrome/Remotion + local Whisper). HF free CPU Spaces give
**2 vCPU / 16 GB RAM**, which comfortably runs the renders.

## 1. Create the Space
1. https://huggingface.co/new-space → **SDK: Docker** → **Blank**.
2. Name it (e.g. `edit-ai`). Visibility: Public (free) or Private (needs a paid seat).
3. The Space is a git repo. Push this project into it:
   ```bash
   git remote add space https://huggingface.co/spaces/<your-username>/edit-ai
   git push space HEAD:main
   ```
   (Or connect the GitHub repo in the Space settings.)

HF reads the Docker config from:
- **`Dockerfile`** (in repo root) — builds the image.
- **`README.md` frontmatter** — `sdk: docker`, `app_port: 7860`.

## 2. Set secrets (Space → Settings → Variables and secrets)
Add these as **Secrets** (injected as env vars at runtime):

| Name | Value |
|------|-------|
| `R2_ENDPOINT` | `https://a424212c7b5c541fff555ae41c7f7ffd.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | *(R2 API token access key)* |
| `R2_SECRET_ACCESS_KEY` | *(R2 API token secret)* |
| `R2_BUCKET` | `edit-ai` |
| `R2_PUBLIC_HOST` | `videos.abdulrehmann.com` |
| `GEMINI_API_KEYS` | *(comma-separated keys)* |
| `PEXEL_API_KEY` | *(Pexels key)* |

Optional: `GEMINI_MODEL` (default `gemini-flash-latest`), `WHISPER_MODEL`
(default `Xenova/whisper-tiny.en`).

## 3. ⚠️ R2 CORS (required — the browser uploads directly to R2)
The upload uses a **presigned PUT from the browser to R2**, so the R2 bucket must
allow cross-origin PUT from your Space origin. In Cloudflare → R2 → `edit-ai` →
**Settings → CORS policy**, add:

```json
[
  {
    "AllowedOrigins": ["https://<your-username>-edit-ai.hf.space"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
Replace the origin with your Space URL (shown once it builds). Without this,
uploads fail with a CORS error in the browser.

## 4. Build & run
HF builds the Dockerfile automatically on push (first build ~5–10 min: installs
ffmpeg + Chrome libs, `npm ci`, `next build`, pre-downloads the Chrome shell).
When it's up, open the Space URL and upload a video — it auto-edits.

## Notes
- **Storage** is on Cloudflare R2, so the Space's ephemeral disk doesn't matter;
  projects/renders survive Space restarts.
- **First render** downloads the ~40 MB Whisper model once (cached afterward).
- **Higher-res Shorts**: with 16 GB RAM you can bump `SHORTS_DIMS` to
  `{ width: 1080, height: 1920 }` in `src/lib/render/renderFinal.ts`.
- **Idle sleep**: free Spaces sleep after prolonged inactivity and wake on the
  next visit; in-flight renders keep the container awake.
- **Background music**: swap `public/music/ambient.m4a` for a real royalty-free
  track (same filename) to change the bed.
