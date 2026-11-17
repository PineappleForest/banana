"""Soundtrack for "Alone in the Dark" (Philae and Rosetta, 2014-2016 -> Feeloy), ~29.6 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py: soft space pads, a music-box motif, the lander's
radio beeps) + synthesized SFX (lib/sfx_gen.py and local generators) + the voice, mixed: music +3 dB, SFX -6 dB
relative to their base levels, voice unchanged, music ducked -3 dB under speech, integrated -15 LUFS,
true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/comet/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 887
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
MOTIF = [(76, 1), (79, 1), (81, 2), (79, 1), (76, 1), (74, 2)]
def motif(t0, inst, g=0.5, tr=0, beat=0.36, p=0.15):
    t = t0
    for m, d in MOTIF: put(mus, inst(m2f(m + tr), d * beat * 1.4), t, g, p); t += d * beat
    return t
mbox = lambda f, d: I.musicbox(f, 0.45, R, d)
# 1-2: space: a slow open pad (Am9), the music-box motif as the lander drifts down; a hopeful glock on landing
put(mus, I.pad([m2f(n) for n in (45, 52, 59, 64, 71)], F(210), 0.22, R, att=1.0, rel=0.6), 0.0, 0.62)
motif(0.4, mbox, 0.5)
for k, m in enumerate((79, 84)): put(mus, I.glock(m2f(m), 0.45, R, 1.2), F(94) + k * 0.12, 0.5, 0.2)
cue(0.0, "music: open Am9 space pad, music-box motif, glock on landing")
# the bounce: a rising-falling slide; the crack: a low dull chord
put(mus, I.pad([m2f(n) for n in (40, 47, 52, 55)], F(305) - F(176), 0.2, R, att=0.05, rel=0.6), F(176), 0.55)
cue(F(176), "music: low dull chord in the crack")
# 3-4: waking and calling home: the motif again, brighter, over a warm pad; the radio beeps are music too
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64, 67)], F(390) - F(250), 0.24, R, att=0.4, rel=0.4), F(250), 0.62)
motif(F(252), mbox, 0.5, 12, 0.3)
f = 274
while f < 392:
    if (f // 6) % 2 == 1 and (f - 6) // 6 % 2 == 0: put(mus, I.square(m2f(88), 0.07, R) if hasattr(I, "square") else I.glock(m2f(88), 0.25, R, 0.12), F(f), 0.22, 0.25)
    f += 1
cue(F(274), "music: brighter motif; radio beeps while it calls home")
# 5: silence: everything stops; one last low note
put(mus, I.glock(m2f(64), 0.35, R, 2.0), F(396), 0.35)
# 6: searching: a slow arpeggio over a cold pad, a little rise
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(497) - F(418), 0.22, R, att=0.3, rel=0.4), F(418), 0.6)
for k in range(12): put(mus, I.pluck(m2f((57, 60, 64, 69)[k % 4] + 12), 0.3, R, 0.5, 0.5), F(420) + k * 0.22, 0.42, 0.25 * (1 if k % 2 else -1))
cue(F(418), "music: searching arpeggio")
# 7: FOUND: a bright stab
for m, dt in [(72, 0), (76, 0.05), (79, 0.1), (84, 0.15)]: put(mus, I.glock(m2f(m), 0.55, R, 1.6), F(517) + dt, 0.6, 0.2)
put(mus, I.triangle(0.4, R, 1.4), F(517), 0.4, 0.3)
# 8: the mothership comes down to join it: a warm major pad swells; the motif slows on the music box
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64, 67, 72)], F(669) - F(545), 0.3, R, att=1.2, rel=0.6), F(545), 0.8)
motif(F(560), mbox, 0.5, 0, 0.5)
for m, dt in [(60, 0), (64, 0.1), (67, 0.2), (72, 0.3), (76, 0.4)]: put(mus, I.musicbox(m2f(m + 12), 0.5, R, 1.8), F(640) + dt, 0.6, 0.2)
cue(F(545), "music: warm swell as the mothership comes down; bloom on 'join it'")
# 9: the flat: the motif alone, slow, minor pad
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(755) - F(669), 0.2, R, att=0.4, rel=0.5), F(669), 0.6)
# 10: Feeloy
B0, BEAT2, CARD = F(755), 60 / 96, 837
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
ir = make_ir(1.6, 11, hf=0.7)
mus = mus * 0.75 + convolve_st(mus, ir)[:, :N] * 0.25
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def thud(t, g=0.5, f0=70):
    d = 0.4; x = np.sin(2 * np.pi * f0 * tt(d)) * np.exp(-tt(d) / 0.08) + bp(R.standard_normal(ns(d)), 200, 2000) * np.exp(-tt(d) / 0.02) * 0.5
    put(sfx, x, t, g)
def boing(t, g=0.4):
    d = 0.6; n = ns(d); tt_ = tt(d)[:n]; f = 180 + 260 * np.exp(-tt_ / 0.12) + 40 * np.sin(2 * np.pi * 9 * tt_)
    put(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt_ / 0.2), t, g, 0.1)
def beep(t, f=1760, d=0.08, g=0.22, p=0.3):
    n = ns(d); put(sfx, np.sign(np.sin(2 * np.pi * f * tt(d)[:n])) * 0.3 * np.hanning(n), t, g, p)
def hum(t0, t1, g=0.1):
    d = t1 - t0; n = ns(d); tt_ = tt(d)[:n]
    put(sfx, fades((np.sin(2 * np.pi * 55 * tt_) * 0.4 + lp(colored(n, R, 1.0), 300) * 0.5) * 0.5, 0.4, 0.4), t0, g)
# deep space: a very low hum bed (space is silent; this is the craft's own hum)
hum(0, F(669), 0.12)
for k in range(3): beep(0.6 + k * 0.18, 1320 + 220 * k, 0.06, 0.15, -0.3)
put(sfx, G.creak(0.4, R, 140, 220, scale=0.6), F(18), 0.15, -0.2); cue(0.0, "sfx: low craft hum; release clunk; little beeps")
thud(F(94), 0.35, 90); boing(F(123), 0.4); whoosh(F(121), 0.5, 0.5)
thud(F(176), 0.6, 60); n = ns(0.6); put(sfx, bp(R.standard_normal(n), 300, 3000) * np.exp(-tt(0.6)[:n] / 0.15) * 0.4, F(178), 0.3)
cue(F(123), "sfx: landing thud, bounce boing, tumbling into the crack")
for k in range(5): n = ns(0.06); put(sfx, bp(R.standard_normal(n), 1500, 6000) * np.hanning(n) * 0.5, F(214) + k * 0.17, 0.12, -0.3)
put(sfx, mx(I.glock(m2f(91), 0.35, R, 0.4)), F(252), 0.3); cue(F(252), "sfx: eye-open blip")
f = 274
while f < 392:
    if f % 12 == 6: beep(F(f), 1760, 0.08, 0.2, 0.3)
    f += 1
for k in range(4): put(sfx, G.whoosh(0.5, R, peak=0.25), F(276) + k * 0.73, 0.12, 0.4)
cue(F(274), "sfx: antenna beeps and signal whooshes for 85 seconds")
for k in range(26): put(sfx, G.clink(R, 2200, 0.02, 0.4), F(322) + k * 0.075, 0.08, -0.2)
n = ns(0.5); put(sfx, np.sin(2 * np.pi * np.cumsum(np.linspace(900, 200, n)) / SR) * np.hanning(n) * 0.3, F(392), 0.35)
cue(F(392), "sfx: power-down slide")
popb(F(400), 0.3); whoosh(F(418), 0.5, 0.4)
n = ns(F(497) - F(418)); put(sfx, fades(bp(colored(n, R, 1.0), 800, 3000) * 0.2, 0.3, 0.3), F(418), 0.12)
for k in range(3): n = ns(0.06); put(sfx, bp(R.standard_normal(n), 1500, 6000) * np.hanning(n) * 0.5, F(448) + k * 0.47, 0.15, 0.3)
put(sfx, mx(I.glock(m2f(96), 0.4, R, 0.5)), F(517), 0.3); n = ns(0.04); put(sfx, bp(R.standard_normal(n), 2000, 9000), F(510), 0.3)
cue(F(510), "sfx: shutter click; FOUND ding")
hum(F(545), F(640), 0.1); thud(F(636), 0.45, 80); popb(F(642), 0.4)
cue(F(636), "sfx: soft touchdown; heart pop")
whoosh(F(669), 0.5, 0.4)
n = ns(DUR - F(669)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(669), 0.15)
for k in range(int(F(837) - F(669))): put(sfx, G.clink(R, 2400, 0.03, 0.3), F(669) + k, 0.1, 0.4)
popb(F(690), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(755), 0.55, 0.0); recv(F(812), 0.45)
whoosh(F(837), 0.5, 0.45); cue(F(669), "sfx: night flat, clock tick, Feeloy chime, reply, end-card whoosh")

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
