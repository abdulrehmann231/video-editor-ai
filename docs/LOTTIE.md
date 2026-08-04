# Adding Lottie effects (pro 2D animations, no After Effects)

Lottie = an animation exported to a small JSON that renders anywhere. The app
renders them in the cloud (via `@remotion/lottie`), so you get AE-quality 2D
animations that scale for a subscription app. **Adding a new one is just data.**

## The 3 steps to add an animation
1. **Get a Lottie JSON.**
   - Download a **free** one from https://lottiefiles.com (filter: Free), or
   - Export your own from After Effects with the free **Bodymovin** plugin, or
   - Author a simple shape one (see `scripts` history for `underline`/`swipe_wipe`).
   - ⚠️ **Check the license** on LottieFiles (use "Free" / CC0 / or ones you own).
     Log the source below.
2. **Drop the file** into `public/lottie/yourname.json`.
3. **Register it** in `src/lib/render/lottieRegistry.ts` — add one entry:
   ```ts
   {
     id: 'yourname',              // Gemini refers to it by this id
     file: 'yourname.json',
     label: 'Human name',
     whenToUse: 'when the AI should use it (be specific)',
     position: 'full' | 'center' | 'corner',
     scale: 0.4,                  // size vs frame width (center/corner only)
     loop: false,
   }
   ```
That's it — Gemini can now choose it (`lottie` op → `template: 'yourname'`), the
timeline maps it, and `LottieLayer` renders it. Re-run `npm run lambda:deploy` if
you use the Lambda backend (it re-uploads the composition site).

## Current library
| id | what | position | source / license |
|----|------|----------|-------------------|
| confetti | Confetti burst (win/celebration) | full | LottieFiles free CDN — verify license before commercial use |
| checkmark | Green check pop (confirm) | center | LottieFiles free CDN — verify license |
| trophy | Trophy (achievement) | center | LottieFiles free CDN — verify license |
| underline | Yellow swipe underline (emphasis) | full | **self-authored (owned)** |
| swipe_wipe | Branded wipe transition | full | **self-authored (owned)** |

> The two self-authored ones are fully yours. Before shipping commercially,
> replace/confirm the LottieFiles-sourced ones with assets you have rights to
> (LottieFiles Free license or your own AE→Lottie exports) and update this table.
