// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxNope, fxBurst, fxCalendar, fxLander, fxOrbiter, fxSignal, fxBeam, fxFound,
  Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, S, CRACK, surfY, smooth, clamp01 } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null; front = false;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = this.front ? 10 : 0; }
  }
}

export type Stage = { places: Place[]; fx: FxPlace[] };
// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean;
  /** fixed Euler orientation (YXZ) instead of facing the camera; front = drawn last (phone insert) */
  orient?: [number, number, number]; front?: boolean; glow?: number };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3; quat?: THREE.Quaternion };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.3, 0.45] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
// ======================= cast of "Alone in the Dark" =======================
// the two spacecraft are friendly machines with ink-dot eyes (like the rover); no agency logos
const LONER: Outfit = { jacket: "#5a8fc2", pants: "#2f3a5a", boots: "#f4f1ea", hat: "hair", hair: "#2a2230", longHair: "#2a2230", skin: "#c99067" };
const OKEY = new Map<Outfit, string>();
const okeyOf = (o: Outfit) => { let k = OKEY.get(o); if (!k) { k = "o" + OKEY.size; OKEY.set(o, k); } return k; };

const SIT = 0.3;
const F = (t: number) => t * FPS;
const wob = (t: number, hz: number, ph = 0) => q(Math.sin(2 * Math.PI * hz * t + ph), 8);
const pop = (f: number, f0: number) => (f < f0 ? 0 : q(Math.min(1, smooth((f - f0) / 5) * 1.12 - 0.12 * smooth((f - f0 - 5) / 4)), 20));

type Act = { o: Outfit; i: number; at: V3; mode?: FrontOpts["mode"]; expr?: Expr; prop?: Prop; facing?: -1 | 0 | 1; look?: number; wave?: number;
  tilt?: number; headTilt?: number; phase?: number; scale?: number; shadow?: boolean; swaps?: number[]; nudge?: number; mirror?: boolean; seat?: number };
const put = (cam: CamInfo, t: number, out: Stage, a: Act) => {
  const sitting = a.mode === "sit", y = a.at[1] + (sitting ? a.seat ?? SIT : 0), nd = a.nudge ?? (sitting ? 0.45 : 0);
  if (nd) {
    const dx = cam.pos.x - a.at[0], dz = cam.pos.z - a.at[2], l = Math.hypot(dx, dz) || 1;
    a = { ...a, at: [a.at[0] + (dx / l) * nd, a.at[1], a.at[2] + (dz / l) * nd] };
  }
  const blink = lidAt(t, a.i, a.swaps ?? []);
  const fo: FrontOpts = { mode: a.mode ?? "stand", expr: a.expr ?? "neutral", prop: a.prop ?? null, facing: a.facing ?? 0, look: a.look ?? 0, blink,
    wave: a.wave, tilt: a.tilt ?? 0, headTilt: a.headTilt ?? 0, phase: a.phase ?? 0, lift: 30 };
  const pl = person(cam, { i: a.i, o: a.o, okey: okeyOf(a.o) }, a.at[0], y, a.at[2], { side: false, mirror: false }, fo, {}, a.scale ?? 1);
  if (a.mirror) pl.mirror = true;
  out.places.push(pl);
  if (a.shadow !== false) blob(out, a.at[0], a.at[1], a.at[2], (a.scale ?? 1) * (sitting ? 1.1 : 1), sitting ? 0.7 : 1);
};
/** side view (walks): faces screen-right unless `left` */
const putSide = (cam: CamInfo, t: number, out: Stage, o: Outfit, i: number, at: V3, so: SideOpts, left = false, scale = 1) => {
  const pl = person(cam, { i, o, okey: okeyOf(o) }, at[0], at[1], at[2], { side: true, mirror: left }, {}, { ...so, blink: lidAt(t, i) }, scale);
  out.places.push(pl); blob(out, at[0], at[1], at[2], scale);
};
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number, fixed = false, glow?: number, soft?: boolean) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: fixed ? [0, 0, 0] : undefined, glow, soft });
const bubble = (out: Stage, icon: BubbleIcon, k: number, at: V3, w = 0.46) => { if (k > 0) card(out, `bub|${icon}|${k}`, 500, 420, (p) => fxBubble(p, icon, k), at, w, w * 0.84); };
const badge = (out: Stage, word: string, colr: string, k: number, at: V3, w = 0.9) => { if (k > 0) card(out, `badge|${word}|${colr}`, 520, 180, (p) => fxBadge(p, word, colr), at, w * k, w * 0.346 * k); };
const strike = (out: Stage, word: string, f: number, f0: number, fs: number, at: V3, w: number) => { const k = pop(f, f0); if (k > 0) { const st = q(clamp01((f - fs) / 8), 16);
  card(out, `nope|${word}|${k}|${st}`, 520, 180, (p) => fxNope(p, word, st), at, w * k, w * 0.346 * k); } };
let camLook: V3 = [0, 0, 0];
const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
const LW = 1.1, OW = 4.2; // lander card 1.1 m, mothership card 4.2 m wide
/** the lander card standing (its feet at card y 0.96) on the comet at local (x, z), lifted by `up`, tilted by rot */
const lander = (out: Stage, t: number, x: number, z: number, up = 0, rot = 0, open = 1, light = 0, zz = 0, smile = 0) => {
  const blink = open >= 1 && lidAt(t, 5) >= 1 ? 0 : open, k = `${blink}|${light}|${q(zz, 10)}|${smile}`;
  out.fx.push({ key: `lander|${k}`, cw: 500, ch: 500, draw: (p) => fxLander(p, blink, light, q(zz, 10), smile),
    ...xyz(S(x, surfY(x, z) + up + LW * 0.46, z)), w: LW, h: LW, rot });
};
const orbiter = (out: Stage, t: number, at3: V3, rot = 0, open = 1, smile = 0) => {
  const blink = open >= 1 && lidAt(t, 11) >= 1 ? 0 : open;
  out.fx.push({ key: `orb|${blink}|${smile}`, cw: 1000, ch: 420, draw: (p) => fxOrbiter(p, blink, smile), ...xyz(at3), w: OW, h: OW * 0.42, rot });
};
const xyz = (v: V3) => ({ x: v[0], y: v[1], z: v[2] });
/** the lander's spot in the crack (sunk a little, lying on its side) */
const inCrack = (out: Stage, t: number, open: number, light: number, zz: number, smile = 0) =>
  lander(out, t, CRACK[0], CRACK[1], -0.12, 0.55, open, light, zz, smile);

// 1: 2014: the mothership lets the tiny lander go; it drifts down and lands on the comet (on "comet", 94)
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), u = smooth((f - 18) / 76);
  orbiter(out, t, S(-2.4 + 0.3 * u, 6.0 + 0.2 * u, -0.6), -0.05);
  lander(out, t, -1.5 + 1.5 * u, 0, f < 18 ? 5.1 : 5.1 * (1 - u), 0.05 * Math.sin(f / 9), 1, 0, 0, f >= 96 ? 1 : 0);
};
// 2: it bounces (125) ... and vanishes into the dark crack (176)
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 172) { const u = clamp01((f - 123) / 49), x = CRACK[0] * u, z = CRACK[1] * u, h = 2.6 * Math.sin(Math.PI * u);
    lander(out, t, x, z, h, f >= 123 ? 6.3 * u : 0, f >= 125 ? 0.7 : 1, 0); if (f >= 125 && f < 160) bubble(out, "ask", pop(f, 126), S(x + 0.6, surfY(x, z) + h + 1.25, z), 0.42); }
  else if (f < 182) lander(out, t, CRACK[0], CRACK[1], -0.12 * smooth((f - 172) / 6), 0.55 + 0.2 * (1 - smooth((f - 172) / 6)), 0.7, 0);
  else inCrack(out, t, 0, 0, 0);
};
// 3: seven months asleep, then it wakes (254) and calls home (276)
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), awake = f >= 252, calling = f >= 274;
  inCrack(out, t, awake ? 1 : 0, calling && Math.floor(f / 6) % 2 ? 1 : 0, awake ? 0 : clamp01((f - 214) / 10));
  if (calling) { const k = q(((f - 274) / 22) % 1, 22);
    card(out, `sig|${k}`, 500, 500, (p) => fxSignal(p, k), S(CRACK[0] + 0.55, surfY(...CRACK) + 1.0, CRACK[1] + 0.3), 1.1, 1.1, false, 1.6); }
  const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL"], kc = pop(f, 214) * (1 - pop(f, 250));
  if (kc > 0.01) { const m = M[Math.min(6, Math.floor(Math.max(0, f - 216) / 5))]; card(out, `cal|${m}|${q(kc, 10)}`, 300, 360, (p) => fxCalendar(p, m), S(CRACK[0] - 0.55, surfY(...CRACK) + 0.9, CRACK[1] + 0.4), 0.42 * kc, 0.5 * kc); }
};
// 4: for 85 seconds: a countdown while the antenna blinks and the signal flies
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  inCrack(out, t, 1, Math.floor(f / 6) % 2 ? 1 : 0, 0, 1);
  const k = q(((f - 274) / 22) % 1, 22);
  card(out, `sig|${k}`, 500, 500, (p) => fxSignal(p, k), S(CRACK[0] + 0.55, surfY(...CRACK) + 1.0, CRACK[1] + 0.3), 1.1, 1.1, false, 1.6);
  const v = Math.max(0, 85 - Math.round(85 * clamp01((f - 322) / 58))), txt = `${v} SEC`, kb = pop(f, 316);
  if (kb > 0) card(out, `cnt|${txt}|${kb}`, 520, 180, (p) => fxBadge(p, txt, "#3f8fd8"), S(CRACK[0] + 0.12, surfY(...CRACK) + 1.3, CRACK[1] + 0.4), 0.78 * kb, 0.27 * kb);
};
// 5: then, silence: the light goes out, the eyes close
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  inCrack(out, t, f >= 396 ? 0 : 1, 0, 0);
  bubble(out, "dots", pop(f, 400), S(CRACK[0] + 0.35, surfY(...CRACK) + 0.75, CRACK[1] + 0.2), 0.3);
};
// 6: its mothership searches for two years (circles above with a search beam; calendar pages)
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), u = (f - 418) / 79, x = -6 + 12 * u, z = -1.5 + 2.5 * Math.sin(u * Math.PI);
  orbiter(out, t, S(x, 7.5, z), 0.06 * Math.sin(f / 14));
  card(out, "beam", 300, 600, (p) => fxBeam(p), S(x, 4.4, z + 0.05), 2.2, 5.6, false, 1.3, true);
  const M = ["2014", "2015", "2016"], kc = pop(f, 446);
  if (kc > 0) { const m = M[Math.min(2, Math.floor(Math.max(0, f - 448) / 14))]; card(out, `cal|${m}|${kc}`, 300, 360, (p) => fxCalendar(p, m), S(x + 2.6, 8.6, z), 1.2 * kc, 1.44 * kc); }
};
// 7: insert: FOUND (on "found", 519)
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k = f >= 517 ? q(smooth((f - 517) / 5), 10) : 0;
  out.fx.push({ key: `found|${k}`, cw: 600, ch: 800, draw: (p) => fxFound(p, k), x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.19, h: 0.253, rot: 0.02, front: true });
};
// 8: instead of drifting off into space, the mothership comes down to join it (settles ~636, heart on "join")
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), u = smooth((f - 560) / 76), x = 2.1, z = -1.7, y0 = surfY(x, z) + OW * 0.21 - 0.15;
  orbiter(out, t, S(x - 1.5 * (1 - u), y0 + 6.5 * (1 - u), z), -0.12 * (1 - u), 1, f >= 638 ? 1 : 0);
  lander(out, t, CRACK[0], CRACK[1] + 0.25, 0.22, 0.35, 0, 0, 0, f >= 640 ? 1 : 0); // asleep, a little higher so it reads
  bubble(out, "heart", pop(f, 642), S(3.1, surfY(x, z) + 2.2, -0.4), 0.6);
};
// 9: nobody should be alone in the dark: the lonely flat
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: Hn(-0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: "sad", look: 1 });
  bubble(out, "dots", pop(f, 690), Hn(0.2, 1.75, -1.6), 0.42);
};
// 10: Feeloy; Jenny
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: Hn(-0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 740 ? "smile" : "sad", swaps: [740 / FPS] });
  if (f < 755) return;
  const pose = f >= 783 && f < 806 ? "wave" : f < 811 ? "listen" : "smile";
  const bb = f >= 812 ? q(smooth((f - 812) / 6), 8) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0;
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, "heart", "11:30"),
    x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.139, h: 0.278, rot: 0.025, front: true });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (cam.quat) { const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quat); camLook = [cam.pos.x + fw.x * 0.45, cam.pos.y + fw.y * 0.45, cam.pos.z + fw.z * 0.45]; }
  const SH = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10];
  SH[id - 1]?.(cam, t, out);
  return out;
};
export { FPS };
