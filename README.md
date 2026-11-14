# Feeloy shorts (banana)

- **ThanksgivingShort**: "Can I Still Get a Plate?", the 2016 wrong-number Thanksgiving text (`src/videos/thanksgiving/`, `production-thanksgiving/`)

## Render (GPU box, e.g. RunPod)
```bash
git clone https://github.com/PineappleForest/banana && cd banana
./render.sh final --props='{"logo":true}'   # -> out/thanksgiving_final.mp4 (2K, with sound)
./render.sh preview                         # -> out/thanksgiving_preview.mp4 (720p quick check)
./render.sh remux                           # new production-thanksgiving/audio/mix.wav only: re-attach sound, no re-render
```
