#!/usr/bin/env bash
# One-command render of the Feeloy short on a GPU box (RunPod etc.).
#   COMP=ThanksgivingShort (default) -> out/thanksgiving_final.mp4  ("Can I Still Get a Plate?", the wrong-number Thanksgiving text)
#   COMP=PetRockShort               -> out/petrock_final.mp4       ("The Perfect Pet", the 1975 Pet Rock)
#   COMP=PenguinShort               -> out/penguin_final.mp4       ("The Penguin Who Came Back", ~30 s)
#   COMP=RoverShort                 -> out/rover_final.mp4         ("Happy Birthday, Alone", ~31 s)
#   COMP=HugsShort                  -> out/hugs_final.mp4          ("Free Hugs", ~32 s)
#   COMP=TruceShort                 -> out/truce_final.mp4         ("Silent Night", ~32 s)
#   ./render.sh            -> out/thanksgiving_final.mp4  (1440x2560, 30 fps, h264 crf 16, soundtrack muxed)
#   ./render.sh final --props='{"logo":true}'   extra options after the mode go to the renderer
#                             (logo: put your logo at public/eliza/logo.png; captions:false = no subtitles)
#   ./render.sh preview    -> out/thanksgiving_preview.mp4 (720x1280, quick check)
#   ./render.sh remux      -> out/thanksgiving_final.mp4 again from out/thanksgiving_video.mp4 + the current
#                             production-thanksgiving/audio/mix.wav (new narration / soundtrack; no re-render, seconds)
# Needs: Node 18+ and ffmpeg (installed automatically with apt if missing). Chrome is downloaded by Remotion.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-final}"
COMP="${COMP:-ThanksgivingShort}"
case "$COMP" in
  ThanksgivingShort) MIX=production-thanksgiving/audio/mix.wav; VID=out/thanksgiving_video.mp4; FIN=out/thanksgiving_final.mp4; PRE=out/thanksgiving_preview.mp4 ;;
  PetRockShort) MIX=production-petrock/audio/mix.wav; VID=out/petrock_video.mp4; FIN=out/petrock_final.mp4; PRE=out/petrock_preview.mp4 ;;
  PenguinShort) MIX=production-penguin/audio/mix.wav; VID=out/penguin_video.mp4; FIN=out/penguin_final.mp4; PRE=out/penguin_preview.mp4 ;;
  RoverShort) MIX=production-rover/audio/mix.wav; VID=out/rover_video.mp4; FIN=out/rover_final.mp4; PRE=out/rover_preview.mp4 ;;
  HugsShort) MIX=production-hugs/audio/mix.wav; VID=out/hugs_video.mp4; FIN=out/hugs_final.mp4; PRE=out/hugs_preview.mp4 ;;
  TruceShort) MIX=production-truce/audio/mix.wav; VID=out/truce_video.mp4; FIN=out/truce_final.mp4; PRE=out/truce_preview.mp4 ;;
  *) echo "unknown COMP=$COMP (ThanksgivingShort | PetRockShort | PenguinShort | RoverShort | HugsShort | TruceShort)"; exit 1 ;;
esac
case "$MODE" in final|preview|remux) shift || true ;; *) MODE=final ;; esac
EXTRA=("$@")
if printf '%s ' "${EXTRA[@]}" | grep -q '"logo" *: *true' && [ ! -f public/eliza/logo.png ]; then
  echo "logo:true needs your logo at public/eliza/logo.png (PNG with transparency works best). Add it or drop the option."; exit 1
fi
if [ "$MODE" = remux ]; then
  [ -f "$VID" ] || { echo "$VID missing: run ./render.sh first"; exit 1; }
  ffmpeg -y -loglevel error -i "$VID" -i "$MIX" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$FIN"
  echo "done: $FIN"; exit 0
fi
export DEBIAN_FRONTEND=noninteractive
APT_UPDATED=0
apt_install() { if [ $APT_UPDATED = 0 ]; then apt-get update -qq; APT_UPDATED=1; fi; apt-get install -y -qq --no-install-recommends "$@"; }
command -v ffmpeg >/dev/null || { echo "installing ffmpeg"; apt_install ffmpeg >/dev/null; }
command -v node >/dev/null || { echo "installing node 20"; apt_install curl ca-certificates >/dev/null; curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null; apt-get install -y -qq nodejs >/dev/null; }
# Chrome's shared libraries (bare CUDA images have none of them); libasound2 was renamed libasound2t64 on Ubuntu 24.04
LIBS="libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libegl1 libgl1 libvulkan1 libx11-xcb1 libxshmfence1 fonts-liberation"
if ! ldconfig -p | grep -q libnss3.so; then
  echo "installing Chrome libraries"
  apt_install $LIBS >/dev/null
  apt_install libasound2t64 >/dev/null 2>&1 || apt_install libasound2 >/dev/null 2>&1 || true
fi
[ -d node_modules ] || npm ci --no-audit --no-fund
npx remotion browser ensure
export TEMP="$PWD/remotion-tmp" TMP="$PWD/remotion-tmp"; mkdir -p "$TEMP" out
SCALE=1.3333; [ "$MODE" = preview ] && SCALE=0.6667
# pick the fastest working WebGL backend: GPU (angle-egl, then vulkan), else CPU (swangle)
GL=""
for g in angle-egl vulkan swangle; do
  if timeout 300 npx remotion still src/index.ts "$COMP" out/_probe.jpg --frame=250 --gl=$g --scale=0.25 >/tmp/probe_$g.log 2>&1; then GL=$g; break; fi
done
if [ -z "$GL" ]; then
  echo "no WebGL backend worked. Last lines of each probe:"
  for g in angle-egl vulkan swangle; do echo "----- $g"; grep -v "GL Driver Message" /tmp/probe_$g.log | tail -n 15; done
  exit 1
fi
echo "WebGL backend: $GL"
CONC=$( [ "$GL" = swangle ] && nproc || echo 4 )
npx remotion render src/index.ts "$COMP" "$VID" --codec h264 --crf 16 --scale $SCALE --gl=$GL --concurrency=$CONC --timeout=240000 "${EXTRA[@]}"
OUT=$FIN; [ "$MODE" = preview ] && OUT=$PRE
ffmpeg -y -loglevel error -i "$VID" -i "$MIX" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
echo "done: $OUT"
