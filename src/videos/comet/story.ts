// Timeline of "Alone in the Dark" (Philae and Rosetta on comet 67P, 2014-2016 -> Feeloy), ~29.6 s: shots cut to
// the ElevenLabs read (production-comet/voice/words.json). Deep space is a star sphere far above the valley (SPACE).
export const FPS = 30;
export const TOTAL = 887;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior: only the lonely flat for the ending */
export const ROOMS = { homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 121, light: "day" },       // hook: 2014, the mothership lets the tiny lander go; it lands on the comet
  { id: 2, a: 121, b: 210, light: "day" },     // it bounces, and vanishes into a dark crack
  { id: 3, a: 210, b: 305, light: "day" },     // seven months later it wakes and calls home
  { id: 4, a: 305, b: 385, light: "day" },     // for 85 seconds (countdown)
  { id: 5, a: 385, b: 418, light: "day" },     // then silence
  { id: 6, a: 418, b: 497, light: "day" },     // the mothership searches for two years
  { id: 7, a: 497, b: 545, light: "day" },     // insert: FOUND
  { id: 8, a: 545, b: 669, light: "day" },     // instead of drifting off, it comes down to join it
  { id: 9, a: 669, b: 733, light: "night" },   // nobody should be alone in the dark: the lonely flat
  { id: 10, a: 733, b: TOTAL, light: "night" },// Feeloy; Jenny -> end card
];
/** shots in deep space: no fog, the star sphere is the sky */
export const SPACE_SHOTS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
export const XFADE: Record<number, number> = { 9: 10 };
export const FLASH_AT = 121;
export const CARD_AT = 837;
export const INSERTS: [number, number][] = [[497, 545], [755, CARD_AT]];
/** deep space, far above and beyond the valley: the star sphere (radius 180) is centred here */
export const SPACE: V3 = [0, 420, -2700];
export const S = (x: number, y: number, z: number): V3 => [SPACE[0] + x, SPACE[1] + y, SPACE[2] + z];
/** the comet: a big lobe of radius CR centred CR below S(0,0,0) (its top is local y = 0, kept smooth near the top so
 *  cards can stand on it) and a smaller "head" lobe behind */
export const CR = 25;
export const surfY = (x: number, z: number) => Math.sqrt(Math.max(0, CR * CR - x * x - z * z)) - CR;
/** the dark crack where the lander ends up (between two boulders) */
export const CRACK: [number, number] = [3.9, 1.0];

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });

const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
/** phone insert: the lens aims 0.5 m ahead toward the subject (the lens focuses on the look point, so the phone card
 *  0.45 m ahead is sharp and the room behind melts); a slow creep forward keeps the hold alive */
const ins = (pos: V3, target: V3, f: number, f0: number): Shot => {
  const d = target.map((v, i) => v - pos[i]), l = Math.hypot(...d), u = d.map((v) => v / l), c = 0.0008 * Math.max(0, f - f0);
  const p = pos.map((v, i) => v + u[i] * c) as V3;
  return { pos: p, look: p.map((v, i) => v + u[i] * 0.5) as V3, fov: 40 };
};
const pull = (f: number, f0: number, rate: number) => 1 + rate * Math.max(0, f - f0);
const S1a = (f: number) => dolly(S(2.0, 3.4, 10.5), S(-0.8, 2.8, 0), pushK(f, 0, 0.0022), { fov: 46, roll: -0.012 });
const S2a = (f: number) => dolly(S(1.0, 2.0, 8.0), S(2.2, 1.2, 0.6), pushK(f, 121, 0.0025, 0.007, 30), { fov: 46, roll: 0.015 });
const S3a = (f: number) => dolly(S(3.7, 1.3, 4.6), S(3.85, -0.2, 1.0), pushK(f, 210, 0.002, 0.006, 30), { fov: 44, roll: -0.012 });
const S4a = (f: number) => dolly(S(4.3, 1.4, 4.3), S(3.95, 0.0, 1.0), pushK(f, 305, 0.0024), { fov: 44, roll: 0.012 });
const S5a = (f: number) => dolly(S(3.8, 1.2, 3.8), S(3.9, -0.25, 1.0), pushK(f, 385, 0.003), { fov: 44 });
const S6a = (f: number) => dolly(S(-5.0, 6.5, 19.0), S(0.5, 3.0, 0.0), pushK(f, 418, 0.002), { fov: 48, roll: 0.01 });
const S7a = (f: number) => ins(S(-10, 12, 30), S(-10.2, 12, 28), f, 497);
const S8a = (f: number) => dolly(S(3.8, 4.6, 7.6), S(3.0, -0.1, -0.3), pushK(f, 545, 0.002, 0.005, 30), { fov: 46, roll: 0.012 });
const S9a = (f: number) => dolly(Hn(0.9, 1.5, 2.4), Hn(-0.1, 1.0, -1.7), pushK(f, 669, 0.002), { fov: 46 });
const S10a = (f: number) => dolly(Hn(0.7, 1.35, 1.6), Hn(-0.3, 1.0, -1.7), pushK(f, 733, 0.0025), { fov: 46 });
const S10b = (f: number) => dolly(Hn(-0.38, 1.1, -0.45), Hn(-0.42, 1.02, -0.95), pushK(f, 755, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 121, s: S2a }], 3: [{ f: 210, s: S3a }], 4: [{ f: 305, s: S4a }], 5: [{ f: 385, s: S5a }],
  6: [{ f: 418, s: S6a }], 7: [{ f: 497, s: S7a }], 8: [{ f: 545, s: S8a }], 9: [{ f: 669, s: S9a }],
  10: [{ f: 733, s: S10a }, { f: 755, cut: true, s: S10b }],
};

// impact kicks: the bounce, into the crack, the mothership touching down
const KICKS: [number, number][] = [[125 / FPS, 0.3], [176 / FPS, 0.35], [636 / FPS, 0.3]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, { f: 121, cInf: 6 }, { f: 210, cInf: 12 }, { f: 385, cInf: 13 }, { f: 418, cInf: 0 }, { f: 497, cInf: 0 },
  { f: 545, cInf: 7 }, { f: 669, cInf: 9 }, { f: 755, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
