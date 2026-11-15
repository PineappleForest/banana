// Timeline of "The Dolphin Who Stayed" (Dingle, 1983-2020 -> Feeloy), ~32 s: shots cut to the ElevenLabs read
// (production-dolphin/voice/words.json, hand-fixed). The harbour is the river town itself: the water (y = 0, 6 m
// below the quays) between the painted house rows, staged around x = HX.
export const FPS = 30;
export const TOTAL = 950;
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
  { id: 1, a: 0, b: 125, light: "day" },       // hook: 1983, a wild dolphin's fin comes into the harbour
  { id: 2, a: 125, b: 180, light: "day" },     // alone
  { id: 3, a: 180, b: 232, light: "day" },     // and he never left: he peeks, calendar pages fly
  { id: 4, a: 232, b: 318, light: "day" },     // every day beside the fishing boats: leaps by a trawler
  { id: 5, a: 318, b: 410, light: "day" },     // insert: "money back" tour sign
  { id: 6, a: 410, b: 468, light: "day" },     // he almost always did: a leap by the tour boat
  { id: 7, a: 468, b: 535, light: "day" },     // for 37 years: the year counter rolls while he arcs
  { id: 8, a: 535, b: 598, light: "golden" },  // lockdown emptied the harbour: the empty quay at dusk
  { id: 9, a: 598, b: 700, light: "golden" },  // one boatman rows out; he surfaces beside him
  { id: 10, a: 700, b: 760, light: "golden" }, // everyone needs someone who shows up (wide)
  { id: 11, a: 760, b: TOTAL, light: "night" },// the lonely flat; Feeloy; Jenny -> end card
];
export const XFADE: Record<number, number> = { 8: 10, 11: 10 };
export const FLASH_AT = 180;
export const CARD_AT = 880;
export const INSERTS: [number, number][] = [[318, 410], [786, CARD_AT]];
/** the harbour spot along the river (world x) */
export const HX = 40;

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

const E = (x: number, y: number, z: number): V3 => [HX + x, y, z]; // harbour water level y = 0
const Q = (x: number, y: number, z: number): V3 => [x, D0 + y, z]; // on the quay deck (world x, z)
const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
/** phone insert: the lens aims 0.5 m ahead toward the subject (the lens focuses on the look point, so the phone card
 *  0.45 m ahead is sharp and the room behind melts); a slow creep forward keeps the hold alive */
const ins = (pos: V3, target: V3, f: number, f0: number): Shot => {
  const d = target.map((v, i) => v - pos[i]), l = Math.hypot(...d), u = d.map((v) => v / l), c = 0.0008 * Math.max(0, f - f0);
  const p = pos.map((v, i) => v + u[i] * c) as V3;
  return { pos: p, look: p.map((v, i) => v + u[i] * 0.5) as V3, fov: 40 };
};
const pull = (f: number, f0: number, rate: number) => 1 + rate * Math.max(0, f - f0);
const S1a = (f: number) => dolly(E(0, 1.4, -4.5), E(10, 0.4, 1.0), pushK(f, 0, 0.003), { fov: 46, roll: -0.01 });
const S2a = (f: number) => dolly(E(1.0, 1.2, -5.2), E(4.0, 0.45, 1.4), pushK(f, 121, 0.0025, 0.006, 30), { fov: 46, roll: 0.015 });
const S3a = (f: number) => dolly(E(-0.6, 0.95, -3.8), E(0.0, 0.75, 0.3), pushK(f, 176, 0.0025, 0.007, 30), { fov: 46, roll: -0.015 });
const S4a = (f: number) => dolly(E(-1.5, 1.6, -9.5), E(0.3, 1.0, 1.0), pushK(f, 228, 0.002), { fov: 46, roll: 0.01 });
const S5a = (f: number) => ins(Q(30, 1.5, -35.0), Q(30.2, 1.45, -32.8), f, 318);
const S6a = (f: number) => dolly(E(-1.2, 1.7, -8.6), E(0.2, 1.1, 1.0), pushK(f, 406, 0.0025, 0.006, 30), { fov: 46, roll: -0.015 });
const S7a = (f: number) => dolly(E(-3.0, 2.4, -9.0), E(0.3, 0.7, 1.5), pushK(f, 464, 0.002), { fov: 46, roll: 0.01 });
const S8a = (f: number) => dolly(Q(29, 1.65, -35.4), Q(13, 0.8, -33.4), pushK(f, 531, 0.002), { fov: 46 });
const S9a = (f: number) => dolly(E(-1.8, 1.4, -7.2), E(-0.45, 0.85, 1.0), pushK(f, 594, 0.002, 0.006, 30), { fov: 46, roll: 0.015 });
const S10a = (f: number) => dolly(E(-4.0, 2.6, -11.5), E(0.4, 0.6, 1.2), pull(f, 696, 0.003), { fov: 46, roll: 0.01 });
const S11a = (f: number) => dolly(Hn(0.7, 1.35, 1.6), Hn(-0.3, 1.0, -1.7), pushK(f, 760, 0.0025), { fov: 46 });
const S11b = (f: number) => dolly(Hn(-0.38, 1.1, -0.45), Hn(-0.42, 1.02, -0.95), pushK(f, 786, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 121, s: S2a }], 3: [{ f: 176, s: S3a }], 4: [{ f: 228, s: S4a }], 5: [{ f: 318, s: S5a }],
  6: [{ f: 406, s: S6a }], 7: [{ f: 464, s: S7a }], 8: [{ f: 531, s: S8a }], 9: [{ f: 594, s: S9a }], 10: [{ f: 696, s: S10a }],
  11: [{ f: 760, s: S11a }, { f: 786, cut: true, s: S11b }],
};

// impact kicks: splashes
const KICKS: [number, number][] = [[268 / FPS, 0.2], [436 / FPS, 0.25], [656 / FPS, 0.2]];
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
  { f: 0, cInf: 0 }, { f: 125, cInf: 9 }, { f: 180, cInf: 12 }, { f: 232, cInf: 8 }, { f: 318, cInf: 16 }, { f: 410, cInf: 9 },
  { f: 468, cInf: 0 }, { f: 535, cInf: 6 }, { f: 598, cInf: 9 }, { f: 700, cInf: 0 }, { f: 760, cInf: 9 }, { f: 786, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
