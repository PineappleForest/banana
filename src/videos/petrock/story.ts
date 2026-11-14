// Timeline of "The Perfect Pet" (the 1975 Pet Rock -> Feeloy): shots cut to the ElevenLabs read
// (production-petrock/voice/words.json, hand-fixed), same camera grammar as the Thanksgiving short.
export const FPS = 30;
export const TOTAL = 1860;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world. No windows in den/bar (the
 *  Thanksgiving window z-fought on the pod GPU in a wide shot). */
export const ROOMS = { den: -1500, bar: -1700, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
/** the den's coffee table (local): centre (0, -0.9), top 0.40; the velvet cushion on it, the rock on that at y 0.52 */
export const ROCK_Y = 0.52;
// exterior: a Mexican beach out on the open grass south of the river town (sand + sea laid over it), the sea toward -z
// from z = MZ - 6; the gift shop 30 m east (x = MX + 25..35), its front at z = MZ
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170, SHOP_X = 30;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 126, light: "day" },        // hook: a man got rich selling rocks. As pets. (den, the rock on its cushion)
  { id: 2, a: 126, b: 350, light: "golden" },   // a California bar: friends complain about their pets
  { id: 3, a: 350, b: 436, light: "golden" },   // he jokes: the perfect pet is a rock
  { id: 4, a: 436, b: 502, light: "day" },      // then he actually sold one
  { id: 5, a: 502, b: 614, light: "day" },      // a Mexican beach: smooth stones, a penny each
  { id: 6, a: 614, b: 747, light: "day" },      // insert: the cardboard carrier, straw, air holes
  { id: 7, a: 747, b: 922, light: "day" },      // insert: the training manual: sit, stay, roll over
  { id: 8, a: 922, b: 983, light: "day" },      // price: $3.95
  { id: 9, a: 983, b: 1148, light: "golden" },  // Christmas: a million sold; Rock Bottom Productions (plaque at 1060)
  { id: 10, a: 1148, b: 1212, light: "day" },   // luckily: a millionaire
  { id: 11, a: 1212, b: 1313, light: "day" },   // unluckily: by February, on sale
  { id: 12, a: 1313, b: 1415, light: "day" },   // a million people paid for a friend who can't do anything
  { id: 13, a: 1415, b: 1624, light: "night" }, // the lonely flat: something that's yours; never says good morning
  { id: 14, a: 1624, b: TOTAL, light: "night" },// Feeloy: Jenny on the phone -> end card
];
export const XFADE: Record<number, number> = { 2: 8, 5: 8, 9: 8, 11: 8, 13: 10 };
export const FLASH_AT = 126;
export const CARD_AT = 1792;
/** phone / manual / carrier inserts */
export const INSERTS: [number, number][] = [[614, 747], [747, 922], [1652, CARD_AT]];

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

const E = (x: number, y: number, z: number): V3 => [MX + x, D0 + y, MZ + z];
const Dn = (x: number, y: number, z: number) => R("den", x, y, z);
const Br = (x: number, y: number, z: number) => R("bar", x, y, z);
const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
/** phone insert: the lens aims 0.5 m ahead toward the subject (the lens focuses on the look point, so the phone card
 *  0.45 m ahead is sharp and the room behind melts); a slow creep forward keeps the hold alive */
const ins = (pos: V3, target: V3, f: number, f0: number): Shot => {
  const d = target.map((v, i) => v - pos[i]), l = Math.hypot(...d), u = d.map((v) => v / l), c = 0.0008 * Math.max(0, f - f0);
  const p = pos.map((v, i) => v + u[i] * c) as V3;
  return { pos: p, look: p.map((v, i) => v + u[i] * 0.5) as V3, fov: 40 };
};
const S1a = (f: number) => dolly(Dn(0.6, 1.1, 1.5), Dn(-0.25, 0.9, -1.0), pushK(f, 0, 0.0018, 0.006, 30), { fov: 48, roll: 0.02 });
const S2a = (f: number) => dolly(Br(0.3, 1.45, 3.7), Br(0.0, 1.12, -0.7), pushK(f, 122, 0.0016), { fov: 44, roll: -0.015 });
const S2b = (f: number) => dolly(Br(-0.1, 1.45, 2.6), Br(0.0, 1.25, -0.6), pushK(f, 286, 0.0018, 0.006, 30), { fov: 46, roll: 0.02 });
const S3a = (f: number) => dolly(Br(0.2, 1.5, 2.1), Br(0.1, 1.4, -0.65), pushK(f, 346, 0.0022, 0.007, 30), { fov: 44, roll: -0.02 });
const S4a = (f: number) => dolly(Dn(0.1, 1.4, 1.9), Dn(-0.25, 1.05, -1.1), pushK(f, 432, 0.002, 0.006, 30), { fov: 46, roll: 0.02 });
const S5a = (f: number) => dolly(E(1.4, 1.55, 6.8), E(0.1, 1.05, 0.6), pushK(f, 498, 0.0018), { fov: 48, roll: -0.015 });
const S6a = (f: number) => ins(Dn(0.25, 1.05, 0.7), Dn(0.0, 0.5, -0.9), f, 614);
const S7a = (f: number) => ins(Dn(-0.3, 1.1, 0.6), Dn(0.0, 0.5, -0.9), f, 747);
const S8a = (f: number) => dolly(Dn(0.2, 0.8, 0.0), Dn(0.0, 0.55, -0.9), pushK(f, 918, 0.0025, 0.008, 30), { fov: 40, roll: 0.02 });
const S9a = (f: number) => dolly(E(SHOP_X + 0.3, 1.7, 10.0), E(SHOP_X, 1.9, 0.0), pushK(f, 979, 0.0016), { fov: 50, roll: 0.015 });
const S9b = (f: number) => dolly(Dn(0.5, 1.5, 0.9), Dn(0.95, 1.4, -2.2), pushK(f, 1060, 0.002, 0.006, 30), { fov: 44, roll: -0.02 });
const S10a = (f: number) => dolly(Dn(-0.1, 1.5, 1.9), Dn(-0.6, 1.3, -1.3), pushK(f, 1144, 0.0022, 0.007, 30), { fov: 46, roll: 0.02 });
const S11a = (f: number) => dolly(E(SHOP_X - 0.6, 1.6, 9.0), E(SHOP_X + 0.1, 1.7, 0.6), pushK(f, 1208, 0.0016, 0.006, 30), { fov: 50, roll: -0.015 });
const S12a = (f: number) => dolly(Dn(0.1, 0.85, 0.5), Dn(0.0, 0.55, -0.9), pushK(f, 1309, 0.0022), { fov: 40 });
const S13a = (f: number) => dolly(Hn(0.9, 1.5, 2.4), Hn(-0.1, 1.0, -1.7), pushK(f, 1411, 0.0018), { fov: 46 });
const S13b = (f: number) => dolly(Hn(0.95, 0.95, -0.85), Hn(0.5, 0.74, -1.95), pushK(f, 1503, 0.0016), { fov: 40, roll: 0.015 });
const S14a = (f: number) => dolly(Hn(0.5, 1.35, 0.9), Hn(-0.3, 1.0, -1.7), pushK(f, 1620, 0.002), { fov: 44 });
const S14b = (f: number) => dolly(Hn(-0.38, 1.1, -0.45), Hn(-0.42, 1.02, -0.95), pushK(f, 1652, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 122, s: S2a }, { f: 286, cut: true, s: S2b }], 3: [{ f: 346, s: S3a }], 4: [{ f: 432, s: S4a }],
  5: [{ f: 498, s: S5a }], 6: [{ f: 614, s: S6a }], 7: [{ f: 747, s: S7a }], 8: [{ f: 918, s: S8a }],
  9: [{ f: 979, s: S9a }, { f: 1060, cut: true, s: S9b }], 10: [{ f: 1144, s: S10a }], 11: [{ f: 1208, s: S11a }], 12: [{ f: 1309, s: S12a }],
  13: [{ f: 1411, s: S13a }, { f: 1503, cut: true, s: S13b }], 14: [{ f: 1620, s: S14a }, { f: 1652, cut: true, s: S14b }],
};

// impact kicks: as PETS, a ROCK, SOLD, ROLL over, a MILLION, SALE
const KICKS: [number, number][] = [[99 / FPS, 0.5], [413 / FPS, 0.4], [470 / FPS, 0.4], [862 / FPS, 0.3], [1019 / FPS, 0.4], [1291 / FPS, 0.5]];
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
  { f: 0, cInf: 11 }, { f: 126, cInf: 7 }, { f: 286, cInf: 11 }, { f: 350, cInf: 13 }, { f: 436, cInf: 12 }, { f: 502, cInf: 6 }, { f: 614, cInf: 16 },
  { f: 922, cInf: 15 }, { f: 983, cInf: 5 }, { f: 1060, cInf: 11 }, { f: 1148, cInf: 12 }, { f: 1212, cInf: 7 }, { f: 1313, cInf: 15 },
  { f: 1415, cInf: 9 }, { f: 1503, cInf: 14 }, { f: 1624, cInf: 11 }, { f: 1652, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
