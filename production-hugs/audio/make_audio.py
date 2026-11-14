"""Soundtrack for "Free Hugs" (Sydney, 2004 -> Feeloy), ~32.8 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/hugs/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 985
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
# Warm acoustic in C: a quiet lonely pluck arrival, a hopeful marker-squeak bounce, a sad hush as people walk past,
# a warm lift on the first hug, a dull stop on the ban, a rising run with the petition counter, the hugs back, Feeloy.
def arp(t0, t1, ch, beat, g=0.5, bass=None, bright=0.5):
    t = t0
    while t < t1 - 0.2:
        for j in range(8):
            if t + j * beat / 2 >= t1 - 0.1: break
            put(mus, I.pluck(m2f(ch[j % len(ch)]), 0.3, R, 0.5, bright), t + j * beat / 2, g, 0.3 * (1 if j % 2 else -1))
        if bass: put(mus, I.pluck(m2f(bass), 0.6, R, 0.9, 0.3), t, g * 1.4)
        t += 4 * beat
# 1: arrival, sparse and a bit lonely (Am -> F)
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60, 64)], F(164), 0.22, R, att=1.0, rel=0.5), 0.0, 0.6)
arp(0.2, F(110), [57, 60, 64, 69], 60 / 84, 0.42, 33)
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60)], F(164) - F(110), 0.22, R, att=0.5, rel=0.4), F(110), 0.55)
for k, m in enumerate((76, 72, 69)): put(mus, I.glock(m2f(m), 0.3, R, 1.4), F(118) + k * 0.5, 0.4, 0.2)
cue(0.0, "music: sparse acoustic Am arpeggio; falling glock on 'nobody was waiting'")
# 2-3: the sign and the mall: hopeful bounce in C
B = 60 / 104
arp(F(164), F(322), [60, 64, 67, 72], B, 0.5, 36, 0.6)
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(322) - F(164), 0.22, R, att=0.3, rel=0.5), F(164), 0.55)
for k, m in enumerate((72, 76, 79)): put(mus, I.glock(m2f(m), 0.45, R, 1.2), F(226) + k * 0.12, 0.5, 0.2)
cue(F(164), "music: hopeful plucked bounce in C; glock lift on 'Free Hugs'")
# 4: walked past: the groove drops to a hush
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(411) - F(322), 0.24, R, att=0.4, rel=0.5), F(322), 0.6)
for k in range(5): put(mus, I.pluck(m2f((69, 67, 64, 62, 60)[k]), 0.35, R, 1.2, 0.4), F(330) + k * 0.55, 0.5, 0.1)
cue(F(322), "music: hush, slow falling plucks (walked past)")
# 5: the stranger stops (suspended), the hug (warm major bloom)
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 65)], F(474) - F(411), 0.22, R, att=0.4, rel=0.3), F(411), 0.55)
put(mus, I.glock(m2f(79), 0.4, R, 1.2), F(443), 0.45)
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64, 67, 72)], F(584) - F(474), 0.32, R, att=0.25, rel=0.4), F(474), 0.8)
for m, dt in [(60, 0), (64, 0.08), (67, 0.16), (72, 0.24), (76, 0.32)]: put(mus, I.musicbox(m2f(m + 12), 0.5, R, 1.6), F(474) + dt, 0.6, 0.2)
arp(F(476), F(584), [60, 64, 67, 72], 60 / 112, 0.55, 36, 0.65)
cue(F(474), "music: warm major bloom on the hug; bright groove (everyone wanted one)")
# 7: banned: everything stops on a low dull chord + tuba
put(mus, I.brass(m2f(31), 0.7, 0.7, R, kind="tuba"), F(584), 0.55)
put(mus, I.pad([m2f(n) for n in (40, 47, 52, 55)], F(612) - F(586), 0.2, R, att=0.05, rel=0.3), F(586), 0.5)
cue(F(584), "music: groove stops; deadpan tuba on BANNED")
# 8: petition counter: rising run, then the hugs back
for k in range(12): put(mus, I.pluck(m2f(48 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19][k]), 0.4, R, 0.4, 0.6), F(612) + k * 0.055, 0.45, 0.2)
put(mus, I.glock(m2f(84), 0.55, R, 1.4), F(632), 0.6); put(mus, I.triangle(0.4, R, 1.4), F(632), 0.35, 0.3)
arp(F(634), F(805), [60, 64, 67, 72], 60 / 104, 0.5, 36, 0.6)
put(mus, I.pad([m2f(n) for n in (48, 55, 60, 64)], F(805) - F(634), 0.26, R, att=0.4, rel=0.6), F(634), 0.65)
for m, dt in [(72, 0), (76, 0.1), (79, 0.2), (84, 0.3)]: put(mus, I.glock(m2f(m), 0.45, R, 1.4), F(688) + dt, 0.55, 0.2)
cue(F(612), "music: rising run with the counter; ding at 10,000; warm groove as the hugs come back")
# 10: the lonely flat, then Feeloy
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(858) - F(805), 0.22, R, att=0.6, rel=0.5), F(805), 0.6)
B0, BEAT2, CARD = F(858), 60 / 96, 915
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
def mall(t0, t1, g=0.3, talk=3):
    d = t1 - t0; put(sfx, fades(lp(colored(ns(d), R, 1.0), 900) * 0.35, 0.25, 0.25), t0, g)
    for k in range(talk): put(sfx, fades(G.babble(d, R, R.uniform(110, 230), R.uniform(0.9, 1.2)), 0.3, 0.3), t0, g * 0.35, R.uniform(-0.7, 0.7))
def steps(f0, f1, every=9, g=0.2, p=0.0):
    f = f0
    while f < f1: put(sfx, G.stroll_step(R, 0.4), F(f), g, p); f += every
def squeak(t, d=0.35, g=0.25):
    tt_ = tt(d); x = np.sin(2 * np.pi * np.cumsum(1900 + 500 * np.sin(2 * np.pi * 7 * tt_)) / SR) * (0.5 + 0.5 * R.standard_normal(len(tt_)) * 0.3)
    put(sfx, bp(x, 1200, 4000) * np.hanning(len(tt_)) * 0.3, t, g, 0.15)
def thud(t, g=0.6):
    d = 0.4; x = np.sin(2 * np.pi * 60 * tt(d)) * np.exp(-tt(d) / 0.08) + bp(R.standard_normal(ns(d)), 200, 2000) * np.exp(-tt(d) / 0.02) * 0.6
    put(sfx, x, t, g)
# 1: city street at golden hour, footsteps + suitcase wheels, then quiet
mall(0, F(164), 0.18, 2); steps(8, 100, 9, 0.22)
n = ns(F(100) - F(8)); put(sfx, bp(colored(n, R, 0.5), 300, 1500) * 0.15, F(8), 0.3, 0.2)
popb(F(116), 0.3); whoosh(F(164), 0.5, 0.6); cue(0.0, "sfx: street bed, footsteps + suitcase wheels; dots pop; flash whoosh")
# 2: marker squeaks writing FREE HUGS
room(F(164), F(260), 0.08)
for k in range(8): squeak(F(174) + k * 0.28, 0.22, 0.22)
cue(F(174), "sfx: marker squeaks lettering the sign")
# 3-9: the mall
mall(F(260), F(805), 0.3, 4)
steps(322, 382, 9, 0.22, -0.3); steps(366, 411, 9, 0.22, 0.3); steps(411, 444, 10, 0.22, -0.2)
cue(F(322), "sfx: mall crowd bed; passers-by footsteps")
whoosh(F(474), 0.35, 0.35); popb(F(478), 0.4); popb(F(520), 0.35, -0.2); popb(F(540), 0.35, 0.2)
cue(F(474), "sfx: soft whoosh on the hug; heart pops")
thud(F(584), 0.7); cue(F(584), "sfx: BANNED stamp thud")
for k in range(10): put(sfx, G.clink(R, 2400 + 150 * k, 0.03, 0.6), F(612) + k * 0.066, 0.18, 0.3)
put(sfx, mx(I.glock(m2f(91), 0.5, R, 0.6)), F(632), 0.3); cue(F(612), "sfx: counter ticks; ding at 10,000")
popb(F(688), 0.4); popb(F(764), 0.4); whoosh(F(805), 0.5, 0.4)
put(sfx, G.applause(1.8, R, 20), F(690), 0.12)
# 10: night flat
n = ns(DUR - F(805)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(805), 0.15)
put(sfx, G.crickets(F(915) - F(805), R, 3), F(805), 0.18, 0.3); popb(F(812), 0.3)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(858), 0.55, 0.0); recv(F(902), 0.45)
whoosh(F(915), 0.5, 0.45); cue(F(805), "sfx: night flat, Feeloy chime, reply, end-card whoosh")

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
