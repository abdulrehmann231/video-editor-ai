#!/usr/bin/env bash
# Build the EffectCraft project from the JSX script, render it in parallel
# frame-aligned chunks with effectcraft-cli, then assemble video + audio
# (edited voice track, ducked music bed, synthesized whooshes/hits) with ffmpeg.
#
#   EC=/path/to/effectcraft-cli FFMPEG=/path/to/ffmpeg ./render.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EC=${EC:-effectcraft-cli}
FF=${FFMPEG:-ffmpeg}
WORK=${WORK:-/tmp/work}
SRC=${SRC:-$WORK/src.mp4}
PROJ=$WORK/recovery.ecproj
OUT=${OUT:-$WORK/recovery_final.mp4}
FPS=30; FRAMES=1674          # 55.8 s
CHUNK=${CHUNK:-140}          # frames per render job
JOBS=${JOBS:-1}              # parallel effectcraft-cli renders
MUSIC=${MUSIC:-$HERE/../public/music/ambient.m4a}

mkdir -p "$WORK/chunks"
echo "== build project"
[ -f "$PROJ" ] && [ -n "${KEEP_PROJECT:-}" ] || "$EC" script "$HERE/build_recovery.jsx" --empty

echo "== render chunks (JOBS=$JOBS parallel)"
# NB: each effectcraft-cli render is single-threaded and uses ~0.5–1 GB, so
# set JOBS to min(cores, RAM/1GB). Finished chunks are kept (delete to re-render).
i=0; : > "$WORK/chunks/jobs.txt"
for ((s=0; s<FRAMES; s+=CHUNK)); do
  e=$(( s+CHUNK < FRAMES ? s+CHUNK : FRAMES ))
  echo "$i $s $e" >> "$WORK/chunks/jobs.txt"; i=$((i+1))
done
export EC PROJ WORK FPS
xargs -P "$JOBS" -L1 sh -c '
  f=$(printf "%s/chunks/c%02d.mp4" "$WORK" $0)
  [ -f "$f.done" ] && exit 0
  ts=$(python3 -c "print($1/$FPS)"); te=$(python3 -c "print($2/$FPS)")
  "$EC" render --project "$PROJ" --comp Recovery_Edit --out "$f" --format h264 \
    --start "$ts" --end "$te" --audio off --bitrate 20000 > "$f.log" 2>&1 && touch "$f.done"
' < "$WORK/chunks/jobs.txt"
ls "$WORK"/chunks/c*.mp4.done | sed "s/.done$//" | sed "s/^/file '/;s/$/'/" > "$WORK/chunks/list.txt"

echo "== audio"
A=$WORK/audio; mkdir -p "$A"
# voice: source 0–47.6 + 80.3–88.5, tiny crossfade at the jump
"$FF" -v error -y -i "$SRC" -filter_complex \
 "[0:a]atrim=0:47.6,asetpts=PTS-STARTPTS[a1];[0:a]atrim=80.3:88.5,asetpts=PTS-STARTPTS[a2];[a1][a2]acrossfade=d=0.04[v]" \
 -map "[v]" -ar 48000 -ac 2 "$A/voice.wav"
# SFX synthesized from noise/sines (no external assets)
"$FF" -v error -y -f lavfi -i "anoisesrc=c=pink:d=0.5:a=0.6" -af \
 "highpass=f=300,lowpass=f=5000,afade=t=in:d=0.22:curve=exp,afade=t=out:st=0.22:d=0.28,volume=0.8" -ar 48000 -ac 2 "$A/whoosh.wav"
"$FF" -v error -y -f lavfi -i "sine=f=1400:d=0.06" -af "afade=t=out:d=0.06,volume=0.35" -ar 48000 -ac 2 "$A/tick.wav"
"$FF" -v error -y -f lavfi -i "sine=f=90:d=0.45" -f lavfi -i "anoisesrc=c=brown:d=0.45:a=0.5" -filter_complex \
 "[0][1]amix=2,afade=t=out:d=0.45,volume=1.6" -ar 48000 -ac 2 "$A/hit.wav"
"$FF" -v error -y -f lavfi -i "anoisesrc=c=white:d=0.45:a=0.35" -af \
 "apulsator=hz=18,highpass=f=800,afade=t=out:st=0.3:d=0.15" -ar 48000 -ac 2 "$A/glitch.wav"
# cue sheet: file|time(s)
CUES="whoosh|9.80 whoosh|11.38 tick|13.96 tick|15.04 tick|16.88 hit|18.55 hit|20.50 whoosh|28.90 \
tick|32.38 tick|33.38 tick|34.60 whoosh|35.90 tick|37.30 tick|42.75 hit|46.42 glitch|47.15 \
tick|47.82 whoosh|50.70 tick|53.86"
inputs=(); filt=""; mix=""; n=1
for c in $CUES; do
  f=${c%%|*}; t=${c##*|}; ms=$(python3 -c "print(int($t*1000))")
  inputs+=(-i "$A/$f.wav"); filt="$filt[$n:a]adelay=${ms}|${ms}[s$n];"; mix="$mix[s$n]"; n=$((n+1))
done
"$FF" -v error -y -f lavfi -t 55.8 -i anullsrc=r=48000:cl=stereo "${inputs[@]}" \
  -filter_complex "${filt}[0:a]${mix}amix=inputs=$n:normalize=0:duration=first[sfx]" -map "[sfx]" "$A/sfx.wav"
# music bed, looped, ducked under the voice (sidechain)
"$FF" -v error -y -stream_loop -1 -i "$MUSIC" -i "$A/voice.wav" -i "$A/sfx.wav" -filter_complex \
 "[0:a]atrim=0:55.8,asetpts=PTS-STARTPTS,volume=0.35,aformat=channel_layouts=stereo[m];\
  [1:a]asplit[v1][v2];[m][v2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[md];\
  [v1][md][2:a]amix=inputs=3:normalize=0,afade=t=out:st=55.3:d=0.5,loudnorm=I=-14:TP=-1.5[mix]" \
 -map "[mix]" -t 55.8 -ar 48000 "$A/mix.wav"

echo "== assemble"
"$FF" -v error -y -f concat -safe 0 -i "$WORK/chunks/list.txt" -i "$A/mix.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
echo "done -> $OUT"
