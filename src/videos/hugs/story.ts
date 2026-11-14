// Timeline of "Free Hugs" (Sydney, 2004 -> Feeloy), ~32 s: shots cut to the ElevenLabs read
// (production-hugs/voice/words.json, hand-fixed), same camera grammar as the rover short.
export const FPS = 30;
export const TOTAL = 985;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior: only the lonely flat for the ending */
export const ROOMS = { homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
// exterior: a pedestrian city mall out on the open grass south of the river town: shop fronts along z = MZ - 6
// (facing +z), paving from there toward +z; the hugger's spot around (MX, MZ)
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 164, light: "golden" },    // hook: he comes home to Sydney; nobody is waiting
  { id: 2, a: 164, b: 260, light: "day" },     // insert: the cardboard sign, FREE HUGS lettered on
  { id: 3, a: 260, b: 322, light: "day" },     // he stands in a busy city mall
  { id: 4, a: 322, b: 411, light: "day" },     // for days, people just walk past
  { id: 5, a: 411, b: 506, light: "golden" },  // one stranger stops; a hug
  { id: 6, a: 506, b: 570, light: "golden" },  // soon everyone wants one
  { id: 7, a: 570, b: 610, light: "day" },     // the city bans it
  { id: 8, a: 610, b: 718, light: "golden" },  // 10,000 sign a petition; the hugs come back
  { id: 9, a: 718, b: 805, light: "golden" },  // sometimes all we need is someone who stops (wide)
  { id: 10, a: 805, b: TOTAL, light: "night" },// the lonely flat; Jenny -> end card
];
export const XFADE: Record<number, number> = { 5: 10, 9: 10, 10: 10 };
export const FLASH_AT = 164;
export const CARD_AT = 915;
export const INSERTS: [number, number][] = [[164, 260], [858, CARD_AT]];

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
const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
/** phone insert: the lens aims 0.5 m ahead toward the subject (the lens focuses on the look point, so the phone card
 *  0.45 m ahead is sharp and the room behind melts); a slow creep forward keeps the hold alive */
const ins = (pos: V3, target: V3, f: number, f0: number): Shot => {
  const d = target.map((v, i) => v - pos[i]), l = Math.hypot(...d), u = d.map((v) => v / l), c = 0.0008 * Math.max(0, f - f0);
  const p = pos.map((v, i) => v + u[i] * c) as V3;
  return { pos: p, look: p.map((v, i) => v + u[i] * 0.5) as V3, fov: 40 };
};
const pull = (f: number, f0: number, rate: number) => 1 + rate * Math.max(0, f - f0);
const S1a = (f: number) => dolly(E(1.6, 1.5, 7.2), E(0.2, 1.15, 0.6), pushK(f, 0, 0.0018, 0.006, 30), { fov: 46, roll: 0.015 });
const S2a = (f: number) => ins(E(0.3, 1.25, 3.0), E(0.0, 1.0, 0.0), f, 164);
const S3a = (f: number) => dolly(E(-1.4, 1.5, 6.4), E(0.0, 1.2, 0.0), pushK(f, 256, 0.0022, 0.006, 30), { fov: 46, roll: -0.015 });
const S4a = (f: number) => dolly(E(1.2, 1.45, 6.6), E(0.1, 1.15, 0.4), pushK(f, 318, 0.0016), { fov: 48 });
const S5a = (f: number) => dolly(E(0.9, 1.5, 4.8), E(0.35, 1.2, 0.2), pushK(f, 407, 0.0022, 0.007, 30), { fov: 46, roll: 0.02 });
const S6a = (f: number) => dolly(E(-1.0, 1.5, 6.4), E(0.4, 1.15, 0.4), pushK(f, 502, 0.002), { fov: 48, roll: -0.015 });
const S7a = (f: number) => dolly(E(0.55, 1.5, 4.8), E(0.05, 1.25, 0.2), pushK(f, 566, 0.003, 0.008, 30), { fov: 46, roll: 0.02 });
const S8a = (f: number) => dolly(E(-0.6, 1.5, 5.6), E(0.2, 1.3, 0.2), pushK(f, 606, 0.002, 0.006, 30), { fov: 48, roll: -0.015 });
const S9a = (f: number) => dolly(E(2.8, 3.2, 12.0), E(0.3, 1.4, 0.0), pull(f, 714, 0.0035), { fov: 46, roll: 0.01 });
const S10a = (f: number) => dolly(Hn(0.9, 1.5, 2.4), Hn(-0.1, 1.0, -1.7), pushK(f, 801, 0.002), { fov: 46 });
const S10b = (f: number) => dolly(Hn(-0.38, 1.1, -0.45), Hn(-0.42, 1.02, -0.95), pushK(f, 858, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 164, s: S2a }], 3: [{ f: 256, s: S3a }], 4: [{ f: 318, s: S4a }], 5: [{ f: 407, s: S5a }],
  6: [{ f: 502, s: S6a }], 7: [{ f: 566, s: S7a }], 8: [{ f: 606, s: S8a }], 9: [{ f: 714, s: S9a }], 10: [{ f: 801, s: S10a }, { f: 858, cut: true, s: S10b }],
};

// impact kicks: STOPPED, HUGGED, BANNED, back
const KICKS: [number, number][] = [[445 / FPS, 0.3], [476 / FPS, 0.35], [586 / FPS, 0.5], [690 / FPS, 0.3]];
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
  { f: 0, cInf: 7 }, { f: 164, cInf: 16 }, { f: 260, cInf: 8 }, { f: 322, cInf: 6 }, { f: 411, cInf: 11 }, { f: 506, cInf: 8 },
  { f: 570, cInf: 12 }, { f: 610, cInf: 9 }, { f: 718, cInf: 0 }, { f: 805, cInf: 9 }, { f: 858, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
