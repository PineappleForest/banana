"""Soundtrack for "Silent Night" (the Christmas Truce, 1914 -> Feeloy), ~32.2 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
"Silent Night" (Gruber, 1818) is public domain: its first half is "sung" from one trench, the second half answers.
Picture timing is mirrored from src/videos/truce/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 966
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
# Silent Night in C, 6/8, one eighth = E8 s: first half (G A G E | G A G E), the answer (D D B | C C G)
E8 = 0.21
SN1 = [(67, 3), (69, 1), (67, 2), (64, 6), (67, 3), (69, 1), (67, 2), (64, 6)]
SN2 = [(74, 4), (74, 2), (71, 6), (72, 4), (72, 2), (67, 6)]
def melody(seq, t0, inst, g=0.6, tr=0, p=0.0):
    t = t0
    for m, d in seq:
        x = inst(m2f(m + tr), d * E8 * 0.95) if inst is not None else None
        put(mus, x, t, g, p); t += d * E8
    return t
fifeI = lambda f, d: I.fife(f, d, 0.5, R, 0.12)
horn = lambda f, d: I.brass(f, d, 0.35, R, kind="horn", scoop=-8.0, rel=0.15)
# 1-2: cold night: a low A-minor pad, a distant muffled boom or two, a falling glock on "frozen trenches"
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(232), 0.22, R, att=1.2, rel=0.6), 0.0, 0.6)
for k, m in enumerate((76, 72, 69, 64)): put(mus, I.glock(m2f(m), 0.3, R, 1.4), F(140) + k * 0.4, 0.4, 0.2)
cue(0.0, "music: cold A-minor pad; falling glock on 'frozen trenches'")
# 3: candles: one music-box note per candle as it lights (the insert's lighting curve)
lit_prev = 0
for f in range(258, 314):
    u = min(1, max(0, (f - 258) / 54)); n = round(10 * u * u * (3 - 2 * u))
    while lit_prev < n:
        put(mus, I.musicbox(m2f((72, 74, 76, 79, 81, 84, 81, 79, 84, 88)[lit_prev]), 0.45, R, 1.6), F(f), 0.55, 0.2 * (1 if lit_prev % 2 else -1)); lit_prev += 1
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(336) - F(232), 0.22, R, att=0.8, rel=0.5), F(232), 0.6)
cue(F(258), "music: a music-box note for each candle lit")
# 4-5: Silent Night, first half from the far trench (fife), the answer from ours (soft horn), C pad under both
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(470) - F(336), 0.26, R, att=0.5, rel=0.6), F(336), 0.65)
melody(SN1, F(336), fifeI, 0.6, 0, -0.25); cue(F(336), "music: Silent Night first half (fife, far trench; public domain)")
melody(SN2, F(419), horn, 0.55, -12, 0.25); cue(F(419), "music: the answer, second half (soft horn, our trench)")
# 6-8: morning: a bright plucked carol groove in C with sleigh-bell triangle; kick hits
B = 60 / 104; t = F(452)
PROG = [(36, [60, 64, 67, 72]), (41, [60, 65, 69, 72]), (43, [59, 62, 67, 71]), (36, [60, 64, 67, 72])]
k = 0
while t < F(712) - 0.2:
    root, ch = PROG[k % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * B + 0.3, 0.24, R, att=0.2, rel=0.5), t, 0.55)
    put(mus, I.pluck(m2f(root), 0.6, R, 0.9, 0.3), t, 0.8)
    for j in range(8): put(mus, I.pluck(m2f(ch[j % 4] + 12), 0.3, R, 0.45, 0.65), t + j * B / 2, 0.5, 0.3 * (1 if j % 2 else -1))
    for j in range(4): put(mus, I.triangle(0.25, R, 0.4, 2600), t + j * B + B / 2, 0.18, 0.4)
    t += 4 * B; k += 1
for m, dt in [(72, 0), (76, 0.08), (79, 0.16)]: put(mus, I.glock(m2f(m), 0.45, R, 1.2), F(482) + dt, 0.5, 0.2)
cue(F(452), "music: bright plucked carol groove for the morning")
for i in range(12): put(mus, I.pluck(m2f(60 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19][i]), 0.4, R, 0.4, 0.6), F(612) + i * 0.066, 0.45, 0.2)
put(mus, I.glock(m2f(84), 0.55, R, 1.4), F(640), 0.6)
cue(F(612), "music: rising run with the counter, ding at 100,000")
# 9: the lonely flat: Silent Night's first phrase on a lone music box
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(800) - F(707), 0.2, R, att=0.6, rel=0.5), F(707), 0.6)
t = F(718)
for m, d in SN1[:4]: put(mus, I.musicbox(m2f(m + 12), 0.45, R, d * E8 * 1.6), t, 0.55, 0.15); t += d * E8 * 1.2
cue(F(718), "music: lonely music-box Silent Night phrase")
# 10: Feeloy
B0, BEAT2, CARD = F(800), 60 / 96, 897
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
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def wind(t0, t1, g=0.25):
    n = ns(t1 - t0); x = bp(colored(n, R, 1.0), 200, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * tt(t1 - t0)[:n] / 5.0) ** 2)
    put(sfx, fades(x * 0.4, 0.5, 0.5), t0, g)
def boom(t, g=0.3):
    d = 2.2; x = lp(R.standard_normal(ns(d)), 120) * np.exp(-tt(d) / 0.5) * 3; put(sfx, x, t, g, 0.4)
def crunch(f0, f1, every=8, g=0.2, p=0.0):
    f = f0
    while f < f1: n = ns(0.12); put(sfx, bp(R.standard_normal(n), 900, 5000) * np.exp(-tt(0.12)[:n] / 0.03) * 0.5, F(f), g, p); f += every
def thud(t, g=0.5):
    d = 0.3; x = np.sin(2 * np.pi * 90 * tt(d)) * np.exp(-tt(d) / 0.05) + bp(R.standard_normal(ns(d)), 300, 2500) * np.exp(-tt(d) / 0.015) * 0.5
    put(sfx, x, t, g)
# night field: cold wind, two far muffled booms before the hush
wind(0, F(452), 0.32); boom(0.6, 0.35); boom(F(95), 0.25); whoosh(F(168), 0.5, 0.6)
popb(F(140), 0.3); popb(F(186), 0.3); cue(0.0, "sfx: cold wind, distant muffled booms; flash whoosh")
# the match is struck and the candles catch
n = ns(0.35); put(sfx, bp(R.standard_normal(n), 1500, 7000) * np.exp(-tt(0.35)[:n] / 0.08) * 0.6, F(252), 0.35)
n = ns(0.6); put(sfx, lp(R.standard_normal(n), 900) * np.hanning(n) * 0.4, F(256), 0.25); cue(F(252), "sfx: match strike and flare")
# morning: birds, frost crunch on the climb and in no-man's-land, a handshake clap, gift paper, the ball
put(sfx, G.bird_chirps(F(712) - F(452), R, 0.4), F(452), 0.25, 0.4); wind(F(452), F(712), 0.15)
crunch(470, 494, 6, 0.25); thud(F(492), 0.3); cue(F(470), "sfx: morning birds; frost crunch climbing out")
n = ns(0.15); put(sfx, bp(R.standard_normal(n), 800, 4000) * np.exp(-tt(0.15)[:n] / 0.02), F(508), 0.35); cue(F(508), "sfx: handshake clap")
n = ns(0.5); put(sfx, bp(R.standard_normal(n), 2000, 8000) * np.hanning(n) * 0.4, F(535), 0.3); cue(F(535), "sfx: gift paper rustle")
thud(F(566), 0.55); thud(F(596), 0.3); cue(F(566), "sfx: ball kicked, lands")
for k in range(10): put(sfx, G.clink(R, 2400 + 150 * k, 0.03, 0.6), F(612) + k * 0.07, 0.18, 0.3)
popb(F(668), 0.4); whoosh(F(712), 0.5, 0.4)
put(sfx, G.applause(1.6, R, 14), F(642), 0.08)
# the flat
n = ns(DUR - F(712)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(712), 0.15)
for k in range(int((F(897) - F(712)))): put(sfx, G.clink(R, 2400, 0.03, 0.3), F(712) + k, 0.1, 0.4)
popb(F(742), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(822), 0.55, 0.0); recv(F(880), 0.45)
whoosh(F(897), 0.5, 0.45); cue(F(712), "sfx: night flat, clock tick, Feeloy chime, reply, end-card whoosh")

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
