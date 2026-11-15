"""Soundtrack for "The Dolphin Who Stayed" (Dingle, 1983-2020 -> Feeloy), ~31.7 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py: an original jig in D on fife over plucked chords and a
frame drum) + synthesized SFX (lib/sfx_gen.py: harbour water, gulls, splashes, engine, oars) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/dolphin/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 950
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
E8 = 60 / 112 / 3  # jig eighth (dotted quarter = 112)
JIG = [81, 78, 81, 86, 81, 78, 79, 76, 79, 83, 79, 76, 78, 74, 78, 81, 78, 74, 76, 78, 79, 81, None, None,
       86, 85, 83, 81, 78, 81, 83, 81, 79, 78, 76, 74, 76, 78, 79, 81, 83, 85, 86, 81, 78, 74, None, None]
CH = [(38, [62, 66, 69]), (43, [62, 67, 71]), (38, [62, 66, 69]), (45, [61, 64, 69]),
      (38, [62, 66, 69]), (43, [62, 67, 71]), (45, [61, 64, 69]), (38, [62, 66, 69])]
def jig(t0, t1, g=0.55, band=True, slow=1.0):
    e = E8 * slow; t = t0; i = 0
    while t < t1 - 0.05:
        m = JIG[i % len(JIG)]
        if m is not None:
            d = e * (2 if JIG[(i + 1) % len(JIG)] is None else 1)
            put(mus, I.fife(m2f(m), d * 0.92, 0.5, R, 0.06), t, g, -0.15)
        if band and i % 3 == 0:
            root, ch = CH[(i // 6) % 8]
            put(mus, I.pluck(m2f(ch[(i // 3) % 3] + 0), 0.35, R, 0.5, 0.55), t, 0.4, 0.3)
            if i % 6 == 0: put(mus, I.pluck(m2f(root), 0.6, R, 0.8, 0.3), t, 0.75)
            put(mus, I.snare(0.45 if i % 6 == 0 else 0.25, R, 0.25, 0.45, 0.15), t, 0.22, 0.1)
        t += e; i += 1
# 1-3: the dolphin arrives: the jig on its own, gentle, then the band joins at the flash
jig(0.3, F(180), 0.45, band=False); put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66)], F(180), 0.2, R, att=1.0, rel=0.5), 0.0, 0.5)
for k, m in enumerate((86, 81, 78)): put(mus, I.glock(m2f(m), 0.35, R, 1.4), F(152) + k * 0.4, 0.45, 0.2)
cue(0.0, "music: original jig in D on fife alone; falling glock on 'Alone'")
jig(F(180), F(535), 0.55, band=True); cue(F(180), "music: the band joins (plucks, frame drum)")
for i in range(12): put(mus, I.pluck(m2f(62 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19][i]), 0.4, R, 0.4, 0.6), F(474) + i * 0.085, 0.4, 0.2)
put(mus, I.glock(m2f(86), 0.55, R, 1.4), F(508), 0.6); cue(F(474), "music: rising run with the years; ding on '37 years'")
# 8: lockdown: the band drops out, a lone low fife over a cold B-minor pad
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(600) - F(535), 0.22, R, att=0.4, rel=0.5), F(535), 0.6)
for k, (m, d) in enumerate([(74, 0.6), (73, 0.6), (71, 1.1)]): put(mus, I.fife(m2f(m), d, 0.4, R, 0.15), F(540) + k * 0.65, 0.4)
cue(F(535), "music: hush, lone fife (lockdown)")
# 9-10: the boatman: the jig comes back slow and warm on music box, the hug of a D-major pad
put(mus, I.pad([m2f(n) for n in (50, 57, 62, 66, 69)], F(760) - F(598), 0.28, R, att=0.6, rel=0.6), F(598), 0.7)
t = F(604)
for m in JIG[:24]:
    if m is not None: put(mus, I.musicbox(m2f(m), 0.45, R, 0.9), t, 0.5, 0.15)
    t += E8 * 1.6
for m, dt in [(74, 0), (78, 0.1), (81, 0.2), (86, 0.3)]: put(mus, I.glock(m2f(m), 0.5, R, 1.4), F(652) + dt, 0.55, 0.2)
cue(F(598), "music: slow music-box jig, warm pad; glock bloom as he surfaces")
# 11: the lonely flat, then Feeloy
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(786) - F(760), 0.2, R, att=0.4, rel=0.5), F(760), 0.6)
B0, BEAT2, CARD = F(786), 60 / 96, 880
PROG2 = [(50, [62, 66, 69, 74]), (47, [59, 62, 66, 71]), (43, [55, 59, 62, 67]), (45, [57, 61, 64, 69])]
MEL2 = [[(0, 81, 1.5), (2, 78, 1), (3, 76, 1)], [(0, 78, 2), (2.5, 81, 1.5)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.3, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 2]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: Feeloy section")
for m, dt in [(62, 0), (66, 0.12), (69, 0.24), (74, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.0), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord")
ir = make_ir(1.1, 11, hf=0.8)
mus = mus * 0.82 + convolve_st(mus, ir)[:, :N] * 0.18
mus[:, :] *= np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1)

# ================================================================ SFX
sfx = np.zeros((2, N))
def whoosh(t, d=0.45, g=0.6, p=0.0): put(sfx, G.whoosh(d, R, peak=d * 0.55), t - d * 0.55, g, p)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def gull(t, g=0.25, p=0.0):
    d = 0.45; tt_ = tt(d); f = 1350 - 600 * tt_ / d + 120 * np.sin(2 * np.pi * 9 * tt_)
    x = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.hanning(len(tt_)) ** 0.6
    put(sfx, bp(x + 0.2 * R.standard_normal(len(tt_)), 600, 4000) * 0.4, t, g, p)
def splash(t, g=0.45, p=0.0):
    d = 0.7; n = ns(d); env = np.exp(-tt(d)[:n] / 0.12)
    x = bp(R.standard_normal(n), 400, 6000) * env + lp(R.standard_normal(n), 300) * np.exp(-tt(d)[:n] / 0.05) * 2
    for k in range(6): x += np.sin(2 * np.pi * np.cumsum(np.linspace(600 + 300 * k, 1600 + 300 * k, n)) / SR) * np.exp(-((tt(d)[:n] - 0.15 - 0.06 * k) / 0.02) ** 2) * 0.2
    put(sfx, x * 0.6, t, g, p)
def engine(t0, t1, g=0.2):
    d = t1 - t0; n = ns(d); tt_ = tt(d)[:n]
    x = np.sin(2 * np.pi * 62 * tt_) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * tt_))) + lp(R.standard_normal(n), 400) * 0.3
    put(sfx, fades(x * 0.4, 0.3, 0.3), t0, g, -0.2)
def click(t, g=0.3):
    for k in range(5): n = ns(0.012); put(sfx, bp(R.standard_normal(n), 2500, 9000), t + k * 0.035, g, 0.1)
# harbour bed all day: water lapping, gulls
put(sfx, G.water_bed(F(535), R, 0.6, 0.6), 0.0, 0.35)
for t_, p_ in [(0.8, -0.5), (3.2, 0.4), (9.8, -0.3), (15.4, 0.5)]: gull(t_, 0.22, p_)
cue(0.0, "sfx: harbour water bed, gulls")
popb(F(150), 0.3); whoosh(F(180), 0.5, 0.55)
click(F(186), 0.3); splash(F(182), 0.25)
for k in range(12): n = ns(0.06); put(sfx, bp(R.standard_normal(n), 1500, 6000) * np.hanning(n) * 0.5, F(192) + k * 0.1, 0.15, 0.3)
cue(F(182), "sfx: he peeks (clicks); calendar pages flutter")
engine(F(232), F(318), 0.25)
for f_ in (250, 270, 284, 304): splash(F(f_), 0.4)
cue(F(232), "sfx: trawler engine; leap splashes")
popb(F(352), 0.35); cue(F(352), "sfx: 'money back' ribbon pop")
engine(F(410), F(468), 0.15); splash(F(422), 0.4); splash(F(444), 0.5); put(sfx, G.applause(1.2, R, 6), F(434), 0.08)
for k in range(12): put(sfx, G.clink(R, 2400 + 120 * k, 0.03, 0.6), F(474) + k * 0.085, 0.18, 0.3)
put(sfx, mx(I.glock(m2f(91), 0.5, R, 0.6)), F(508), 0.3); cue(F(474), "sfx: year ticks; ding")
# dusk: quieter water, a lone gull, the CLOSED sign, then oars
put(sfx, G.water_bed(F(760) - F(535), R, 0.4, 0.4), F(535), 0.25); gull(F(548), 0.15, 0.6); popb(F(560), 0.35)
for k in range(3):
    t_ = F(594) + k * 26 / FPS + 0.3
    put(sfx, G.creak(0.35, R, 120, 160, scale=0.8), t_, 0.18, -0.1)
    n = ns(0.3); put(sfx, bp(R.standard_normal(n), 400, 3000) * np.hanning(n) * 0.4, t_ + 0.25, 0.22, 0.1)
splash(F(646), 0.4); click(F(652), 0.3); popb(F(664), 0.4); popb(F(728), 0.4)
cue(F(594), "sfx: dusk water, oars; the dolphin surfaces, clicks; hearts")
whoosh(F(760), 0.5, 0.4)
n = ns(DUR - F(760)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(760), 0.15)
for k in range(int(F(880) - F(760))): put(sfx, G.clink(R, 2400, 0.03, 0.3), F(760) + k, 0.1, 0.4)
popb(F(764), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(786), 0.55, 0.0); recv(F(854), 0.45)
whoosh(F(880), 0.5, 0.45); cue(F(760), "sfx: night flat, clock tick, Feeloy chime, reply, end-card whoosh")

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
