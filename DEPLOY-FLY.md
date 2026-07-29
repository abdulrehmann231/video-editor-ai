# Deploying to Fly.io

Fly runs our `Dockerfile` (Node + ffmpeg + headless-Chrome libs + Remotion) as a
single container. Config lives in `fly.toml`.

## 1. Install the CLI & sign in
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh
fly auth signup   # or: fly auth login
```

## 2. Launch (first time)
From the project root:
```bash
fly launch --no-deploy
```
- When asked, **reuse the existing `fly.toml`** and **Dockerfile** (say no to
  overwriting / creating a new config).
- Pick an app name (if `edit-ai` is taken it'll suggest one) and a region.

## 3. Set secrets
```bash
fly secrets set \
  R2_ENDPOINT="https://a424212c7b5c541fff555ae41c7f7ffd.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="<r2 access key>" \
  R2_SECRET_ACCESS_KEY="<r2 secret>" \
  R2_BUCKET="edit-ai" \
  R2_PUBLIC_HOST="videos.abdulrehmann.com" \
  GEMINI_API_KEYS="<key1,key2>" \
  PEXEL_API_KEY="<pexels key>"
```
(Optional: `GEMINI_MODEL`, `WHISPER_MODEL`.)

## 4. Deploy
```bash
fly deploy
```
First build takes a few minutes (installs ffmpeg + Chrome libs, `npm ci`,
`next build`, pre-downloads the Chrome shell). Then:
```bash
fly open        # opens https://<app>.fly.dev
fly logs        # tail logs
```

## 5. ⚠️ R2 CORS (required — browser uploads directly to R2)
The upload is a presigned PUT straight from the browser to R2, so add a CORS
policy on the `edit-ai` bucket (Cloudflare → R2 → edit-ai → Settings → CORS)
allowing your Fly origin:
```json
[
  {
    "AllowedOrigins": ["https://<your-app>.fly.dev"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Sizing & cost notes
- `fly.toml` requests **1 GB RAM + 2 GB swap** — enough for the current
  720×1280 renders. If renders OOM or you bump Shorts to 1080×1920
  (`SHORTS_DIMS` in `src/lib/render/renderFinal.ts`), raise `memory_mb` to
  `2048`: `fly scale memory 2048`.
- **Scale-to-zero** (`min_machines_running = 0`) keeps idle cost ~free; the
  machine wakes on the next request. Renders are safe as long as the tab stays
  open (it polls every 4s). For fire-and-forget reliability, set
  `min_machines_running = 1` (always-on, small ongoing cost).
- Storage is on Cloudflare R2, so the container's disk is disposable — projects
  and renders survive restarts and redeploys.

## Common commands
```bash
fly status
fly logs
fly scale memory 2048         # more RAM
fly scale count 1             # keep one machine always running
fly secrets list
fly deploy                    # redeploy after code changes
```
