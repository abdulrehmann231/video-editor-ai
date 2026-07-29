# edit-ai — single-container image for Hugging Face Spaces (Docker SDK),
# also works on Fly.io / Render / a plain VM.
#
# Bundles everything the render pipeline needs: Node, ffmpeg, and the headless
# Chrome shared libraries Remotion depends on. HF Spaces runs the container as
# uid 1000 ("user"), so the app lives in that user's home and all caches are
# written to writable, user-owned paths.

FROM node:20-bookworm-slim

# ---- System dependencies -------------------------------------------------
# ffmpeg: cuts / silence / audio extraction / music mix.
# The lib* set: headless Chrome runtime deps for Remotion.
# fonts-liberation: sane default fonts for captions/title cards.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      ca-certificates \
      fonts-liberation \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
      libasound2 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 libatspi2.0-0 \
      libxshmfence1 libx11-xcb1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ---- Non-root user (HF Spaces expects uid 1000) --------------------------
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    XDG_CACHE_HOME=/home/user/.cache \
    PORT=7860

WORKDIR /home/user/app

# ---- Install dependencies (cached layer) ---------------------------------
COPY --chown=user package.json package-lock.json ./
# NODE_ENV=production won't skip devDeps for `npm ci` unless --omit=dev; we need
# them (next build, typescript) so install everything explicitly.
RUN npm ci --include=dev

# ---- App source + build --------------------------------------------------
COPY --chown=user . .
RUN npm run build

# Pre-download the headless Chrome shell so the first render isn't slow.
RUN node -e "require('@remotion/renderer').ensureBrowser()"

EXPOSE 7860
CMD ["npm", "run", "start"]
