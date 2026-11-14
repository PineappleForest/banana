"""Soundtrack for "The Perfect Pet" (the 1975 Pet Rock -> Feeloy), 62.0 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/petrock/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1860
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
# A 70s funk-lounge groove in F (plucked bass + clav-ish chords + glock riff), a lazy bar walk, a "ding" on the idea and a
# tuba thud on ROCK, a light pizzicato for the inserts with dings on SIT/STAY, a festive Christmas oompah with a rising
# counter run, a big brass MILLIONAIRE, a sad tuba fall on SALE, a near-silent deadpan, a soft night with music box,
# the modern Feeloy section, the end-card chord.
CH = {"F": [53, 57, 60], "Bb": [46, 50, 53], "C": [48, 52, 55], "Dm": [50, 53, 57], "Gm": [55, 58, 62], "C7": [48, 52, 58]}
def oompah(f0, f1, prog, mel=None, bpm=120, vel=0.8, inst="pluck"):
    b = 60 / bpm; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.65 * vel, R, 0.5, 0.3), t, 0.85)
        for j in range(1, 4): put(mus, mx(*[I.pluck(m2f(n + 12), 0.26 * vel, R, 0.3, 0.6) for n in ch]), t + j * b, 0.45, 0.2 * (1 if j % 2 else -1))
        put(mus, I.pluck(m2f(ch[2] - 12), 0.55 * vel, R, 0.4, 0.3), t + 2 * b, 0.7)
        for (o, m, d) in (mel[k % len(mel)] if mel else []):
            x = I.glock(m2f(m), 0.4 * vel, R, d * b + 0.6) if inst == "glock" else I.pluck(m2f(m), 0.5 * vel, R, d * b + 0.4, 0.75)
            put(mus, x, t + o * b, 0.65, 0.2)
        t += 4 * b; k += 1
def funk(f0, f1, bpm=100, vel=0.8):
    """syncopated plucked bass (F minor-pentatonic line) + off-beat clav stabs on F7 / Bb7"""
    b = 60 / bpm; t = F(f0); k = 0
    LINE = [(0, 41, 0.4), (0.75, 41, 0.2), (1.5, 44, 0.3), (2, 46, 0.3), (2.75, 48, 0.2), (3.25, 46, 0.3)]
    while t < F(f1) - 0.2:
        root = 0 if (k // 2) % 2 == 0 else 5
        for (o, m, d) in LINE: put(mus, I.pluck(m2f(m + root), 0.7 * vel, R, d + 0.15, 0.25), t + o * b, 0.85)
        for o in (0.5, 1.5, 2.5, 3.5): put(mus, mx(*[I.pluck(m2f(n + root), 0.22 * vel, R, 0.12, 0.85) for n in (63, 65, 69)]), t + o * b, 0.4, 0.3 * (1 if o % 2 else -1))
        t += 4 * b; k += 1
RIFF = [(0, 77, 0.5), (0.5, 80, 0.5), (1, 82, 0.5), (2, 84, 1), (3, 80, 1)]
funk(0, 126, 100, 0.85)
t = F(0)
while t < F(126) - 0.4: [put(mus, I.glock(m2f(m), 0.36, R, d * 0.6 + 0.5), t + o * 0.6, 0.55, 0.15) for (o, m, d) in RIFF]; t += 8 * 0.6
put(mus, mx(I.brass(m2f(53), 0.4, 0.8, R), I.brass(m2f(57), 0.4, 0.75, R), I.brass(m2f(60), 0.4, 0.75, R)), F(97), 0.7); cue(0.0, "music: 70s funk groove in F + glock riff; brass stab on PETS")
put(mus, I.pad([m2f(n) for n in (53, 57, 60, 64)], F(436) - F(126), 0.22, R, att=0.6, rel=0.5), F(126), 0.55)
t = F(126); bb = 60 / 92; k = 0
while t < F(436) - 0.3:
    for j, m in enumerate((41, 45, 48, 50, 46, 50, 53, 51)[k % 2 * 4: k % 2 * 4 + 4]): put(mus, I.pluck(m2f(m), 0.55, R, 0.5, 0.3), t + j * bb, 0.75)
    t += 4 * bb; k += 1
cue(F(126), "music: lazy walking bass + soft pad in the bar")
put(mus, mx(I.glock(m2f(84), 0.55, R, 1.2), I.glock(m2f(91), 0.4, R, 1.2)), F(376), 0.6); cue(F(376), "music: idea ding (lightbulb)")
put(mus, mx(I.brass(m2f(29), 0.5, 0.9, R, kind="tuba"), I.timpani(m2f(29), 0.8, R, 1.2)), F(411), 0.8); cue(F(411), "music: tuba thud on A ROCK")
funk(436, 614, 104, 0.8)
oompah(502, 614, ["F", "Bb", "C", "F"], [[(0, 81, 1), (1, 84, 1), (2, 81, 2)], [(0, 82, 2), (2, 77, 2)], [(0, 79, 1), (1, 76, 1), (2, 79, 2)], [(0, 77, 4)]], bpm=104, vel=0.5, inst="glock")
t = F(614); b8 = 60 / 112
while t < F(922) - 0.2:
    for j, m in enumerate((65, 69, 72, 69, 70, 74, 77, 74)): put(mus, I.pluck(m2f(m), 0.34, R, 0.18, 0.7), t + j * b8 / 2, 0.5, 0.25 * (1 if j % 2 else -1))
    put(mus, I.pluck(m2f(41), 0.6, R, 0.4, 0.3), t, 0.7); put(mus, I.pluck(m2f(48), 0.5, R, 0.4, 0.3), t + 2 * b8, 0.6)
    t += 4 * b8
cue(F(614), "music: light pizzicato under the inserts")
for f0, m in ((793, 84), (810, 86), (829, 89)): put(mus, I.glock(m2f(m), 0.5, R, 0.9), F(f0), 0.6)
put(mus, I.brass(m2f(34), 0.9, 0.8, R, kind="tuba", fall=-3), F(862), 0.7); cue(F(793), "music: dings on SIT / STAY / EASY; tuba roll-over")
put(mus, mx(I.brass(m2f(53), 0.25, 0.8, R), I.brass(m2f(57), 0.25, 0.8, R), I.brass(m2f(60), 0.25, 0.8, R)), F(944), 0.6)
oompah(983, 1148, ["F", "Dm", "Bb", "C7"], [[(0, 81, 1), (1, 81, 1), (2, 81, 2)], [(0, 81, 1), (1, 81, 1), (2, 81, 2)], [(0, 81, 1), (1, 84, 1), (2, 77, 1.5), (3.5, 79, 0.5)], [(0, 81, 4)]], bpm=120, vel=0.85, inst="glock")
for k in range(10): put(mus, I.glock(m2f(72 + k * 2), 0.32, R, 0.4), F(990) + k * 0.095, 0.45, 0.2)
put(mus, I.cymbal(0.4, R, 1.8), F(1019), 0.35, 0.2); cue(F(983), "music: festive Christmas oompah (jingle-ish glock), rising run to a MILLION")
put(mus, mx(I.brass(m2f(53), 1.2, 0.85, R), I.brass(m2f(57), 1.2, 0.8, R), I.brass(m2f(60), 1.2, 0.8, R), I.brass(m2f(65), 1.2, 0.75, R), I.timpani(m2f(41), 0.7, R, 2.0)), F(1176), 0.75)
oompah(1148, 1212, ["F", "Bb", "C", "F"], RIFF and [[(0, 84, 1), (1, 81, 1), (2, 84, 2)]], bpm=120, vel=0.85, inst="glock")
cue(F(1176), "music: big brass MILLIONAIRE")
put(mus, I.pad([m2f(n) for n in (50, 53, 57)], F(1313) - F(1212), 0.18, R, att=0.3, rel=0.4), F(1212), 0.55)
for o, m in ((0, 69), (0.5, 67), (1.0, 65), (1.6, 64)): put(mus, I.pluck(m2f(m), 0.4, R, 0.5, 0.6), F(1214) + o, 0.5)
put(mus, mx(I.brass(m2f(41), 0.25, 0.8, R, kind="tuba"), I.brass(m2f(40), 1.0, 0.8, R, kind="tuba", fall=-5)), F(1289), 0.8); cue(F(1289), "music: sad tuba fall on SALE")
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(1652) - F(1415), 0.2, R, att=0.8, rel=0.6), F(1415), 0.6)
for o, m in [(0, 77), (0.5, 74), (1.0, 72), (1.7, 69)]: put(mus, I.musicbox(m2f(m + 12), 0.32, R, 1.8), F(1485) + o, 0.55, 0.15)
cue(F(1415), "music: soft night pad; music box on YOURS")
B0, BEAT2, CARD = F(1652), 60 / 96, 1792
PROG2 = [(53, [65, 69, 72, 77]), (50, [62, 65, 69, 74]), (46, [58, 62, 65, 70]), (48, [60, 64, 67, 72])]
MEL2 = [[(0, 81, 1.5), (2, 79, 1), (3, 77, 1)], [(0, 79, 2), (2.5, 81, 1.5)], [(0, 84, 1), (1, 82, 1), (2, 79, 2)], [(0, 77, 1.5), (2, 81, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (F pad, pluck arps, glock)")
for m, dt in [(65, 0), (69, 0.12), (72, 0.24), (77, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (41, 53, 57, 60, 65)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
put(mus, I.triangle(0.4, R, 2.4), F(CARD), 0.5, 0.3)
cue(F(CARD), "music: end-card chord + music box + triangle")
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
def thud(t, g=0.4, f0=70): put(sfx, lp(np.sin(2 * np.pi * f0 * tt(0.25) * (1 - 0.4 * tt(0.25))) * np.exp(-tt(0.25) * 14), 400), t, g)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def flip(t, g=0.25): put(sfx, bp(colored(ns(0.14), R, 0.3), 1500, 6000) * np.hanning(ns(0.14)), t, g, 0.3)
def rustle(t, d, g=0.12): put(sfx, bp(colored(ns(d), R, 0.2), 2500, 9000) * np.hanning(ns(d)), t, g, -0.2)
def puff(t, g=0.12): put(sfx, lp(colored(ns(0.25), R, 0.5), 1200) * np.hanning(ns(0.25)), t, g)
def tick(t0, t1, g=0.1):
    k = 0
    while t0 + k < t1: put(sfx, G.clink(R, 2400, 0.03, 0.3), t0 + k, g, 0.4); k += 1
def register(t, g=0.35): put(sfx, mx(I.glock(m2f(96), 0.6, R, 1.2), I.glock(m2f(100), 0.5, R, 1.2)), t + 0.12, g); [put(sfx, G.clink(R, 3000 + 300 * i, 0.04, 0.5), t + 0.03 * i, g * 0.5) for i in range(4)]
def waves(t0, t1, g=0.3):
    n = ns(t1 - t0); x = lp(colored(n, R, 1.0), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * tt(t1 - t0)[:n] / 3.4) ** 2)
    put(sfx, fades(x * 0.35, 0.4, 0.4), t0, g)
room(0, F(126), 0.09); popb(F(62), 0.3); popb(F(97), 0.35); whoosh(F(126), 0.5, 0.6); cue(0.0, "sfx: den tone, pops; flash whoosh")
room(F(126), F(436), 0.1); put(sfx, fades(G.babble(F(436) - F(130), R, 190, 1.0), 0.3, 0.4), F(130), 0.14, -0.2)
put(sfx, G.clink(R, 1800, 0.2, 0.6), F(140), 0.18, 0.3); popb(F(296), 0.35); popb(F(322), 0.35); popb(F(376), 0.3); popb(F(411), 0.35)
cue(F(126), "sfx: bar chatter, glass clink, bubble pops")
room(F(436), F(502), 0.09); popb(F(450), 0.3); thud(F(468), 0.5); cue(F(468), "sfx: SOLD stamp thud")
waves(F(498), F(618), 0.35); [put(sfx, G.clink(R, 900 + 150 * i, 0.08, 0.6), F(514) + 0.05 * i, 0.15) for i in range(5)]; popb(F(581), 0.35)
cue(F(498), "sfx: beach waves; stones clatter in the bucket")
room(F(614), F(983), 0.08); put(sfx, bp(colored(ns(0.35), R, 0.5), 300, 1600) * np.hanning(ns(0.35)), F(682), 0.25); rustle(F(686), 0.5)
for k in range(2): puff(F(718 + 22 * k))
cue(F(682), "sfx: cardboard lid creak, straw rustle, breath puffs")
flip(F(791)); flip(F(808)); flip(F(852))
n = ns(1.0); put(sfx, lp(colored(n, R, 1.0), 300) * np.hanning(n) * 0.6, F(860), 0.3); cue(F(791), "sfx: page flips; rock rolls over")
register(F(944)); cue(F(944), "sfx: cash-register ding on $3.95")
outside(F(979), F(1060), 0.25); put(sfx, fades(G.babble(F(1060) - F(983), R, 220, 1.2), 0.2, 0.4), F(983), 0.16)
for k in range(24): put(sfx, G.clink(R, 5200 + 500 * (k % 3), 0.05, 0.4), F(983) + k * 0.19, 0.09, 0.3 * (1 if k % 2 else -1))
cue(F(983), "sfx: shoppers, sleigh-bell jingles")
room(F(1060), F(1212), 0.09); popb(F(1095), 0.35)
for i in range(3): rustle(F(1174 + 5 * i), 0.3, 0.14)
cue(F(1174), "sfx: cash flutters")
outside(F(1208), F(1313), 0.3); put(sfx, G.whoosh(0.8, R, peak=0.4, f_lo=200, f_hi=1200), F(1230), 0.25); popb(F(1232), 0.3); popb(F(1288), 0.4)
cue(F(1230), "sfx: February wind; SALE pop")
room(F(1313), F(1415), 0.08); put(sfx, G.crickets(1.6, R, 1), F(1372), 0.18, 0.2); cue(F(1372), "sfx: a lone cricket (deadpan)")
n = ns(DUR - F(1415)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1415), 0.15)
tick(F(1415), F(1652), 0.12); popb(F(1485), 0.3); popb(F(1578), 0.3)
put(sfx, G.crickets(F(1792) - F(1415), R, 3), F(1415), 0.18, 0.3); cue(F(1415), "sfx: night: clock ticks, crickets")
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1652), 0.55, 0.0); cue(F(1652), "sfx: Feeloy chime (phone)")
recv(F(1766), 0.45)
whoosh(F(1792), 0.5, 0.45); cue(F(1792), "sfx: end-card whoosh")

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
