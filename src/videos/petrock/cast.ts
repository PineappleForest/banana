// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxNope, fxBurst, fxCalendar, fxCarrier, fxManual, fxPriceTag, fxPlaque, fxCash, fxBucket, fxBin, fxStamp,
  Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, MX, MZ, SHOP_X, ROCK_Y, smooth, clamp01 } from "./story";
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
// ======================= cast of "The Perfect Pet" =======================
// the inventor stays generic (a 1970s ad man in a rust suit, no likeness, never named)
const ADMAN: Outfit = { jacket: "#b8692f", pants: "#6b4a2f", boots: "#3a2a1e", hat: "hair", hair: "#5a3b2a", moustache: "#5a3b2a", collar: "#f2c94c", skin: "#f5c9a0" };
const PAL1: Outfit = { jacket: "#3f8f6a", pants: "#3b3f52", boots: "#3a2a1e", hat: "hair", hair: "#e0b04a", skin: "#f5d6be", collar: "#f4f1ea" };
const PAL2: Outfit = { jacket: "#7b5ac9", pants: "#2f3a5a", boots: "#2b2230", hat: "cap", cap: "#d8433e", skin: "#9a6440" };
const SHOPPER: Outfit = { jacket: "#d8433e", pants: "#2f3a5a", boots: "#2b2230", hat: "hair", hair: "#2a2230", longHair: "#2a2230", skin: "#c99067" };
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
const E = (x: number, y: number, z: number): V3 => [MX + x, D0 + y, MZ + z];
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number, fixed = false, glow?: number, soft?: boolean) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: fixed ? [0, 0, 0] : undefined, glow, soft });
const bubble = (out: Stage, icon: BubbleIcon, k: number, at: V3, w = 0.46) => { if (k > 0) card(out, `bub|${icon}|${k}`, 500, 420, (p) => fxBubble(p, icon, k), at, w, w * 0.84); };
const badge = (out: Stage, word: string, colr: string, k: number, at: V3, w = 0.9) => { if (k > 0) card(out, `badge|${word}|${colr}`, 520, 180, (p) => fxBadge(p, word, colr), at, w * k, w * 0.346 * k); };
const strike = (out: Stage, word: string, f: number, f0: number, fs: number, at: V3, w: number) => { const k = pop(f, f0); if (k > 0) { const st = q(clamp01((f - fs) / 8), 16);
  card(out, `nope|${word}|${k}|${st}`, 520, 180, (p) => fxNope(p, word, st), at, w * k, w * 0.346 * k); } };
let camLook: V3 = [0, 0, 0];
const Dn = (x: number, y: number, z: number) => R("den", x, y, z);
const Br = (x: number, y: number, z: number) => R("bar", x, y, z);
const Hn = (x: number, y: number, z: number) => R("homeN", x, y, z);
const S = (x: number, y: number, z: number): V3 => [MX + SHOP_X + x, D0 + y, MZ + z];
/** a card standing at the camera's look point, 0.45 m ahead (inserts) */
const front = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, w: number, h: number) =>
  out.fx.push({ key, cw, ch, draw, x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w, h, rot: 0.02, front: true });
const admanDen = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) => put(cam, t, out, { o: ADMAN, i: 11, at: Dn(-0.65, 0, -1.3), expr: "grin", ...a });
const stool = (cam: CamInfo, t: number, out: Stage, o: Outfit, i: number, x: number, a: Partial<Act> = {}) =>
  put(cam, t, out, { o, i, at: Br(x, 0, -0.65), mode: "sit", seat: 0.78, nudge: 0.1, shadow: false, ...a });
const cash = (out: Stage, f: number, f0: number, at3: V3, seed: number, w = 0.34) => { const k = pop(f, f0); if (k > 0) card(out, `cash|${seed}|${k}`, 420, 260, (p) => fxCash(p, seed), at3, w * k, w * 0.62 * k); };

// 1: hook: a man got rich selling rocks. As pets.
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  admanDen(cam, t, out, { prop: ["point", 1], facing: 1, look: 1, expr: f >= 60 ? "laugh" : "grin" });
  cash(out, f, 62, Dn(-0.95, 1.95, -1.25), 0);
  bubble(out, "heart", pop(f, 97), Dn(0.12, 0.9, -0.9), 0.24);
};
// 2: the bar: his friends complain about their pets: the feeding, the mess
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  stool(cam, t, out, PAL1, 12, -0.85, { expr: f >= 228 ? "pained" : "neutral", look: 1, swaps: [228 / FPS] });
  stool(cam, t, out, ADMAN, 11, 0.0, { prop: "mug", expr: f >= 300 ? "smile" : "neutral", look: f >= 230 && f < 300 ? -1 : 1 });
  stool(cam, t, out, PAL2, 13, 0.85, { expr: f >= 232 ? "stern" : "neutral", look: -1, swaps: [232 / FPS] });
  bubble(out, "bowl", pop(f, 296), Br(-0.85, 1.95, -0.55), 0.34);
  bubble(out, "paw", pop(f, 322), Br(0.85, 1.95, -0.55), 0.34);
};
// 3: he jokes: the perfect pet is a rock
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  stool(cam, t, out, ADMAN, 11, 0.0, { prop: "mug", expr: f >= 408 ? "laugh" : "grin", swaps: [408 / FPS] });
  if (f < 411) bubble(out, "bulb", pop(f, 376), Br(0.32, 1.85, -0.55), 0.34);
  else bubble(out, "rock", pop(f, 411), Br(0.32, 1.85, -0.55), 0.38);
};
// 4: then he actually sold one
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  admanDen(cam, t, out, { expr: f >= 468 ? "laugh" : "grin", swaps: [468 / FPS] });
  const k = pop(f, 450); if (k > 0) card(out, "carrierClosed", 600, 560, (p) => fxCarrier(p, 0), Dn(0.05, 0.6, -0.95), 0.4 * k, 0.373 * k);
  if (f >= 468) { const sk = q(clamp01((f - 468) / 6), 12); card(out, `stamp|SOLD|${sk}`, 600, 260, (p) => fxStamp(p, "SOLD", sk), Dn(0.1, 0.95, -0.9), 0.5, 0.217); }
};
// 5: the Mexican beach: smooth stones, a penny each
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: ADMAN, i: 11, at: [MX + 0, D0, MZ + 1.0], expr: f >= 580 ? "laugh" : "grin", look: 1 });
  const k = pop(f, 514); if (k > 0) card(out, "bucket", 360, 360, (p) => fxBucket(p), [MX + 0.6, D0 + 0.3, MZ + 1.3], 0.55 * k, 0.55 * k);
  badge(out, "1¢ EACH", "#c9a04a", pop(f, 581), [MX + 0.25, D0 + 2.2, MZ + 1.0], 1.0);
};
// 6: insert: the cardboard pet carrier, straw, air holes to breathe
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  const open = q(smooth((f - 684) / 12), 40), glow = f >= 700 && f < 724 ? 1 : 0, puff = f >= 718 ? q(((f - 718) % 22) / 22, 22) : 0;
  front(out, `carrier|${open}|${glow}|${puff}`, 600, 560, (p) => fxCarrier(p, open, puff, glow), 0.185, 0.173);
};
// 7: insert: the training manual: sit, stay (easy), roll over (a little help)
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  const page = f >= 852 ? 3 : f >= 808 ? 2 : f >= 791 ? 1 : 0;
  const roll = page === 3 ? q(smooth((f - 860) / 30), 60) : 0, tick = page === 2 && f >= 827 ? q(clamp01((f - 827) / 8), 16) : 0;
  front(out, `manual|${page}|${roll}|${tick}`, 760, 520, (p) => fxManual(p, page, roll, tick), 0.2, 0.137);
};
// 8: price: $3.95
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t), k = pop(f, 942);
  if (k > 0) { const tilt = q(0.35 * Math.exp(-(f - 942) / 14) * Math.sin((f - 942) / 3), 60);
    card(out, `price|${tilt}|${k}`, 360, 300, (p) => fxPriceTag(p, "$3.95", tilt), Dn(0.09, 0.62, -0.8), 0.15 * k, 0.125 * k); }
};
// 9: Christmas: a million sold; then the office plaque: Rock Bottom Productions
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 1060) {
    put(cam, t, out, { o: SHOPPER, i: 21, at: S(1.05, 0, 2.6), expr: "grin", look: -1 });
    card(out, "carrierShop", 600, 560, (p) => fxCarrier(p, 0), S(1.3, 0.8, 2.8), 0.42, 0.392);
    const v = f < 990 ? 1000 : f >= 1019 ? 1000000 : Math.round(1000 * Math.pow(1000, smooth((f - 990) / 29)) / 1000) * 1000;
    const txt = v.toLocaleString("en-US"), k = pop(f, 988);
    if (k > 0) card(out, `count|${txt}|${k}`, 520, 180, (p) => fxBadge(p, txt, "#d8433e"), S(-0.7, 3.1, 1.3), 1.5 * k, 0.519 * k);
    return;
  }
  put(cam, t, out, { o: ADMAN, i: 11, at: Dn(0.42, 0, -2.15), expr: f >= 1100 ? "laugh" : "grin", look: 1 });
  const k = pop(f, 1095); if (k > 0) card(out, "plaque", 680, 300, (p) => fxPlaque(p, "ROCK BOTTOM", "PRODUCTIONS"), Dn(1.12, 1.62, -2.38), 0.92 * k, 0.406 * k, true);
};
// 10: luckily: a millionaire
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  admanDen(cam, t, out, { expr: f >= 1174 ? "laugh" : "grin", swaps: [1174 / FPS] });
  cash(out, f, 1174, Dn(-1.05, 1.9, -1.2), 1); cash(out, f, 1179, Dn(-0.25, 2.05, -1.2), 2); cash(out, f, 1184, Dn(-0.7, 2.25, -1.25), 3);
};
// 11: unluckily: by February, his pets were on sale
const shot11 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: ADMAN, i: 11, at: S(-0.6, 0, 2.3), expr: f >= 1270 ? "sad" : "neutral", look: 1, swaps: [1270 / FPS] });
  const kc = pop(f, 1232); if (kc > 0) card(out, `cal|FEB|${kc}`, 300, 360, (p) => fxCalendar(p, "FEB"), S(-1.0, 2.7, 1.7), 0.6 * kc, 0.72 * kc);
  const kb = pop(f, 1286); if (kb > 0) card(out, `bin|${kb}`, 600, 360, (p) => fxBin(p), S(0.9, 0.45, 1.9), 1.1 * kb, 0.66 * kb);
  badge(out, "SALE", "#d8433e", pop(f, 1288), S(0.75, 2.95, 1.3), 1.4);
};
// 12: a million people paid for a friend who can't do anything
const shot12 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 1371) bubble(out, "ask", pop(f, 1338), Dn(0.14, 0.86, -0.9), 0.2);
  else if (f < 1400) bubble(out, "dots", pop(f, 1371), Dn(0.14, 0.86, -0.9), 0.2);
};
// 13: the lonely flat: something that's yours; it will never say good morning
const shot13 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: Hn(-0.4, 0, -1.75), mode: "sit", seat: 0.42, shadow: false, expr: f >= 1580 ? "smile" : "sad", look: 1 });
  if (f < 1503) { bubble(out, "heart", pop(f, 1485), Hn(0.62, 1.0, -1.95), 0.2); return; }
  const k = pop(f, 1578) * (f > 1601 ? 1 - clamp01((f - 1601) / 10) : 1);
  if (k > 0) bubble(out, "sun", q(k, 20), Hn(0.56, 0.86, -1.92), 0.15);
};
// 14: Feeloy: the phone, Jenny
const shot14 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: Hn(-0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 1640 ? "smile" : "neutral", swaps: [1640 / FPS] });
  if (f < 1652) return;
  const pose = f >= 1677 && f < 1702 ? "wave" : f < 1764 ? "listen" : "smile";
  const bb = f >= 1766 ? q(smooth((f - 1766) / 6), 8) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0;
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, "sun", "7:00"),
    x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.139, h: 0.278, rot: 0.025, front: true });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (cam.quat) { const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quat); camLook = [cam.pos.x + fw.x * 0.45, cam.pos.y + fw.y * 0.45, cam.pos.z + fw.z * 0.45]; }
  const SH = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10, shot11, shot12, shot13, shot14];
  SH[id - 1]?.(cam, t, out);
  return out;
};
export { FPS };
