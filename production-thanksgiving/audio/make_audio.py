"""Soundtrack for "Can I Still Get a Plate?" (the wrong-number Thanksgiving text -> Feeloy), 61.3 s, 48 kHz.
Original score (own additive synthesis from lib/instruments.py) + synthesized SFX (lib/sfx_gen.py) + the voice, mixed:
music +3 dB, SFX -6 dB relative to their base levels, voice unchanged, music ducked -3 dB under speech,
integrated -15 LUFS, true peak <= -1.2 dBTP. Writes mix.wav, stems/, cues.md.
Picture timing is mirrored from src/videos/thanksgiving/story.ts + cast.ts (frames at 30 fps).
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
FPS, TOTAL = 30, 1840
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
# A warm G-major folk pluck groove for grandma's table (glock tune), an "uh-oh" tuba on "by accident", a sad tuba fall
# when the number turns out changed, a ticking classroom, a sneaky E-minor pizzicato for the texting, a "bwomp" on NOT
# grandma, a big warm brass "of course", a bouncy march for the street, soft music box for the empty chair, a full warm
# swell at sunset, a bare night, the modern Feeloy section, the end-card chord.
CH = {"G": [55, 59, 62], "C": [48, 52, 55], "D": [50, 54, 57], "Em": [52, 55, 59], "Am": [57, 60, 64], "B7": [47, 51, 54]}
def oompah(f0, f1, prog, mel=None, bpm=120, vel=0.8, waltz=False, inst="pluck"):
    b = 60 / bpm; per = 3 if waltz else 4; t = F(f0); k = 0
    while t < F(f1) - 0.3:
        ch = CH[prog[k % len(prog)]]
        put(mus, I.pluck(m2f(ch[0] - 12), 0.65 * vel, R, 0.5, 0.3), t, 0.85)
        for j in range(1, per): put(mus, mx(*[I.pluck(m2f(n + 12), 0.26 * vel, R, 0.3, 0.6) for n in ch]), t + j * b, 0.45, 0.2 * (1 if j % 2 else -1))
        if not waltz: put(mus, I.pluck(m2f(ch[2] - 12), 0.55 * vel, R, 0.4, 0.3), t + 2 * b, 0.7)
        for (o, m, d) in (mel[k % len(mel)] if mel else []):
            x = I.glock(m2f(m), 0.4 * vel, R, d * b + 0.6) if inst == "glock" else I.pluck(m2f(m), 0.5 * vel, R, d * b + 0.4, 0.75)
            put(mus, x, t + o * b, 0.65, 0.2)
        t += per * b; k += 1
MELG = [[(0, 74, 1), (1, 71, 0.5), (1.5, 74, 0.5), (2, 79, 1)], [(0, 76, 1), (1, 79, 1), (2, 76, 2)], [(0, 74, 1), (1, 78, 1), (2, 81, 1)], [(0, 79, 2), (2, 74, 2)]]
oompah(0, 345, ["G", "C", "G", "D"], MELG, bpm=104, vel=0.75, inst="glock"); cue(0.0, "music: warm G folk pluck groove + glock tune")
put(mus, mx(I.brass(m2f(43), 0.25, 0.8, R, kind="tuba"), I.brass(m2f(42), 0.5, 0.8, R, kind="tuba", fall=-3)), F(163), 0.75); cue(F(163), "music: uh-oh tuba on BY ACCIDENT")
put(mus, I.brass(m2f(40), 0.9, 0.75, R, kind="tuba", fall=-5), F(306), 0.7); cue(F(306), "music: sad tuba fall (changed number)")
put(mus, I.pad([m2f(n) for n in (52, 55, 59)], F(470) - F(345), 0.2, R, att=0.4, rel=0.4), F(345), 0.6)
t = F(470); b = 60 / 120
while t < F(720) - 0.2:
    for j, m in enumerate((64, 67, 71, 67, 63, 66, 71, 66)): put(mus, I.pluck(m2f(m), 0.36, R, 0.18, 0.7), t + j * b / 2, 0.5, 0.25 * (1 if j % 2 else -1))
    put(mus, I.pluck(m2f(40), 0.6, R, 0.4, 0.3), t, 0.7); put(mus, I.pluck(m2f(47), 0.5, R, 0.4, 0.3), t + 2 * b, 0.6)
    t += 4 * b
cue(F(470), "music: sneaky E-minor pizzicato (the texting)")
put(mus, mx(I.brass(m2f(38), 0.18, 0.85, R, kind="tuba"), I.brass(m2f(35), 0.6, 0.85, R, kind="tuba", fall=-4)), F(676), 0.8); cue(F(676), "music: bwomp on NOT grandma")
oompah(720, 875, ["G", "Em", "C", "D"], [[(0, 79, 1), (1, 81, 1), (2, 83, 2)], [(0, 81, 2)], [(0, 79, 1), (1, 76, 1)], [(0, 78, 1), (1, 81, 2)]], bpm=120, vel=0.7, inst="glock")
for k, m in enumerate((74, 78, 81)): put(mus, I.glock(m2f(m + 12), 0.4, R, 1.4), F(831) + k * 0.1, 0.6, 0.2)
cue(F(831), "music: questioning glock run on CAN I STILL GET A PLATE")
put(mus, mx(I.brass(m2f(55), 0.9, 0.8, R), I.brass(m2f(59), 0.9, 0.75, R), I.brass(m2f(62), 0.9, 0.75, R), I.timpani(m2f(43), 0.6, R, 1.8)), F(895), 0.7); cue(F(895), "music: big warm brass OF COURSE")
oompah(900, 1003, ["G", "C", "D", "G"], MELG, bpm=112, vel=0.85, inst="glock")
put(mus, I.cymbal(0.3, R, 1.6), F(959), 0.3, 0.2)
oompah(1003, 1240, ["G", "D", "Em", "C"], [[(0, 79, 1), (1, 78, 1), (2, 76, 1), (3, 74, 1)], [(0, 74, 2), (2, 78, 2)], [(0, 76, 1), (1, 79, 1), (2, 83, 2)], [(0, 81, 4)]], bpm=126, vel=0.8)
cue(F(1003), "music: bouncy street march")
put(mus, I.pad([m2f(n) for n in (48, 55, 59, 64)], F(1330) - F(1240), 0.24, R, att=0.8, rel=0.6), F(1240), 0.6)
for o, m in [(0, 79), (0.6, 76), (1.2, 74), (1.9, 71)]: put(mus, I.musicbox(m2f(m + 12), 0.32, R, 1.8), F(1244) + o, 0.55, 0.15)
for o, m in [(0, 74), (0.5, 79), (1.0, 83)]: put(mus, I.musicbox(m2f(m + 12), 0.38, R, 2.0), F(1294) + o, 0.6, 0.15)
cue(F(1244), "music: soft music box for the empty chair; it lifts when he sits down")
oompah(1330, 1418, ["G", "C", "G", "D"], MELG, bpm=112, vel=0.9, inst="glock")
put(mus, I.cymbal(0.35, R, 2.0), F(1330), 0.3, -0.2)
put(mus, I.pad([m2f(n) for n in (43, 55, 59, 62, 67)], F(1556) - F(1418), 0.36, R, att=0.6, rel=0.8), F(1418), 0.75)
for k in range(6): put(mus, I.pluck(m2f((55, 59, 62, 67, 71, 74)[k]), 0.35, R, 1.0, 0.6), F(1418) + k * 0.25, 0.5, 0.3 * (1 if k % 2 else -1))
for k, m in enumerate((79, 83, 86, 91)): put(mus, I.glock(m2f(m), 0.42, R, 1.6), F(1528) + k * 0.1, 0.6, 0.2)
cue(F(1418), "music: warm sunset swell; chimes on ANSWERED")
put(mus, I.pad([m2f(n) for n in (45, 52, 57, 60)], F(1652) - F(1556), 0.2, R, att=0.8, rel=0.6), F(1556), 0.6)
B0, BEAT2, CARD = F(1652), 60 / 96, 1776
PROG2 = [(55, [67, 71, 74, 79]), (52, [64, 67, 71, 76]), (48, [60, 64, 67, 72]), (50, [62, 66, 69, 74])]
MEL2 = [[(0, 83, 1.5), (2, 81, 1), (3, 79, 1)], [(0, 81, 2), (2.5, 83, 1.5)], [(0, 86, 1), (1, 84, 1), (2, 81, 2)], [(0, 79, 1.5), (2, 83, 2)]]
b = 0
while B0 + b * 4 * BEAT2 < F(CARD):
    tb = B0 + b * 4 * BEAT2; root, ch = PROG2[b % 4]
    put(mus, I.pad([m2f(n) for n in ch], 4 * BEAT2 + 0.3, 0.3, R, att=0.4, rel=0.6), tb, 0.7)
    put(mus, I.pluck(m2f(root - 12), 0.7, R, 1.4, 0.3), tb, 0.9, -0.1)
    for k in range(8): put(mus, I.pluck(m2f(ch[k % 4] + 12), 0.32, R, 0.5, 0.6), tb + k * BEAT2 / 2, 0.55, 0.35 * (1 if k % 2 else -1))
    for (o, m, d) in MEL2[b % 4]: put(mus, I.glock(m2f(m), 0.45, R, d * BEAT2 + 0.8), tb + o * BEAT2, 0.7, 0.15)
    b += 1
cue(B0, "music: modern Feeloy section (G pad, pluck arps, glock)")
for m, dt in [(67, 0), (71, 0.12), (74, 0.24), (79, 0.36)]: put(mus, I.musicbox(m2f(m + 12), 0.55, R, 2.2), F(CARD) + dt, 0.9, 0.2)
put(mus, I.pad([m2f(n) for n in (43, 55, 59, 62, 67)], DUR - F(CARD), 0.4, R, att=0.2, rel=1.0), F(CARD), 0.9)
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
def buzz(t, g=0.3):
    """a phone vibrating on a desk: two short square-ish 170 Hz bursts"""
    for k in range(2): put(sfx, lp(np.sign(np.sin(2 * np.pi * 170 * tt(0.22))) * 0.5, 900) * np.hanning(ns(0.22)), t + k * 0.32, g)
def sent(t, g=0.3): put(sfx, G.whoosh(0.22, R, peak=0.08, f_lo=900, f_hi=4000), t - 0.05, g, 0.2)
def recv(t, g=0.35): put(sfx, mx(I.glock(m2f(88), 0.5, R, 0.5), I.glock(m2f(93), 0.4, R, 0.5)), t, g, -0.1)
def shutter(t, g=0.35): put(sfx, mx(bp(colored(ns(0.03), R, 0.0), 1500, 7000) * np.hanning(ns(0.03)), np.r_[np.zeros(ns(0.07)), bp(colored(ns(0.04), R, 0.0), 1200, 6000) * np.hanning(ns(0.04))]), t, g)
def flip(t, g=0.25): put(sfx, bp(colored(ns(0.12), R, 0.3), 1500, 6000) * np.hanning(ns(0.12)), t, g, 0.3)
def tick(t0, t1, g=0.12):
    k = 0
    while t0 + k < t1: put(sfx, G.clink(R, 2400, 0.03, 0.3), t0 + k, g, 0.4); k += 1
room(0, F(345), 0.09)
popb(F(110), 0.35); whoosh(F(196), 0.5, 0.6); cue(F(110), "sfx: pop on the stranger's ?; flash whoosh")
for k in range(10): put(sfx, G.clink(R, 2600, 0.02, 0.5), F(200) + k * 0.17, 0.1, -0.2)
sent(F(209), 0.4); cue(F(200), "sfx: typing taps; message sent")
put(sfx, lp(np.sign(np.sin(2 * np.pi * 130 * tt(0.3))) * 0.4, 1600) * np.hanning(ns(0.3)), F(306), 0.2); cue(F(306), "sfx: error buzz on GRANDSON")
room(F(345), F(720), 0.1); tick(F(345), F(720), 0.1)
buzz(F(359), 0.4); popb(F(359), 0.3); cue(F(359), "sfx: classroom clock ticks; phone vibrates")
sent(F(490)); recv(F(547)); sent(F(581)); recv(F(617)); cue(F(490), "sfx: message sent / received")
popb(F(660), 0.3); put(sfx, lp(np.sign(np.sin(2 * np.pi * 110 * tt(0.22))) * 0.4, 1800) * np.hanning(ns(0.22)), F(676), 0.22)
shutter(F(729), 0.45); cue(F(729), "sfx: camera shutter (his selfie)")
room(F(720), F(875), 0.1); popb(F(792), 0.3); sent(F(831), 0.35)
room(F(875), F(1003), 0.09); popb(F(897), 0.35)
for i in range(6): put(sfx, G.clink(R, 1300 + 120 * i, 0.15, 0.6), F(959 + i * 3), 0.2, 0.3 * ((i % 3) - 1))
cue(F(959), "sfx: plates clink down")
outside(F(1003), F(1240), 0.3)
for k in range(8): put(sfx, G.stroll_step(R, 0.5), F(1006) + k * 0.3, 0.25, 0.2)
put(sfx, fades(G.babble(F(1135) - F(1046), R, 180, 1.0), 0.1, 0.4), F(1046), 0.18, -0.2)
for k in range(7): shutter(F(1048) + k * 0.37 + 0.1 * (k % 2), 0.22)
cue(F(1046), "sfx: footsteps; news-crew chatter and camera clicks")
put(sfx, mx(lp(np.sign(np.sin(2 * np.pi * 330 * tt(0.25))) * 0.4, 2400) * np.hanning(ns(0.25)), lp(np.sign(np.sin(2 * np.pi * 415 * tt(0.25))) * 0.4, 2400) * np.hanning(ns(0.25))), F(1100), 0.22, 0.4)
put(sfx, mx(lp(np.sign(np.sin(2 * np.pi * 330 * tt(0.35))) * 0.4, 2400) * np.hanning(ns(0.35)), lp(np.sign(np.sin(2 * np.pi * 415 * tt(0.35))) * 0.4, 2400) * np.hanning(ns(0.35))), F(1100) + 0.4, 0.2, 0.4)
cue(F(1100), "sfx: car horn (no parking)")
flip(F(1188)); popb(F(1188), 0.3); flip(F(1213)); popb(F(1213), 0.3); cue(F(1188), "sfx: calendar pages")
room(F(1240), F(1418), 0.09); popb(F(1300), 0.3); popb(F(1335), 0.35)
put(sfx, fades(G.babble(F(1418) - F(1340), R, 200, 1.1), 0.2, 0.4), F(1340), 0.08, 0.1)
outside(F(1418), F(1556), 0.25); put(sfx, G.crickets(F(1556) - F(1460), R, 2), F(1460), 0.1, 0.3); popb(F(1528), 0.35)
n = ns(DUR - F(1556)); put(sfx, fades(lp(colored(n, R, 1.0), 400) * 0.25, 0.3, 0.6), F(1556), 0.15)
put(sfx, G.crickets(F(1776) - F(1556), R, 3), F(1556), 0.2, 0.3); cue(F(1556), "sfx: night: crickets, room hum")
popb(F(1566), 0.35)
put(sfx, mx(I.glock(m2f(84), 0.5, R, 0.8), I.glock(m2f(91), 0.4, R, 0.8)), F(1652), 0.55, 0.0); cue(F(1652), "sfx: Feeloy chime (phone)")
recv(F(1728), 0.45)
whoosh(F(1776), 0.5, 0.45); cue(F(1776), "sfx: end-card whoosh")

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
