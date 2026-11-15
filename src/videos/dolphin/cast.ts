// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxNope, fxBurst, fxCalendar, fxDolphin, fxSplash2, fxRipple, fxBoat, fxTourSign,
  Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, HX, smooth, clamp01 } from "./story";
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
// ======================= cast of "The Dolphin Who Stayed" =======================
// the dolphin is drawn generically and never named; the people are generic harbour folk
const FISHER: Outfit = { jacket: "#f2c230", pants: "#2f3a5a", boots: "#2b2230", hat: "cap", cap: "#2f3a5a", skin: "#f2c9a0", moustache: "#8a5a34" };
const GUIDE: Outfit = { jacket: "#2f3a5a", pants: "#3a3d47", boots: "#2b2230", hat: "cap", cap: "#f4f1ea", skin: "#f5d6be", collar: "#f4f1ea" };
const TOURIST: Outfit = { jacket: "#e85a8a", pants: "#4a6fa5", boots: "#f4f1ea", hat: "hair", hair: "#c98a3a", ponytail: "#c98a3a", skin: "#f5d6be" };
const BOATMAN: Outfit = { jacket: "#3f7a52", pants: "#4a4d57", boots: "#2b2230", hat: "cap", cap: "#6b5a46", skin: "#f2c9a0", moustache: "#d9d6d2" };
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
const E = (x: number, y: number, z: number): V3 => [HX + x, y, z]; // harbour, water level y = 0
const Q = (x: number, y: number, z: number): V3 => [x, D0 + y, z]; // on the quay deck
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number, fixed = false, glow?: number, soft?: boolean) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: fixed ? [0, 0, 0] : undefined, glow, soft });
const bubble = (out: Stage, icon: BubbleIcon, k: number, at: V3, w = 0.46) => { if (k > 0) card(out, `bub|${icon}|${k}`, 500, 420, (p) => fxBubble(p, icon, k), at, w, w * 0.84); };
const badge = (out: Stage, word: string, colr: string, k: number, at: V3, w = 0.9) => { if (k > 0) card(out, `badge|${word}|${colr}`, 520, 180, (p) => fxBadge(p, word, colr), at, w * k, w * 0.346 * k); };
const strike = (out: Stage, word: string, f: number, f0: number, fs: number, at: V3, w: number) => { const k = pop(f, f0); if (k > 0) { const st = q(clamp01((f - fs) / 8), 16);
  card(out, `nope|${word}|${k}|${st}`, 520, 180, (p) => fxNope(p, word, st), at, w * k, w * 0.346 * k); } };
let camLook: V3 = [0, 0, 0];
const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
/** the dolphin card (2.2 m long) at a point; rot tilts the nose up (+) or down; left = swimming screen-left */
const dolphin = (out: Stage, t: number, at3: V3, rot = 0, happy = 0, left = false, w = 2.2) => {
  const blink = lidAt(t, 7) >= 1 ? 1 : 0;
  out.fx.push({ key: `dol|${happy}|${blink}|${left}`, cw: 600, ch: 300, draw: (p) => { p.g.save(); if (left) { p.g.translate(600, 0); p.g.scale(-1, 1); } fxDolphin(p, happy, blink); p.g.restore(); },
    x: at3[0], y: at3[1], z: at3[2], w, h: w / 2, rot: left ? -rot : rot });
};
/** breaching arcs: the back and fin roll out of the water every `per` frames while drifting from x0 to x1 */
const swim = (out: Stage, t: number, f: number, f0: number, f1: number, x0: number, x1: number, z: number, per = 34, happy = 0, lift = 0, w = 2.2) => {
  const u = clamp01((f - f0) / (f1 - f0)), x = x0 + (x1 - x0) * u, ph = ((f - f0) / per) * Math.PI * 2;
  dolphin(out, t, E(x, -0.42 + lift + (0.4 + lift) * Math.max(0, Math.sin(ph)), z), 0.32 * Math.cos(ph), happy, x1 > x0, w); // +x is screen-left from these lenses
  ripple(out, f, f0 + Math.round(per * 0.05), E(x, 0, z));
};
/** a leap from x0 to x1 between f0 and f1 (peak `hgt` m above the water) with splashes in and out */
const leap = (out: Stage, t: number, f: number, f0: number, f1: number, x0: number, x1: number, z: number, hgt = 1.4, happy = 1) => {
  if (f >= f0 - 2 && f < f0 + 12) splash(out, f, f0 - 2, E(x0, 0, z));
  if (f >= f1 - 2 && f < f1 + 16) splash(out, f, f1 - 2, E(x1, 0, z));
  if (f < f0 || f > f1) return;
  const u = (f - f0) / (f1 - f0), x = x0 + (x1 - x0) * u, y = -0.7 + (hgt + 0.7) * Math.sin(Math.PI * u);
  const slope = (hgt + 0.7) * Math.PI * Math.cos(Math.PI * u) / Math.abs(x1 - x0);
  dolphin(out, t, E(x, y, z), Math.atan(slope) * 0.8, happy, x1 > x0);
};
const splash = (out: Stage, f: number, f0: number, at3: V3) => { const k = q(clamp01((f - f0) / 14), 14); if (k <= 0 || k >= 1) return;
  card(out, `spl|${k}`, 400, 300, (p) => fxSplash2(p, k), [at3[0], 0.45, at3[2] - 0.05], 1.2, 0.9); };
const ripple = (out: Stage, f: number, f0: number, at3: V3) => { const k = q(((f - f0) % 34) / 34, 34);
  out.fx.push({ key: `rip|${k}`, cw: 400, ch: 400, draw: (p) => fxRipple(p, k), x: at3[0], y: 0.03, z: at3[2], w: 2.4, h: 2.4, flat: true }); };
/** a boat card standing in the water (hull in front of whoever stands in it); waterline at 0.786 of the card height */
const boat = (cam: CamInfo, out: Stage, t: number, kind: "fish" | "tour" | "row", x: number, z: number, w: number, oar = 0) => {
  const h = w * 0.42, bob = 0.04 * Math.sin(t * 2.4 + x), at3 = E(x, 0.286 * h + bob, z);
  const dx = cam.pos.x - at3[0], dz = cam.pos.z - at3[2], l = Math.hypot(dx, dz) || 1;
  card(out, `boat|${kind}|${q(oar, 24)}`, 1000, 420, (p) => fxBoat(p, kind, oar), [at3[0] + (dx / l) * 0.18, at3[1], at3[2] + (dz / l) * 0.18], w, h);
  return bob;
};

// 1: 1983: a fin comes into the harbour from the sea
// (the path runs down the lens axis: x = 10k, z = -4.5 + 5.5k, from k = 1.15 to 0.6)
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k = 1.15 - 0.55 * clamp01(f / 125), x = 10 * k, z = -4.5 + 5.5 * k, ph = (f / 26) * Math.PI * 2;
  dolphin(out, t, E(x, -0.3 + 0.52 * Math.max(0, Math.sin(ph)), z), 0.32 * Math.cos(ph), 0, false, 2.6);
  ripple(out, f, 1, E(x, 0, z));
};
// 2: alone
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t); swim(out, t, f, 125, 180, 3.3, 4.6, 1.4, 34, 0, 0.1);
  bubble(out, "dots", pop(f, 150), E(4.2, 1.15, 1.2), 0.4);
};
// 3: and he never left: he peeks up, the calendar pages fly
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), up = smooth((f - 182) / 10);
  dolphin(out, t, E(0, -0.75 + 0.75 * up, 0.3), 1.15 * up, 1, false, 1.5);
  ripple(out, f, 182, E(0.15, 0, 0.3));
  const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], k = pop(f, 190);
  if (k > 0) { const m = M[Math.floor(Math.max(0, f - 192) / 3) % 12]; card(out, `cal|${m}|${k}`, 300, 360, (p) => fxCalendar(p, m), E(-0.62, 1.45, 0.5), 0.46 * k, 0.55 * k); }
};
// 4: every day beside the fishing boats
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = 2.4 - 3.6 * clamp01((f - 228) / 92); // bow to screen-right = toward -x
  const bob = boat(cam, out, t, "fish", x, 2.6, 4.6);
  put(cam, t, out, { o: FISHER, i: 21, at: E(x + 0.75, 0.32 + bob, 2.6), expr: f >= 266 ? "laugh" : "smile", look: 1, shadow: false, swaps: [266 / FPS] });
  leap(out, t, f, 252, 272, -0.2, -1.7, 0.4);
  leap(out, t, f, 286, 306, -0.6, -2.0, 0.4, 1.1);
};
// 5: insert: the tour sign, "or your money back"
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k = q(pop(f, 352), 20);
  out.fx.push({ key: `tsign|${k}`, cw: 560, ch: 400, draw: (p) => fxTourSign(p, k), x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.2, h: 0.143, rot: 0.02, front: true });
};
// 6: he almost always did
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = 1.6 - 0.5 * clamp01((f - 406) / 62), bob = boat(cam, out, t, "tour", x, 3.6, 4.8), wow = f >= 432;
  put(cam, t, out, { o: TOURIST, i: 22, at: E(x - 0.6, 0.3 + bob, 3.6), expr: wow ? "laugh" : "neutral", look: 1, shadow: false, swaps: [432 / FPS] });
  put(cam, t, out, { o: GUIDE, i: 23, at: E(x + 0.9, 0.3 + bob, 3.65), expr: wow ? "grin" : "smile", look: 1, shadow: false });
  leap(out, t, f, 424, 446, 0.0, -1.35, 0.5, 0.9);
};
// 7: for 37 years: he keeps arcing while the years roll
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t); swim(out, t, f, 464, 535, -1.6, 2.2, 1.5, 26, 1);
  const k = pop(f, 472); if (k <= 0) return;
  const yr = f >= 508 ? "37 YEARS" : String(1983 + Math.min(37, Math.max(0, Math.round((f - 474) * 37 / 32))));
  card(out, `yr|${yr}|${k}`, 520, 180, (p) => fxBadge(p, yr, "#3f8fd8"), E(0.3, 2.0, 1.5), 2.1 * k, 0.727 * k);
};
// 8: lockdown emptied the harbour: the empty quay at dusk
const shot8 = (cam: CamInfo, t: number, out: Stage) => { const f = F(t); badge(out, "CLOSED", "#d8433e", pop(f, 560), Q(17.5, 1.55, -33.3), 1.3); };
// 9: one boatman rows out anyway; the dolphin surfaces beside him
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), x = 2.0 - 1.9 * smooth((f - 594) / 52), rowing = f < 646, oar = rowing ? ((f - 594) / 26) % 1 : 0.15;
  const bob = boat(cam, out, t, "row", x, 2.0, 3.4, oar);
  put(cam, t, out, { o: BOATMAN, i: 24, at: E(x - 0.1, -0.2 + bob, 2.0), mode: "sit", seat: 0.3, expr: f >= 654 ? "laugh" : "smile", look: f >= 650 ? 1 : 0, shadow: false, swaps: [654 / FPS] });
  if (f >= 648) { const up = smooth((f - 648) / 9); dolphin(out, t, E(x - 1.15, -0.75 + 0.62 * up, 1.3), 0.95 * up, 1, true, 1.6); }
  if (f >= 646 && f < 662) splash(out, f, 646, E(x - 1.15, 0, 1.3));
  bubble(out, "heart", pop(f, 664), E(x - 0.75, 1.65, 1.6), 0.45);
};
// 10: everyone needs someone who shows up (wide, sunset)
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), bob = boat(cam, out, t, "row", 0.3, 2.0, 3.4, 0.15);
  put(cam, t, out, { o: BOATMAN, i: 24, at: E(0.2, -0.2 + bob, 2.0), mode: "sit", seat: 0.3, expr: "smile", look: 1, shadow: false });
  swim(out, t, f, 696, 760, -1.3, -0.9, 1.3, 30, 1);
  bubble(out, "heart", pop(f, 728), E(-0.5, 1.8, 1.8), 0.6);
};
// 11: the lonely flat; Feeloy; Jenny
const shot11 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: Hn(-0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 772 ? "smile" : "sad", swaps: [772 / FPS] });
  if (f < 786) { bubble(out, "dots", pop(f, 764), Hn(0.2, 1.75, -1.6), 0.42); return; }
  const pose = f >= 810 && f < 836 ? "wave" : f < 852 ? "listen" : "smile";
  const bb = f >= 854 ? q(smooth((f - 854) / 6), 8) : 0;
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
  const SH = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10, shot11];
  SH[id - 1]?.(cam, t, out);
  return out;
};
export { FPS };
