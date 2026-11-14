"""Soundtrack for "The Penguin Who Came Back" (Dindim -> Feeloy), ~30.7 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/penguin/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 920
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
# A gentle bossa-ish groove in D (plucked bass on 1 and the "and" of 2, nylon-ish chord plucks, glock tune), a hush
# when he leaves and while everyone says never, a bright lift when he's back, a playful sting on the peck, a warm swell
# at sunset, the Feeloy section, the end-card chord.
CH = {"D": [50, 54, 57], "Bm": [47, 50, 54], "G": [43, 47, 50], "A": [45, 49, 52], "Em": [52, 55, 59], "F#m": [54, 57, 61]}
def bossa(f0, f1, prog, mel=None, bpm=104, vel=0.8):
    b = 60 / bpm; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.65 * vel, R, 0.6, 0.3), t, 0.8); put(mus, I.pluck(m2f(ch[2] - 12), 0.55 * vel, R, 0.5, 0.3), t + 1.5 * b, 0.7)
        for o in (0.5, 1.25, 2, 2.75, 3.5): put(mus, mx(*[I.pluck(m2f(n + 12), 0.24 * vel, R, 0.25, 0.7) for n in ch]), t + o * b, 0.45, 0.25 * (1 if int(o * 4) % 2 else -1))
        for (o, m, d) in (mel[k % len(mel)] if mel else []): put(mus, I.glock(m2f(m), 0.4 * vel, R, d * b + 0.6), t + o * b, 0.6, 0.15)
        t += 4 * b; k += 1
MEL = [[(0, 78, 1), (1, 81, 1), (2, 83, 2)], [(0, 81, 1.5), (2, 78, 2)], [(0, 79, 1), (1, 78, 1), (2, 76, 2)], [(0, 74, 4)]]
bossa(0, 360, ["D", "Bm", "G", "A"], MEL, 104, 0.8); cue(0.0, "music: gentle bossa groove in D + glock tune")
put(mus, I.glock(m2f(86), 0.5, R, 1.0), F(168), 0.5); cue(F(168), "music: ding on SARDINES")
put(mus, I.brass(m2f(38), 0.6, 0.7, R, kind="tuba"), F(270), 0.6); cue(F(270), "music: deadpan tuba on BACK")
put(mus, I.pad([m2f(n) for n in (47, 54, 59, 62)], F(453) - F(360), 0.22, R, att=0.6, rel=0.5), F(360), 0.6)
for o, m in [(0, 74), (0.6, 71), (1.2, 69), (1.9, 66)]: put(mus, I.musicbox(m2f(m + 12), 0.3, R, 1.6), F(366) + o, 0.5, 0.15)
cue(F(360), "music: hush (he leaves; everyone says never)")
for k, m in enumerate((74, 78, 81, 86)): put(mus, I.glock(m2f(m), 0.45, R, 1.2), F(487) + k * 0.08, 0.6, 0.2)
put(mus, I.cymbal(0.3, R, 1.4), F(487), 0.3, 0.2)
bossa(487, 656, ["D", "G", "A", "D"], [[(0, 81, 1), (1, 83, 1), (2, 86, 2)], [(0, 83, 2), (2, 81, 2)], [(0, 79, 1), (1, 81, 1), (2, 83, 2)], [(0, 81, 4)]], 112, 0.85)
cue(F(487), "music: bright lift, he's back")
put(mus, mx(I.brass(m2f(57), 0.15, 0.8, R), I.brass(m2f(62), 0.15, 0.8, R)), F(616), 0.6); cue(F(616), "music: brass sting on PECKS")
put(mus, I.pad([m2f(n) for n in (38, 50, 54, 57, 62)], F(751) - F(656), 0.34, R, att=0.6, rel=0.8), F(656), 0.75)
for k in range(6): put(mus, I.pluck(m2f((50, 54, 57, 62, 66, 69)[k]), 0.35, R, 1.0, 0.6), F(656) + k * 0.25, 0.5, 0.3 * (1 if k % 2 else -1))
for k, m in enumerate((81, 86, 90, 93)): put(mus, I.glock(m2f(m), 0.4, R, 1.6), F(718) + k * 0.1, 0.55, 0.2)
cue(F(656), "music: warm sunset swell; chimes on COMES BACK")
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 61)], F(800) - F(751), 0.2, R, att=0.6, rel=0.5), F(751), 0.6)
B0, BEAT2, CARD = F(800), 60 / 96, 855
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
def room(t0, t1, g=0.1):
    n = ns(t1 - t0); put(sfx, fades(lp(colored(n, R, 1.0), 700) * 0.4, 0.15, 0.15), t0, g)
def outside(t0, t1, g=0.35):
    d = t1 - t0; put(sfx, fades(G.breeze(d, R, 0.5), 0.2, 0.2), t0, g * 0.5); put(sfx, G.bird_chirps(d, R, 0.6), t0, g * 0.8, 0.4)
def popb(t, g=0.45, p=0.0):
    put(sfx, fades(np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1100, ns(0.09))) / SR) * np.hanning(ns(0.09)), 0.0, 0.01), t, g, p)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def waves(t0, t1, g=0.3):
    n = ns(t1 - t0); x = lp(colored(n, R, 1.0), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * tt(t1 - t0)[:n] / 3.4) ** 2)
    put(sfx, fades(x * 0.35, 0.4, 0.4), t0, g)
def honk(t, g=0.3, f0=520):
    d = 0.16; x = np.sign(np.sin(2 * np.pi * f0 * tt(d) * (1 + 0.15 * tt(d)))) * np.hanning(ns(d)); put(sfx, lp(x, 2500) * 0.5, t, g, 0.1)
def pat(t, g=0.15): put(sfx, lp(colored(ns(0.05), R, 0.5), 1500) * np.hanning(ns(0.05)), t, g)
def tick(t0, t1, g=0.1):
    k = 0
    while t0 + k < t1: put(sfx, G.clink(R, 2400, 0.03, 0.3), t0 + k, g, 0.4); k += 1
waves(0, F(751) + 0.3, 0.38); cue(0.0, "sfx: waves the whole beach")
honk(F(40), 0.2, 440); popb(F(62), 0.35); whoosh(F(130), 0.5, 0.6); cue(F(40), "sfx: weak honk; pop; flash whoosh")
for k in range(8): put(sfx, G.clink(R, 3500 + 400 * (k % 3), 0.04, 0.4), F(136) + k * 0.11, 0.1, 0.2)
popb(F(166), 0.35); honk(F(172), 0.25, 620); honk(F(180), 0.25, 660); cue(F(136), "sfx: soap bubbles, fish pop, happy honks")
for k in range(5): pat(F(232) + k * 14 / 30)
honk(F(272), 0.22, 560); cue(F(232), "sfx: penguin waddle pats; honk on BACK")
popb(F(308), 0.3); for_ = [pat(F(362) + k * 14 / 30, 0.1) for k in range(4)]
put(sfx, G.whoosh(0.6, R, peak=0.3, f_lo=200, f_hi=1000), F(412), 0.2); popb(F(426), 0.3)
for f0 in (456, 518, 528): popb(F(f0), 0.3)
honk(F(486), 0.3, 640); honk(F(494), 0.3, 700); cue(F(486), "sfx: delighted honks, he's back")
put(sfx, mx(G.clink(R, 1800, 0.05, 0.7), lp(colored(ns(0.04), R, 0.0), 3000) * 0.6), F(616), 0.45); honk(F(612), 0.3, 760)
cue(F(612), "sfx: PECK + indignant honk")
popb(F(716), 0.35); honk(F(700), 0.15, 600)
n = ns(DUR - F(751)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(751), 0.15)
tick(F(751), F(800), 0.12); put(sfx, G.crickets(F(855) - F(751), R, 3), F(751), 0.18, 0.3); popb(F(760), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(800), 0.55, 0.0); recv(F(834), 0.45)
whoosh(F(855), 0.5, 0.45); cue(F(751), "sfx: night flat, Feeloy chime, reply, end-card whoosh")

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
