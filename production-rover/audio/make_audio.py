"""Soundtrack for "Happy Birthday, Alone" (Curiosity on Mars -> Feeloy), ~31.5 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
The rover's "Happy Birthday" is a public-domain tune (Hill sisters, 1893), played here as a short beeping hum.
Picture timing is mirrored from src/videos/rover/story.ts + cast.ts (frames at 30 fps).
usage: python3 -I make_audio.py <production dir>
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
from dsp import SR, ns, tt, rng, dbg, lp, hp, bp, pan, place, fades, make_ir, convolve_st, integrated, true_peak, read_wav, write_wav, colored
import instruments as I
import sfx_gen as G

ROOT = sys.argv[1]
FPS, TOTAL = 30, 945
DUR = TOTAL / FPS
N = ns(DUR)
F = lambda f: f / FPS
m2f = I.m2f
R = rng(7)
cues = []

def cue(t, what):
    cues.append((t, what))

def mx(*xs):
    """sum mono signals of different lengths (zero-padded)"""
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[: len(x)] += x
    return out

def put(buf, x, t, g=1.0, p=0.0):
    """mono or stereo x into a stereo buffer at time t"""
    if x.ndim == 1: x = pan(x, p)
    place(buf, x, t, g)

# ================================================================ music
mus = np.zeros((2, N))
# A sparse, wondering space pad in C (glassy glock arps), the rover's own beeping "Happy Birthday" hum (square-ish, thin),
# a lonely hush, a bright warm lawn section where the mowers beep the tune back, a soft reply on Mars, the Feeloy
# section, the end-card chord.
HB = [(67, 0.75), (67, 0.25), (69, 1), (67, 1), (72, 1), (71, 2)]   # first phrase, beats
def hum(t0, beat=0.36, g=0.4, tr=0, n=6):
    t = t0
    for (m, d) in HB[:n]:
        x = np.sign(np.sin(2 * np.pi * m2f(m + tr) * tt(d * beat * 0.92))) * 0.35; x = lp(x, 2600) * np.hanning(len(x)) ** 0.3
        put(mus, x, t, g, 0.1); t += d * beat
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(232) - 0.0, 0.26, R, att=1.0, rel=0.6), 0.0, 0.7)
for k in range(10): put(mus, I.glock(m2f((72, 76, 79, 84)[k % 4]), 0.3, R, 1.0), 0.3 + k * 0.42, 0.45, 0.3 * (1 if k % 2 else -1))
put(mus, I.musicbox(m2f(84), 0.5, R, 1.4), F(84), 0.6); cue(0.0, "music: sparse space pad in C, glassy glock arps")
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(232) - F(120), 0.2, R, att=0.4, rel=0.4), F(120), 0.5)
hum(F(201), 0.3, 0.32); cue(F(201), "music: the rover's thin beeping Happy Birthday hum (public-domain tune)")
hum(F(238), 0.36, 0.4)
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(547) - F(294), 0.24, R, att=0.8, rel=0.6), F(294), 0.65)
for k in range(5): put(mus, I.glock(m2f((76, 72, 69, 64, 60)[k]), 0.3, R, 1.4), F(300) + k * 0.6, 0.45, 0.2)
cue(F(294), "music: lonely hush, falling glock")
put(mus, I.brass(m2f(36), 0.6, 0.6, R, kind="tuba"), F(490), 0.5); cue(F(490), "music: deadpan tuba on NO (scientific value)")
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64, 67)], F(707) - F(547), 0.3, R, att=0.5, rel=0.6), F(547), 0.7)
b = 60 / 112; t = F(547)
while t < F(707) - 0.3:
    for j, m in enumerate((60, 64, 67, 72, 67, 64, 67, 72)): put(mus, I.pluck(m2f(m), 0.3, R, 0.3, 0.7), t + j * b / 2, 0.5, 0.3 * (1 if j % 2 else -1))
    put(mus, I.pluck(m2f(36), 0.6, R, 0.6, 0.3), t, 0.75); t += 4 * b
for i in range(4): hum(F(668) + i * 0.1, 0.3, 0.22, tr=[0, 12, 7, 4][i])
cue(F(668), "music: warm lawn groove; the mowers beep the tune back (layered)")
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(777) - F(707), 0.26, R, att=0.4, rel=0.6), F(707), 0.65)
for k, m in enumerate((72, 76, 79, 84)): put(mus, I.glock(m2f(m), 0.4, R, 1.6), F(742) + k * 0.09, 0.55, 0.2)
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(820) - F(777), 0.2, R, att=0.6, rel=0.5), F(777), 0.6)
B0, BEAT2, CARD = F(820), 60 / 96, 882
PROG2 = [(48, [60, 64, 67, 72]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (43, [55, 59, 62, 67])]
MEL2 = [[(0, 79, 1.5), (2, 76, 1), (3, 74, 1)], [(0, 76, 2), (2.5, 79, 1.5)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.3, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 2]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section")
for m, dt in [(60, 0), (64, 0.12), (67, 0.24), (72, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (36, 48, 52, 55, 60)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.0), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord")
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def outside(t0, t1, g=0.35):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 0.5), 0.2, 0.2), t0, g * 0.5); put(sfx, G.bird_chirps(d, R, 0.6), t0, g * 0.8, 0.4)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def wind(t0, t1, g=0.25):
    n = ns(t1 - t0); x = bp(colored(n, R, 1.0), 200, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * tt(t1 - t0)[:n] / 5.0) ** 2)
    put(sfx, fades(x * 0.4, 0.5, 0.5), t0, g)
def servo(t, d=0.5, g=0.18): x = np.sin(2 * np.pi * (300 + 200 * tt(d) / d) * tt(d)) * 0.3; put(sfx, lp(x, 2000) * np.hanning(len(x)), t, g, 0.2)
def tick(t0, t1, g=0.1):
    k = 0
    while t0 + k < t1: put(sfx, G.clink(R, 2400, 0.03, 0.3), t0 + k, g, 0.4); k += 1
wind(0, F(120), 0.3); popb(F(84), 0.35); whoosh(F(120), 0.5, 0.6); cue(0.0, "sfx: thin Martian wind; cake pop; flash whoosh")
room(F(120), F(200), 0.1)
for k in range(12): put(sfx, G.clink(R, 2600 + 200 * (k % 3), 0.02, 0.5), F(124) + k * 0.13, 0.1, -0.2)
popb(F(152), 0.3); cue(F(124), "sfx: mission-control keys, hum")
wind(F(200), F(439), 0.3)
n = ns(1.8); put(sfx, lp(colored(n, R, 0.0), 900) * np.hanning(n) * 0.25, F(236), 0.2); cue(F(236), "sfx: lab rattle while it hums")
for f0 in (393, 408, 423): popb(F(f0), 0.28)
room(F(439), F(547), 0.1); popb(F(478), 0.3)
outside(F(547), F(707), 0.25)
for i in range(4): servo(F(598 + i * 6), 0.6, 0.12)
cue(F(598), "sfx: mowers roll in (whirr)")
wind(F(707), F(777), 0.3); servo(F(712), 0.8, 0.2); popb(F(742), 0.35); cue(F(712), "sfx: mast servo looking up; heart pop")
n = ns(DUR - F(777)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(777), 0.15)
tick(F(777), F(820), 0.12); put(sfx, G.crickets(F(882) - F(777), R, 3), F(777), 0.18, 0.3); popb(F(784), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(820), 0.55, 0.0); recv(F(860), 0.45)
whoosh(F(882), 0.5, 0.45); cue(F(777), "sfx: night flat, Feeloy chime, reply, end-card whoosh")

# ================================================================ mix
v_raw, v_sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
assert v_sr == SR, v_sr
v = v_raw.mean(0)
voice = np.zeros(N); voice[: min(N, len(v))] = v[:N]
words = json.load(open(os.path.join(ROOT, "voice", "words.json")))["words"]
V = np.vstack([voice, voice])
Lv = integrated(V)
# base levels relative to the voice, then the standard offsets: music +3 dB, SFX -6 dB
def to(x, lu):
    L = integrated(x); return x * dbg(lu - L) if np.isfinite(L) else x
mus_b = to(mus, Lv - 15.0) * dbg(+3.0)
sfx_b = to(sfx, Lv - 12.0) * dbg(-6.0)
# duck the music -3 dB while the voice speaks (key = word timings)
duck = np.zeros(N)
for w in words:
    a, b2 = ns(max(0, w["s"] - 0.08)), ns(w["e"] + 0.12); duck[a:b2] = 1
k = ns(0.12); duck = np.convolve(duck, np.ones(k) / k, "same")
mus_d = mus_b * dbg(-3.0 * duck)[None, :]
mix = V + mus_d + sfx_b
g = dbg(-15.0 - integrated(mix)); mix *= g
# limiter (look-ahead peak follower) to -1.2 dBTP
ceil = dbg(-1.9)
pk = np.max(np.abs(mix), 0); env = np.maximum.accumulate(pk[::-1])[::-1] if False else pk
win = ns(0.004); env = np.array([0.0])
from scipy.ndimage import maximum_filter1d, uniform_filter1d
env = maximum_filter1d(pk, size=2 * win + 1)
gain = np.minimum(1.0, ceil / np.maximum(env, 1e-9))
gain = uniform_filter1d(np.minimum.accumulate(np.r_[gain, 1.0][::-1])[::-1][:N] if False else gain, size=win)
gain = np.minimum(gain, ceil / np.maximum(pk, 1e-9))
mix *= gain[None, :]
os.makedirs(os.path.join(ROOT, "audio", "stems"), exist_ok=True)
write_wav(os.path.join(ROOT, "audio", "mix.wav"), mix)
for name, x in [("voice", V * g), ("music", mus_d * g), ("sfx", sfx_b * g)]: write_wav(os.path.join(ROOT, "audio", "stems", name + ".wav"), x)
rep = f"integrated {integrated(mix):.2f} LUFS, true peak {true_peak(mix):.2f} dBTP, length {mix.shape[1]/SR:.3f} s"
with open(os.path.join(ROOT, "audio", "cues.md"), "w") as fh:
    fh.write("# Cues (seconds)\n\n" + rep + "\n\nMix: voice unchanged; music base voice-15 LU then +3 dB, ducked -3 dB under words; SFX base voice-12 LU then -6 dB.\n\n")
    for t, w in sorted(cues): fh.write(f"- {t:6.2f}  {w}\n")
print(rep)
