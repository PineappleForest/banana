// Timeline of "Can I Still Get a Plate?" (the wrong-number Thanksgiving text -> Feeloy): shots cut to the ElevenLabs read
// (production-thanksgiving/voice/words.json, hand-fixed), same camera grammar as the Pigs / Pasta shorts.
export const FPS = 30;
export const TOTAL = 1840;
export const D0 = 6.0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

/** interior rooms, each far down the valley at its own z; local (x, y, z) -> world */
export const ROOMS = { dining: -1500, klass: -1700, homeN: -1900 } as const;
export type Room = keyof typeof ROOMS;
export const R = (room: Room, x: number, y: number, z: number): V3 => [x, D0 + y, ROOMS[room] + z];
/** dining table (local): x -1.1..1.1, z -2.0..-1.0, top at 0.76; chairs on the back side at z = -2.45 */
export const TABLE_Y = 0.76;
// exterior: an Arizona street out on the open grass south of the river town (desert sand laid over it);
// the house front at z = MZ (x -5..5), its yard toward +z, mesas far behind
export const QUAY_Z = -33.8;
export const MX = 60, MZ = -170;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 196, light: "day" },        // hook: a stranger invited to Thanksgiving. By accident.
  { id: 2, a: 196, b: 345, light: "day" },      // she texts her grandson; he changed his number (phone insert at 280)
  { id: 3, a: 345, b: 470, light: "day" },      // the classroom: the text lands on a 17-year-old
  { id: 4, a: 470, b: 573, light: "day" },      // phone insert: "Who is this?" "Grandma."
  { id: 5, a: 573, b: 650, light: "day" },      // he asks for a picture; her selfie (insert at 612)
  { id: 6, a: 650, b: 720, light: "day" },      // definitely not his grandma
  { id: 7, a: 720, b: 875, light: "day" },      // his selfie back; "Can I still get a plate?" (insert at 828)
  { id: 8, a: 875, b: 1003, light: "day" },     // of course: grandmas feed everyone
  { id: 9, a: 1003, b: 1135, light: "golden" }, // he shows up; news crews; no parking
  { id: 10, a: 1135, b: 1240, light: "golden" },// the next year, and the next
  { id: 11, a: 1240, b: 1330, light: "golden" },// her husband's empty chair; he is at her table
  { id: 12, a: 1330, b: 1418, light: "day" },   // ten Thanksgivings later
  { id: 13, a: 1418, b: 1556, light: "golden" },// one text, the wrong person answered
  { id: 14, a: 1556, b: TOTAL, light: "night" },// a lonely flat; Jenny -> end card
];
export const XFADE: Record<number, number> = { 9: 8, 11: 10, 12: 8, 13: 8, 14: 10 };
export const FLASH_AT = 196;
export const CARD_AT = 1776;
/** phone inserts: frame ranges where the chat phone card fills the lens */
export const INSERTS: [number, number][] = [[280, 345], [470, 573], [612, 650], [828, 875]];

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
const Dn = (x: number, y: number, z: number) => R("dining", x, y, z);
const Cl = (x: number, y: number, z: number) => R("klass", x, y, z);
/** phone insert: the lens aims 0.5 m ahead toward the subject (the lens focuses on the look point, so the phone card
 *  0.45 m ahead is sharp and the room behind melts); a slow creep forward keeps the hold alive */
const ins = (pos: V3, target: V3, f: number, f0: number): Shot => {
  const d = target.map((v, i) => v - pos[i]), l = Math.hypot(...d), u = d.map((v) => v / l), c = 0.0008 * Math.max(0, f - f0);
  const p = pos.map((v, i) => v + u[i] * c) as V3;
  return { pos: p, look: p.map((v, i) => v + u[i] * 0.5) as V3, fov: 40 };
};
const pull = (f: number, f0: number, rate: number) => 1 + rate * Math.max(0, f - f0);
// dining room
const S1a = (f: number) => dolly(Dn(-1.0, 1.6, 2.2), Dn(-0.85, 1.05, -1.6), pushK(f, 0, 0.0016, 0.006, 30), { fov: 52, roll: 0.02 });
const S2a = (f: number) => dolly(Dn(-0.5, 1.5, 1.0), Dn(-1.25, 1.3, -1.5), pushK(f, 192, 0.0018), { fov: 42, roll: -0.02 });
const S2b = (f: number) => ins(Dn(-0.6, 1.45, 0.6), Dn(-1.3, 1.1, -1.5), f, 280);
const S8a = (f: number) => dolly(Dn(-0.4, 1.55, 1.2), Dn(-1.2, 1.25, -1.5), pushK(f, 871, 0.0016, 0.006, 30), { fov: 44, roll: 0.02 });
const S8b = (f: number) => dolly(Dn(-0.95, 1.9, 2.3), Dn(-0.75, 0.95, -1.5), pushK(f, 955, 0.0015, 0.005, 30), { fov: 50 });
const S11a = (f: number) => dolly(Dn(-0.5, 1.65, 1.1), Dn(-0.4, 1.05, -2.3), pushK(f, 1236, 0.0016), { fov: 48, roll: -0.015 });
const S12a = (f: number) => dolly(Dn(0.3, 1.8, 1.9), Dn(0.2, 1.1, -2.2), pushK(f, 1326, 0.0018, 0.005, 30), { fov: 46, roll: 0.02 });
// classroom (board on the back wall, the teen's desk in the middle)
const S3a = (f: number) => dolly(Cl(2.8, 1.75, 2.0), Cl(-0.4, 1.0, -0.6), pushK(f, 341, 0.0018, 0.006, 30), { fov: 46, roll: 0.02 });
const TEEN = (f: number, f0: number, k = 0.002, punch = 0) => dolly(Cl(0.2, 1.3, -2.2), Cl(0.32, 1.0, 0.4), pushK(f, f0, k, punch, 30), { fov: 40 });
const INS = (f: number, f0: number) => ins(Cl(0.15, 1.25, -1.6), Cl(0.32, 0.98, 0.4), f, f0);
const S4a = (f: number) => INS(f, 466);
const S5b = (f: number) => INS(f, 612);
const S7b = (f: number) => INS(f, 828);
const S5a = (f: number) => TEEN(f, 569, 0.002);
const S6a = (f: number) => dolly(Cl(0.3, 1.25, -1.9), Cl(0.32, 1.2, 0.4), pushK(f, 646, 0.0025, 0.008, 30), { fov: 40, roll: -0.03 });
const S7a = (f: number) => dolly(Cl(-0.3, 1.3, -2.1), Cl(0.3, 1.0, 0.4), pushK(f, 716, 0.002), { fov: 42, roll: 0.02 });
// the Arizona street
const S9a = (f: number) => dolly(E(1.5, 1.8, 13.0), E(-0.5, 1.3, 4.0), pushK(f, 999, 0.0015), { fov: 56, roll: 0.015 });
const S9b = (f: number) => dolly(E(1.2, 1.8, 9.5), E(2.8, 1.6, 4.6), pushK(f, 1092, 0.0022, 0.006, 30), { fov: 44, roll: -0.02 });
const S10a = (f: number) => dolly(E(0.6, 1.55, 5.2), E(0.0, 1.3, 0.9), pushK(f, 1131, 0.0018), { fov: 44 });
const S13a = (f: number) => dolly(E(4.0, 3.2, 14.0), E(0.0, 2.2, 0.0), pull(f, 1414, 0.0045), { fov: 46, roll: 0.01 });
// 14: the lonely flat at night, then the phone
const S14a = (f: number) => dolly(R("homeN", 0.9, 1.5, 2.4), R("homeN", -0.2, 1.0, -1.7), pushK(f, 1552, 0.0018), { fov: 44 });
const S14b = (f: number) => dolly(R("homeN", -0.38, 1.1, -0.45), R("homeN", -0.42, 1.02, -0.95), pushK(f, 1652, 0.0008), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }], 2: [{ f: 192, s: S2a }, { f: 280, cut: true, s: S2b }], 3: [{ f: 341, s: S3a }], 4: [{ f: 466, s: S4a }],
  5: [{ f: 569, s: S5a }, { f: 612, cut: true, s: S5b }], 6: [{ f: 646, s: S6a }], 7: [{ f: 716, s: S7a }, { f: 828, cut: true, s: S7b }], 8: [{ f: 871, s: S8a }, { f: 955, cut: true, s: S8b }],
  9: [{ f: 999, s: S9a }, { f: 1092, cut: true, s: S9b }], 10: [{ f: 1131, s: S10a }], 11: [{ f: 1236, s: S11a }], 12: [{ f: 1326, s: S12a }],
  13: [{ f: 1414, s: S13a }], 14: [{ f: 1552, s: S14a }, { f: 1652, cut: true, s: S14b }],
};

// impact kicks: by accident, the text lands, NOT grandma, feed everyone, no parking
const KICKS: [number, number][] = [[163 / FPS, 0.6], [361 / FPS, 0.4], [676 / FPS, 0.5], [959 / FPS, 0.4], [1100 / FPS, 0.4]];
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
  { f: 0, cInf: 10 }, { f: 196, cInf: 13 }, { f: 345, cInf: 7 }, { f: 470, cInf: 16 }, { f: 573, cInf: 13 }, { f: 612, cInf: 16 }, { f: 650, cInf: 14 },
  { f: 720, cInf: 13 }, { f: 828, cInf: 16 }, { f: 875, cInf: 12 }, { f: 955, cInf: 9 }, { f: 1003, cInf: 5 }, { f: 1135, cInf: 10 }, { f: 1240, cInf: 11 },
  { f: 1330, cInf: 9 }, { f: 1418, cInf: 0 }, { f: 1556, cInf: 9 }, { f: 1652, cInf: 16 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
