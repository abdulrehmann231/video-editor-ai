# EffectCraft motion-graphics experiment

A test of [EffectCraft](https://github.com/storytold/effectcraft) (v0.8.0), an open-source
After Effects clone written in Rust, as the motion-graphics engine for edit-ai. The script
recreates the styles of several **Editing Inspiration Vault** references on the repo's test
talking-head clip (`testing/s2 final …mp4`).

Everything is built **headlessly from an After-Effects-style ExtendScript** (`build_recovery.jsx`)
run with `effectcraft-cli script`. That covers compositions, precomps, shape layers with trim
paths, text animators with range selectors, expressions, CC Particle World, Glow, Fractal Noise,
Tint, Gaussian/Directional blur, motion blur and adjustment layers. Rendering also goes through
`effectcraft-cli` (its own pure-Rust H.264 encoder). ffmpeg is used only to join the parallel
render chunks and to mix the audio.

## Output

[`output/recovery_final.mp4`](output/recovery_final.mp4): 55.8 s, 1920×1080, 30 fps
(see also [`output/contact_sheet.jpg`](output/contact_sheet.jpg), one frame per second, and the
generated project [`output/recovery.ecproj`](output/recovery.ecproj)). It uses the first 47.6 s of the clip, then
jumps to source 80.3 s ("Sign number one, persistent soreness").

| Time | Scene | Vault reference |
|---|---|---|
| 0.4–3.3 | Mono "terminal" box **MEN OVER 40** that draws on with trim paths, scramble-decodes, then types its subtitle | #146 "Secrets of the top 1%" / "TOP 0.001%" |
| 3.3–9.9 | **One** (regular) + **factor** (bold) blur word reveal → "Not your workout" with a red strike → "It's your **recovery**" plus a Workout/Recovery progress bar with a spark | #196 "Free cashflow" Revenue/Profit bar |
| 9.9–11.5 | Full-screen navy title card with dust particles, CRT flicker and typewriter **HERE'S THE REALITY_** | #146 intro card |
| 11.9–20.8 | Footage reframed right; **EVERYTHING RIGHT** checklist cards pop in with drawn checks, then a red ✕ **Recovering** card shakes | #879 / #880 pop-in cards |
| 20.5–22.6 | Black-and-white punch-in, camera shake, yellow pixel-font caption "your body / cannot / GROW." | #882 B&W + pixel caption |
| 23.6–29.0 | Terminal box "BIGGEST ADVANTAGE OF / **STEROIDS** / > NOT JUST FASTER GAINS" | #146 lower box |
| 29.0–36.2 | **Whip-pan** (motion blur + directional blur) into a circuit **node graph**: RECOVERY hub turns red → green, wires charge green and nodes ripple as he says *train harder / more often / adapt* | #44 whip pan + #893 node graph |
| 36.5–41.2 | ~~STEROIDS~~ strike + **100% NATURAL** pill + typewriter aside | — |
| 41.4–45.0 | Background blurs and darkens: **BETTER RECOVERY ↑ › MORE MUSCLE ↑** | #754 "Lazy methods > other alternatives" |
| 45.1–47.6 | "MOST GUYS / **GET IT WRONG**" pop + shake → offset/mosaic glitch | — |
| 47.6–51.0 | Glitch-block chapter card, yellow **SIGN #1** tag, **PERSISTENT SORENESS** decode, streak exit | #924 "STEP 3: Sell your time" |
| 51.0–55.8 | Bottom chapter tabs with underline + a "Not inherently bad" check pill | #929 chapter tabs |

Audio: the edited voice track, the repo's ambient bed ducked under the voice (sidechain),
whooshes/ticks/hits synthesised with ffmpeg at each cue, and loudness normalised to −14 LUFS.

## Run

```bash
# EffectCraft CLI: https://github.com/storytold/effectcraft/releases (linux tar.gz ships bin/effectcraft-cli)
# fonts (picked up from ~/.local/share/fonts): Montserrat (static weights), Space Mono, VT323
cp "testing/s2 final (1) 2026-08-10 at 17.15.25.mp4" /tmp/work/src.mp4
EC=/path/to/effectcraft-cli FFMPEG=/path/to/ffmpeg effectcraft/render.sh
```

The `.ecproj` it writes (`/tmp/work/recovery.ecproj`) is plain JSON. You can open it in the
EffectCraft desktop app to tweak by hand.

## Notes on EffectCraft (v0.8.0) from this test

- **What works well:** the AE scripting object model (match names, `setValueAtTime`, `KeyframeEase`,
  `Shape`, text animators, expressions with `seedRandom`/`wiggle`), CC Particle World, Glow,
  Fractal Noise, Grid, Tint, Offset, Mosaic, Directional Blur, layer motion blur and precomps.
  It also renders frames fast enough to iterate on stills (about 50–250 ms per frame).
- **Render speed:** one `effectcraft-cli render` runs on a single thread. That is about 4–5 fps at 1080p
  for simple comps and about 1 fps for this edit (glows, particles, motion blur, precomps).
  `render.sh` splits the timeline into frame-aligned chunks (`CHUNK` frames each, `--end` is
  exclusive) and runs `JOBS` of them in parallel. Finished chunks are kept, so a re-run resumes.
- **Memory:** heavy sections (a motion-blurred precomp with glows) peaked at about 2 GB per
  process. This sandbox had 1 CPU and 3 GB, so the edit was rendered with `JOBS=1` (about 30 min).
  On a real machine, set `JOBS` to roughly min(cores, RAM in GB / 2).
- **Gotchas found:**
  - `String.prototype.substr` silently fails inside expressions. Use `substring`.
  - In scripts (not expressions), `array + array` is string concatenation, as in real ExtendScript.
  - Range selector child match names are `start` / `end` / `offset` / `advanced` (each animator
    already has one default selector), and popup values are 1-based.
  - CC Particle World renders an opaque black layer. Set its blending mode to Add.
  - Shape groups added later draw **below** earlier ones (AE order). Add foreground groups first.
  - A hold-keyed colour on the Fill effect evaluated wrong. An expression was more reliable.
  - Only bundled fonts plus fonts installed on the system are available. Variable fonts expose
    only their default instance, so install static weights.
