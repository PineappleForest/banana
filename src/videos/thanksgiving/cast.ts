// Our cast as lit flat sprites in the 3D world (template: canvas pool, cardShade cards, contact blobs, blinks).
// stage(id, t, cam) says who is where, in which pose and expression, for every shot of the ELIZA -> Feeloy short.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxPhone, fxShadow, fxContact, fxBadge, fxBubble, fxNope, fxBurst, fxChat, ChatMsg, fxFeast, fxVan, fxCalendar,
  Outfit, Expr, FrontOpts, SideOpts, Prop, BubbleIcon } from "./toon";
import { FPS, D0, SHOTS, V3, R, MX, MZ, smooth, clamp01 } from "./story";
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
// ======================= cast of "Can I Still Get a Plate?" =======================
// both real people stay generic: a warm grandmother and a teenage boy, no likeness, no names on screen
const GRANDMA: Outfit = { jacket: "#c9547a", pants: "#4a4d57", boots: "#5a3b2a", dress: "#7b5ac9", hat: "hair", hair: "#e6e2da", glasses: true,
  build: "stout", skin: "#f5d6be", collar: "#f4f1ea" };
const TEEN: Outfit = { jacket: "#e2563f", pants: "#2f3a5a", boots: "#f4f1ea", hat: "hair", hair: "#1e1a1e", skin: "#9a6440" };
const TEACHER: Outfit = { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#8a5a34", glasses: true, skin: "#f5c9a0", collar: "#f4f1ea" };
const REPORTER: Outfit = { jacket: "#d8433e", pants: "#2f3a5a", boots: "#2b2230", hat: "hair", hair: "#e0a35a", longHair: "#e0a35a", skin: "#f5d6be" };
const CAMERAMAN: Outfit = { jacket: "#3a3d47", pants: "#4a4d57", boots: "#2b2230", hat: "cap", cap: "#3d6fd0", skin: "#c99067" };
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
const Dn = (x: number, y: number, z: number) => R("dining", x, y, z);
const Cl = (x: number, y: number, z: number) => R("klass", x, y, z);
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, at: V3, w: number, h: number, fixed = false, glow?: number, soft?: boolean) =>
  out.fx.push({ key, cw, ch, draw, x: at[0], y: at[1], z: at[2], w, h, orient: fixed ? [0, 0, 0] : undefined, glow, soft });
const bubble = (out: Stage, icon: BubbleIcon, k: number, at: V3, w = 0.46) => { if (k > 0) card(out, `bub|${icon}|${k}`, 500, 420, (p) => fxBubble(p, icon, k), at, w, w * 0.84); };
const badge = (out: Stage, word: string, colr: string, k: number, at: V3, w = 0.9) => { if (k > 0) card(out, `badge|${word}|${colr}`, 520, 180, (p) => fxBadge(p, word, colr), at, w * k, w * 0.346 * k); };
const strike = (out: Stage, word: string, f: number, f0: number, fs: number, at: V3, w: number) => { const k = pop(f, f0); if (k > 0) { const st = q(clamp01((f - fs) / 8), 16);
  card(out, `nope|${word}|${k}|${st}`, 520, 180, (p) => fxNope(p, word, st), at, w * k, w * 0.346 * k); } };
let camLook: V3 = [0, 0, 0];
/** the chat phone filling the lens (an insert), 0.45 m in front of the camera */
const chat = (out: Stage, header: string, msgs: ChatMsg[], st = 0) => {
  const m2 = msgs.map((m) => ({ ...m, k: q(m.k, 20) }));
  out.fx.push({ key: `chat|${header}|${q(st, 16)}|${JSON.stringify(m2.map((m) => [m.me, m.text ?? "", m.photo ? okeyOf(m.photo) : "", m.k]))}`, cw: 500, ch: 1000,
    draw: (p) => fxChat(p, header, m2, st), x: camLook[0], y: camLook[1] - 0.005, z: camLook[2], w: 0.139, h: 0.278, rot: 0.025, front: true });
};
const INVITE = "Thanksgiving dinner at my house, Thursday 3 PM!";
/** a plate of food popping in at (x, y, z) */
const feast = (out: Stage, k: number, at: V3, w = 0.34) => { if (k > 0) card(out, `feast|${k}`, 320, 220, (p) => fxFeast(p), at, w * k, w * 0.69 * k); };
const grandmaStand = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) => put(cam, t, out, { o: GRANDMA, i: 11, at: Dn(-1.3, 0, -1.5), expr: "smile", ...a });
const seated = (cam: CamInfo, t: number, out: Stage, o: Outfit, i: number, x: number, a: Partial<Act> = {}) =>
  put(cam, t, out, { o, i, at: Dn(x, 0, -2.45), mode: "sit", seat: 0.5, nudge: 0.15, shadow: false, expr: "smile", ...a });
const teenDesk = (cam: CamInfo, t: number, out: Stage, a: Partial<Act> = {}) =>
  put(cam, t, out, { o: TEEN, i: 12, at: Cl(0.32, 0, 0.4), mode: "sit", seat: 0.5, nudge: 0.05, shadow: false, expr: "neutral", ...a });

// 1: the table is set; a stranger is invited; by accident
const shot1 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  grandmaStand(cam, t, out, { expr: f >= 163 ? "shock" : f >= 40 ? "grin" : "smile", wave: f >= 40 && f < 100 ? wob(t, 2.0) : undefined, swaps: [163 / FPS] });
  bubble(out, "ask", pop(f, 110), Dn(0.6, 1.55, -2.4), 0.36);
};
// 2: she texts her grandson; then the phone: GRANDSON gets crossed out (he changed his number)
const shot2 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 280) {
    grandmaStand(cam, t, out, { prop: ["type", q((f % 10) / 10, 10)], expr: "smile", headTilt: 5 });
    if (f >= 209) { const k = clamp01((f - 209) / 40); bubble(out, "mail", pop(f, 209), Dn(-1.1 + 1.4 * smooth(k), 1.85 + 0.25 * k, -1.4), 0.3); }
    return;
  }
  chat(out, "Grandson", [{ me: true, text: INVITE, k: 1 }], clamp01((f - 304) / 10));
};
// 3: the classroom; the text lands on a 17-year-old in the middle of class
const shot3 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: TEACHER, i: 13, at: Cl(-1.7, 0, -2.85), prop: ["point", 1], facing: -1, look: -1, expr: f >= 421 ? "stern" : "neutral" });
  teenDesk(cam, t, out, { prop: f >= 361 ? "phone" : null, expr: f >= 361 ? "shock" : "dazed", swaps: [361 / FPS], look: f >= 421 ? -1 : 0 });
  bubble(out, "mail", pop(f, 359), Cl(0.6, 1.75, 0.4), 0.36);
};
// 4: the phone: "Who is this?" - "Grandma."
const shot4 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  teenDesk(cam, t, out, { prop: "phone", expr: "nervous" });
  chat(out, "Unknown", [{ me: false, text: INVITE, k: 1 }, { me: true, text: "Who is this?", k: pop(f, 490) }, { me: false, text: "Grandma", k: pop(f, 547) }]);
};
// 5: he asks for a picture; she sends a selfie
const shot5 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 612) {
    teenDesk(cam, t, out, { prop: "phone", expr: "nervous", headTilt: 6 });
    bubble(out, "camera", pop(f, 579), Cl(0.62, 1.38, 0.3), 0.24);
    return;
  }
  chat(out, "Unknown", [{ me: false, text: "Grandma", k: 1 }, { me: true, text: "Pic?", k: 1 }, { me: false, photo: GRANDMA, k: pop(f, 617) }]);
};
// 6: definitely not his grandma
const shot6 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  teenDesk(cam, t, out, { prop: "phone", expr: "stern" });
  strike(out, "GRANDMA", f, 660, 676, Cl(0.32, 1.62, 0.3), 0.5);
};
// 7: his own selfie back; then "Can I still get a plate?"
const shot7 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 828) {
    teenDesk(cam, t, out, { prop: "phone", expr: f >= 727 ? "grin" : "smile", headTilt: f >= 727 && f < 760 ? -6 : 0, swaps: [727 / FPS] });
    if (f >= 729 && f < 745) { const k = q((f - 729) / 16, 16); card(out, `flash|${k}`, 500, 500, (p) => fxBurst(p, k, "#ffffff", 12, 30, 190), Cl(0.55, 1.2, 0.3), 0.4, 0.4); }
    if (f >= 790) bubble(out, "plate", pop(f, 792), Cl(0.65, 1.4, 0.3), 0.3);
    return;
  }
  chat(out, "Unknown", [{ me: false, photo: GRANDMA, k: 1 }, { me: true, photo: TEEN, k: 1 }, { me: true, text: "Can I still get a plate?", k: pop(f, 831) }]);
};
// 8: of course; grandmas feed everyone
const shot8 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 955) {
    grandmaStand(cam, t, out, { expr: f >= 893 ? "laugh" : "smile", swaps: [893 / FPS], headTilt: f >= 893 ? 6 * wob(t, 1.2) : 0 });
    bubble(out, "heart", pop(f, 897), Dn(-0.9, 2.0, -1.4), 0.32);
    return;
  }
  grandmaStand(cam, t, out, { expr: "grin", prop: ["point", 1], facing: 1, look: 1 });
  ([[-0.85, -1.2], [-0.3, -1.15], [0.3, -1.15], [0.85, -1.2], [-0.3, -1.85], [0.3, -1.85]] as [number, number][]).forEach(([x, z], i) => feast(out, pop(f, 959 + i * 3), Dn(x, 0.86, z), 0.3));
};
// 9: he shows up; so do the news crews; no parking
const shot9 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  if (f < 1092) {
    const k = smooth((f - 1003) / 70), x = 1.6 - 1.2 * k, z = 4.6 - 1.0 * k;
    if (f < 1073) putSide(cam, t, out, TEEN, 12, E(x, 0, z), { mode: "march", phase: q(((f - 1003) / 18) % 1, 12), expr: "grin", stomp: 0.3, stride: 0.6 }, true);
    else put(cam, t, out, { o: TEEN, i: 12, at: E(0.4, 0, 3.6), expr: f >= 1048 ? "shock" : "grin", look: 1 });
    if (f >= 1046) {
      card(out, "van", 760, 420, (p) => fxVan(p, 1), E(-2.6, 1.15, 0.9), 3.4, 1.88);
      put(cam, t, out, { o: REPORTER, i: 21, at: E(-0.5, 0, 7.2), prop: "mic", expr: "grin", look: 1 });
      put(cam, t, out, { o: CAMERAMAN, i: 22, at: E(-1.6, 0, 6.2), expr: "neutral", look: 1 });
    }
    return;
  }
  put(cam, t, out, { o: TEEN, i: 12, at: E(2.5, 0, 4.2), expr: f >= 1100 ? "nervous" : "neutral", look: 1, headTilt: 4 * wob(t, 0.8) });
  card(out, "van2", 760, 420, (p) => fxVan(p, 1), E(5.6, 1.15, 3.6), 3.4, 1.88);
  strike(out, "PARKING", f, 1094, 1104, E(3.0, 2.35, 4.4), 1.1);
};
// 10: the next year, and the next
const shot10 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: GRANDMA, i: 11, at: E(-0.45, 0, 0.7), expr: "grin", wave: f >= 1150 && f < 1190 ? wob(t, 2.0) : undefined });
  put(cam, t, out, { o: TEEN, i: 12, at: E(0.6, 0, 1.4), expr: "grin", wave: f >= 1210 && f < 1240 ? wob(t, 2.0) : undefined });
  const yr = f >= 1213 ? "2018" : "2017", f0 = f >= 1213 ? 1213 : 1188, k = pop(f, f0);
  if (k > 0) card(out, `cal|${yr}|${k}`, 300, 360, (p) => fxCalendar(p, yr), E(0.1, 2.38, 1.2), 0.55 * k, 0.66 * k);
};
// 11: her husband's chair is empty; he is at her table
const shot11 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  seated(cam, t, out, GRANDMA, 11, 0.0, { expr: f >= 1294 ? "smile" : "sad", swaps: [1294 / FPS] });
  if (f >= 1292) seated(cam, t, out, TEEN, 12, 0.65, { expr: "smile", headTilt: -6 });
  bubble(out, "heart", pop(f, 1300), Dn(0.3, 1.95, -2.3), 0.28);
};
// 12: ten Thanksgivings later
const shot12 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  seated(cam, t, out, GRANDMA, 11, 0.0, { expr: f >= 1360 ? "laugh" : "grin" });
  seated(cam, t, out, TEEN, 12, 0.6, { expr: f >= 1360 ? "laugh" : "grin" });
  badge(out, "10 YEARS", "#d8433e", pop(f, 1335), Dn(0.3, 2.15, -2.2), 0.9);
};
// 13: the house at sunset; the wrong person answered
const shot13 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: GRANDMA, i: 11, at: E(-0.45, 0, 0.9), expr: "grin" });
  put(cam, t, out, { o: TEEN, i: 12, at: E(0.5, 0, 1.2), expr: "grin" });
  bubble(out, "heart", pop(f, 1528), E(0.05, 4.6, 1.0), 2.4);
};
// 14: a lonely flat at night; then Jenny
const shot14 = (cam: CamInfo, t: number, out: Stage) => {
  const f = F(t);
  put(cam, t, out, { o: LONER, i: 14, at: R("homeN", -0.4, 0, -1.75), mode: "sit", seat: 0.42, prop: "phone", shadow: false, expr: f >= 1626 ? "smile" : "sad", swaps: [1626 / FPS] });
  if (f < 1652) { bubble(out, "dots", pop(f, 1566), R("homeN", 0.2, 1.75, -1.6), 0.42); return; }
  const pose = f >= 1679 && f < 1712 ? "wave" : f < 1726 ? "listen" : "smile";
  const bb = f >= 1728 ? q(smooth((f - 1728) / 6), 8) : 0;
  const blink = lidAt(t, 9) >= 1 ? 1 : 0, wv = pose === "wave" ? wob(t, 2.2) : 0;
  out.fx.push({ key: `phone|${pose}|${blink}|${wv}|${bb}`, cw: 500, ch: 1000, draw: (p) => fxPhone(p, pose, blink, wv, bb, "heart", "11:00"),
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
