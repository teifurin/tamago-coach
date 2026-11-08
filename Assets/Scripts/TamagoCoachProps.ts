import { MeshWriter, RGBA, Vec2, Vec3, litTint, scaleColor, lerpColor, normalize3 } from "./Meshes/MeshKit";

/**
 * TamagoCoachProps - static dressing on the counter's far-right behind the pan handle: a glazed
 * ceramic bowl with a thin indigo band, a disc of beaten egg lying on its floor, two wooden
 * chopsticks leaning on the rim (thick ends on the counter between the pan and the bowl, tips in
 * the air over the bowl toward the counter's far-right corner) and a soft shadow under the bowl.
 * Pure appearance: code-authored MeshBuilder geometry (MeshKit) built once at awake. Nothing here
 * moves, is interactive or is read by tests.
 *
 * Owns: runtime children BowlShadow / Bowl / BowlEgg / Chopsticks of this (Props) object, one
 *       RenderMeshVisual each. No colliders, no Interactables.
 * Expects: `bowlMaterial` (EggLogPBR, glazed), `chopstickMaterial` (HandleWoodPBR) and optionally
 *          `shadowMaterial` (ShadowSoft). All three use vertex colour as base colour.
 * Must not: touch other objects or hold state.
 *
 * Local frame = StoveSet frame (this object sits at its origin): +X right, +Y up, +Z toward the
 * user, counter top at y = 0. The chopstick pose is solved at awake so that each stick's end cap
 * rests on the counter and its underside touches the rim's outer edge; the pose is then checked
 * against the step card slab, the pan handle, the pan body, the counter edge and the bowl body,
 * shortening the sticks in 0.5 cm steps only if a check fails. Everything is printed for the report.
 */

const BOWL_SEGMENTS = 24;
const STICK_SIDES = 10;
const SHADOW_SEGMENTS = 24;
const RIM_RADIUS_CM = 4.0;
const RIM_TOP_CM = 4.0;
const STICK_END_RADIUS_CM = 0.35;
const STICK_TIP_RADIUS_CM = 0.25;
const STICK_GAP_CM = 1.0;
const DEG = Math.PI / 180;
/** Volumes in the StoveSet frame, used only by the clearance checks printed at awake. */
const HANDLE_MIN: Vec3 = [10.1, 2.0, -1.3];
const HANDLE_MAX: Vec3 = [22.1, 4.0, 1.3];
const CARD_MIN: Vec3 = [-9, 13, -20.5];
const CARD_MAX: Vec3 = [15, 21, -10.7];
const PAN_MIN: Vec3 = [-4.1, 0, -9.6];
const PAN_MAX: Vec3 = [10.1, 3.6, 9.6];
const MIN_HANDLE_CLEARANCE_CM = 2.0;
const MIN_CARD_CLEARANCE_CM = 0.5;
const MIN_PAN_CLEARANCE_CM = 0.5;
/** The tips may overhang the counter edge in the air by up to 1 cm (counter x <= 25, z >= -17.5). */
const TIP_MAX_X_CM = 25.5;
const TIP_MIN_Z_CM = -18;
const MIN_STICK_LENGTH_CM = 6;

/** One point of the bowl's revolution profile: radius, height and which surface it belongs to. */
type ProfilePoint = { r: number; y: number; s: "outer" | "rim" | "inner" };

/** A solved chopstick pose plus the clearance numbers behind its `ok`. */
type StickPose = {
  ok: boolean;
  inc: number;
  start: Vec3;
  tip: Vec3;
  tipTop: number;
  cardClear: number;
  handleClear: number;
  panClear: number;
  bowlClear: number;
};

@component
export class TamagoCoachProps extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachProps – bowl, egg disc, chopsticks (static)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Lit PBR material for the bowl and the egg disc (EggLogPBR, roughness 0.4 = glazed)")
  bowlMaterial: Material;

  @input
  @hint("Lit PBR material for the chopsticks (HandleWoodPBR)")
  chopstickMaterial: Material;

  @input
  @allowUndefined
  @hint("ShadowSoft (unlit vertex colour, no depth write) for the soft shadow under the bowl; none = no shadow")
  shadowMaterial: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec2", "{18,-10}")
  @hint("Bowl centre on the counter (x, z) in cm; the bowl is 8 cm wide and 4 cm tall")
  bowlCenter: vec2;

  @input("vec2", "{11.6,-4.6}")
  @hint("Where the chopsticks' thick ends rest on the counter (x, z), between the pan and the bowl; the sticks aim at the bowl centre and lean on its near-left rim")
  chopstickEnd: vec2;

  @input
  @hint("Chopstick length, cm; shortened in 0.5 cm steps only if the pose cannot clear the card, handle, pan body, counter edge and bowl at this length (printed at awake)")
  @widget(new SliderWidget(6, 24, 0.5))
  chopstickLengthCm: number = 22;

  @input("vec4", "{0.93,0.90,0.85,1}")
  @hint("Ceramic glaze colour")
  @widget(new ColorWidget())
  ceramicColor: vec4;

  @input("vec4", "{0.28,0.36,0.58,1}")
  @hint("Indigo band just below the rim")
  @widget(new ColorWidget())
  bandColor: vec4;

  @input("vec4", "{1.0,0.78,0.12,1}")
  @hint("Beaten-egg disc colour")
  @widget(new ColorWidget())
  eggColor: vec4;

  @input("vec4", "{0.55,0.38,0.22,1}")
  @hint("Chopstick wood colour (same as the pan handle)")
  @widget(new ColorWidget())
  woodColor: vec4;

  @input
  @hint("Opacity at the centre of the bowl's soft shadow (0 = none)")
  @widget(new SliderWidget(0, 0.5, 0.01))
  shadowAlpha: number = 0.18;
  @ui.group_end

  onAwake(): void {
    const cx = this.bowlCenter.x;
    const cz = this.bowlCenter.y;
    // Shadow first: the opaque props are later siblings, so they draw over it where they overlap.
    let shadowVerts = 0;
    if (this.shadowMaterial && this.shadowAlpha > 0) shadowVerts = this.buildShadow(cx, cz);
    const bowlVerts = this.buildBowl(cx, cz);
    const eggVerts = this.buildEggDisc(cx, cz);
    const sticks = this.buildChopsticks(cx, cz);
    print(
      "[TamagoCoachProps] built bowl " + bowlVerts + " verts, egg " + eggVerts + ", chopsticks " + sticks.verts +
        ", shadow " + shadowVerts + "; materials bowl=" + (this.bowlMaterial ? "ok" : "MISSING") +
        " wood=" + (this.chopstickMaterial ? "ok" : "MISSING") + " shadow=" + (this.shadowMaterial ? "ok" : "none"),
    );
    print("[TamagoCoachProps] " + sticks.report);
  }

  private child(name: string): RenderMeshVisual {
    const so = global.scene.createSceneObject(name);
    so.setParent(this.sceneObject);
    return so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, 1];
  }

  // ───────────────────────── bowl ─────────────────────────

  /**
   * Revolution profile (r, y) traversed bottom centre -> foot -> up the outside -> over the rounded
   * rim -> down the inside -> floor centre. Foot 4.5 cm wide, rim 8 cm wide at y 4.0, wall ~0.35 cm,
   * floor at y 0.8 with an inner radius of 3.27 cm at y 1.15 so the 6.2 cm egg disc fits.
   * Points sit exactly on the colour-band edges (outside 3.3-3.7, inside hint 3.55-3.85).
   */
  private bowlProfile(): ProfilePoint[] {
    const o = (r: number, y: number): ProfilePoint => ({ r, y, s: "outer" });
    const t = (r: number, y: number): ProfilePoint => ({ r, y, s: "rim" });
    const i = (r: number, y: number): ProfilePoint => ({ r, y, s: "inner" });
    return [
      o(0, 0), o(2.25, 0), o(2.25, 0.3), o(2.6, 0.5), o(3.2, 0.85), o(3.55, 1.2), o(3.72, 2.0),
      o(3.85, 3.0), o(3.89, 3.3), o(3.95, 3.7), o(4.0, 3.9),
      t(3.95, 3.98), t(3.8, 4.0), t(3.65, 3.98), t(3.6, 3.9),
      i(3.57, 3.85), i(3.53, 3.55), i(3.5, 3.2), i(3.42, 2.4), i(3.33, 1.6), i(3.27, 1.15),
      i(3.15, 0.92), i(2.9, 0.82), i(2.5, 0.8), i(0, 0.8),
    ];
  }

  private buildBowl(cx: number, cz: number): number {
    const ceramic = this.rgba(this.ceramicColor);
    const band = this.rgba(this.bandColor);
    const hint = lerpColor(ceramic, band, 0.45);
    const colorAt = (s: string, midY: number): RGBA => {
      if (s === "outer" && midY >= 3.3 && midY <= 3.7) return band;
      if (s === "inner" && midY >= 3.55 && midY <= 3.85) return hint;
      return ceramic;
    };
    const w = new MeshWriter();
    this.lathe(w, cx, cz, this.bowlProfile(), colorAt);
    w.commit(this.child("Bowl"), this.bowlMaterial);
    return w.vertexCount;
  }

  /**
   * Surface of revolution around the vertical axis through (cx, cz) with smooth per-point normals.
   * The visible side of every profile segment lies to the right of its traversal direction, so the
   * 2D outward normal of a segment (dr, dy) is (dy, -dr). Points on the axis (r = 0) become fans.
   */
  private lathe(w: MeshWriter, cx: number, cz: number, prof: ProfilePoint[], colorAt: (s: string, midY: number) => RGBA): void {
    const n = prof.length;
    const segN: Vec2[] = [];
    for (let i = 0; i + 1 < n; i++) {
      const dr = prof[i + 1].r - prof[i].r;
      const dy = prof[i + 1].y - prof[i].y;
      const l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]);
    }
    const ptN: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? segN[i - 1] : segN[i];
      const b = i + 1 < n ? segN[i] : segN[i - 1];
      const sx = a[0] + b[0];
      const sy = a[1] + b[1];
      const l = Math.hypot(sx, sy) || 1;
      ptN.push([sx / l, sy / l]);
    }
    const P = (p: ProfilePoint, t: number): Vec3 => [cx + p.r * Math.cos(t), p.y, cz + p.r * Math.sin(t)];
    const N = (m: Vec2, t: number): Vec3 => [m[0] * Math.cos(t), m[1], m[0] * Math.sin(t)];
    for (let i = 0; i + 1 < n; i++) {
      const p0 = prof[i];
      const p1 = prof[i + 1];
      const base = colorAt(p0.s, (p0.y + p1.y) / 2);
      const col = (nn: Vec3): RGBA => scaleColor(base, litTint(nn));
      for (let j = 0; j < BOWL_SEGMENTS; j++) {
        const t0 = (Math.PI * 2 * j) / BOWL_SEGMENTS;
        const t1 = (Math.PI * 2 * (j + 1)) / BOWL_SEGMENTS;
        const tm = (t0 + t1) / 2;
        const out = N(segN[i], tm);
        const n00 = N(ptN[i], t0), n01 = N(ptN[i], t1), n10 = N(ptN[i + 1], t0), n11 = N(ptN[i + 1], t1);
        if (p0.r < 1e-4) {
          const nc = N(ptN[i], tm);
          w.tri3([P(p0, tm), P(p1, t0), P(p1, t1)], [nc, n10, n11], [col(nc), col(n10), col(n11)], out);
        } else if (p1.r < 1e-4) {
          const nc = N(ptN[i + 1], tm);
          w.tri3([P(p0, t0), P(p0, t1), P(p1, tm)], [n00, n01, nc], [col(n00), col(n01), col(nc)], out);
        } else {
          w.quad([P(p0, t0), P(p1, t0), P(p1, t1), P(p0, t1)], [n00, n10, n11, n01], [col(n00), col(n10), col(n11), col(n01)], out);
        }
      }
    }
  }

  // ───────────────────────── egg disc ─────────────────────────

  /** Yellow disc, 6.2 cm wide and 0.3 cm thick, lying on the bowl floor (y 0.85 .. 1.15). */
  private buildEggDisc(cx: number, cz: number): number {
    const r = 3.1;
    const y0 = 0.85;
    const y1 = 1.15;
    const base = this.rgba(this.eggColor);
    const w = new MeshWriter();
    const top: Vec3[] = [];
    for (let j = 0; j < BOWL_SEGMENTS; j++) {
      const t = (Math.PI * 2 * j) / BOWL_SEGMENTS;
      top.push([cx + r * Math.cos(t), y1, cz + r * Math.sin(t)]);
    }
    w.face(top, [0, 1, 0], scaleColor(base, litTint([0, 1, 0])));
    const side = scaleColor(base, 0.95);
    for (let j = 0; j < BOWL_SEGMENTS; j++) {
      const t0 = (Math.PI * 2 * j) / BOWL_SEGMENTS;
      const t1 = (Math.PI * 2 * (j + 1)) / BOWL_SEGMENTS;
      const n0: Vec3 = [Math.cos(t0), 0, Math.sin(t0)];
      const n1: Vec3 = [Math.cos(t1), 0, Math.sin(t1)];
      w.quad(
        [[cx + r * n0[0], y0, cz + r * n0[2]], [cx + r * n1[0], y0, cz + r * n1[2]], [cx + r * n1[0], y1, cz + r * n1[2]], [cx + r * n0[0], y1, cz + r * n0[2]]],
        [n0, n1, n1, n0],
        [side, side, side, side],
      );
    }
    w.commit(this.child("BowlEgg"), this.bowlMaterial);
    return w.vertexCount;
  }

  // ───────────────────────── chopsticks ─────────────────────────

  /**
   * Two tapered sticks (0.7 cm thick ends, 0.5 cm tips) 1 cm apart, aimed from `chopstickEnd` at
   * the bowl centre. For each stick the inclination is solved so that the end cap's lowest point
   * rests on the counter (y 0) and the underside touches the rim's outer edge (r 4.0, y 4.0). The
   * pose is then checked against the card slab, the handle, the pan body, the counter edge and the
   * bowl body; only if a check fails is the stick shortened (0.5 cm steps) to the longest length
   * that passes.
   */
  private buildChopsticks(cx: number, cz: number): { verts: number; report: string } {
    const ex = this.chopstickEnd.x;
    const ez = this.chopstickEnd.y;
    let dx = cx - ex;
    let dz = cz - ez;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const px = -dz;
    const pz = dx;
    const wood = this.rgba(this.woodColor);
    const w = new MeshWriter();
    const parts: string[] = [];
    let maxX = cx + RIM_RADIUS_CM;
    let minZ = cz - RIM_RADIUS_CM;
    let maxY = RIM_TOP_CM;
    const names = ["A", "B"];
    const requested = Math.max(MIN_STICK_LENGTH_CM, this.chopstickLengthCm);
    [0.5, -0.5].forEach((side, k) => {
      const off = side * STICK_GAP_CM;
      const e: Vec2 = [ex + px * off, ez + pz * off];
      // Horizontal distance from the lower end to the rim circle along the stick's direction.
      const tcx = cx - e[0];
      const tcz = cz - e[1];
      const proj = tcx * dx + tcz * dz;
      const perp = tcx * px + tcz * pz;
      const d1 = Math.max(0.5, proj - Math.sqrt(Math.max(0, RIM_RADIUS_CM * RIM_RADIUS_CM - perp * perp)));
      let len = requested;
      let pose = this.solveStick(e, dx, dz, d1, len, cx, cz);
      while (!pose.ok && len - 0.5 >= MIN_STICK_LENGTH_CM) {
        len -= 0.5;
        pose = this.solveStick(e, dx, dz, d1, len, cx, cz);
      }
      this.taperedCylinder(w, pose.start, pose.tip, STICK_END_RADIUS_CM, STICK_TIP_RADIUS_CM, wood);
      maxX = Math.max(maxX, pose.start[0] + STICK_END_RADIUS_CM, pose.tip[0] + STICK_TIP_RADIUS_CM);
      minZ = Math.min(minZ, pose.start[2] - STICK_END_RADIUS_CM, pose.tip[2] - STICK_TIP_RADIUS_CM);
      maxY = Math.max(maxY, pose.tipTop);
      parts.push(
        "stick " + names[k] + ": length " + len.toFixed(1) + (len < requested ? " (shortened from " + requested.toFixed(1) + ")" : "") +
          ", incline " + (pose.inc / DEG).toFixed(1) + " deg, end (" + this.v3(pose.start) + "), rim contact " + d1.toFixed(2) +
          " cm along, tip (" + this.v3(pose.tip) + "), tip top y " + pose.tipTop.toFixed(2) +
          "; clearance card " + pose.cardClear.toFixed(2) + ", handle " + pose.handleClear.toFixed(2) + ", pan " + pose.panClear.toFixed(2) +
          ", underside over the bowl >= rim + " + pose.bowlClear.toFixed(2) + (pose.ok ? "" : " [CHECKS NOT MET]"),
      );
    });
    w.commit(this.child("Chopsticks"), this.chopstickMaterial);
    const report =
      parts.join("; ") + "; props extents maxX " + maxX.toFixed(2) + " minZ " + minZ.toFixed(2) + " maxY " + maxY.toFixed(2);
    return { verts: w.vertexCount, report };
  }

  /** Solves one stick's pose for a given length and measures the clearances behind `ok`. */
  private solveStick(e: Vec2, dx: number, dz: number, d1: number, len: number, cx: number, cz: number): StickPose {
    const f = (inc: number): number => {
      const along = d1 / Math.cos(inc);
      const rAt = STICK_END_RADIUS_CM + (STICK_TIP_RADIUS_CM - STICK_END_RADIUS_CM) * Math.min(1, along / len);
      return STICK_END_RADIUS_CM * Math.cos(inc) + d1 * Math.tan(inc) - rAt / Math.cos(inc) - RIM_TOP_CM;
    };
    let lo = 5 * DEG;
    let hi = 80 * DEG;
    for (let it = 0; it < 48; it++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    const inc = (lo + hi) / 2;
    const yEnd = STICK_END_RADIUS_CM * Math.cos(inc);
    const axis: Vec3 = [dx * Math.cos(inc), Math.sin(inc), dz * Math.cos(inc)];
    const start: Vec3 = [e[0], yEnd, e[1]];
    const tip: Vec3 = [start[0] + axis[0] * len, start[1] + axis[1] * len, start[2] + axis[2] * len];
    const tipTop = tip[1] + STICK_TIP_RADIUS_CM * Math.cos(inc);
    let cardClear = Infinity;
    let handleClear = Infinity;
    let panClear = Infinity;
    let bowlClear = Infinity;
    for (let s = 0; s <= 88; s++) {
      const u = s / 88;
      const p: Vec3 = [start[0] + axis[0] * len * u, start[1] + axis[1] * len * u, start[2] + axis[2] * len * u];
      const r = STICK_END_RADIUS_CM + (STICK_TIP_RADIUS_CM - STICK_END_RADIUS_CM) * u;
      cardClear = Math.min(cardClear, this.distanceToBox(p, CARD_MIN, CARD_MAX) - r);
      handleClear = Math.min(handleClear, this.distanceToBox(p, HANDLE_MIN, HANDLE_MAX) - r);
      panClear = Math.min(panClear, this.distanceToBox(p, PAN_MIN, PAN_MAX) - r);
      // Inside the rim circle the stick's underside must stay above the rim top (no cutting into the bowl).
      if (Math.hypot(p[0] - cx, p[2] - cz) < RIM_RADIUS_CM) bowlClear = Math.min(bowlClear, p[1] - r / Math.cos(inc) - RIM_TOP_CM);
    }
    if (bowlClear === Infinity) bowlClear = 0;
    const ok =
      cardClear >= MIN_CARD_CLEARANCE_CM &&
      handleClear >= MIN_HANDLE_CLEARANCE_CM &&
      panClear >= MIN_PAN_CLEARANCE_CM &&
      tip[0] + STICK_TIP_RADIUS_CM <= TIP_MAX_X_CM &&
      tip[2] - STICK_TIP_RADIUS_CM >= TIP_MIN_Z_CM &&
      bowlClear >= -0.01;
    return { ok, inc, start, tip, tipTop, cardClear, handleClear, panClear, bowlClear };
  }

  private v3(p: Vec3): string {
    return p[0].toFixed(2) + ", " + p[1].toFixed(2) + ", " + p[2].toFixed(2);
  }

  private distanceToBox(p: Vec3, min: Vec3, max: Vec3): number {
    let d2 = 0;
    for (let i = 0; i < 3; i++) {
      const d = Math.max(min[i] - p[i], 0, p[i] - max[i]);
      d2 += d * d;
    }
    return Math.sqrt(d2);
  }

  /** Tapered cylinder from `a` (radius ra) to `b` (radius rb) with radial normals and flat end caps. */
  private taperedCylinder(w: MeshWriter, a: Vec3, b: Vec3, ra: number, rb: number, color: RGBA): void {
    const axis = normalize3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let u: Vec3 = [-axis[2], 0, axis[0]];
    if (Math.hypot(u[0], u[2]) < 1e-4) u = [1, 0, 0];
    u = normalize3(u);
    const v: Vec3 = normalize3([
      axis[1] * u[2] - axis[2] * u[1],
      axis[2] * u[0] - axis[0] * u[2],
      axis[0] * u[1] - axis[1] * u[0],
    ]);
    const dir = (phi: number): Vec3 => [
      u[0] * Math.cos(phi) + v[0] * Math.sin(phi),
      u[1] * Math.cos(phi) + v[1] * Math.sin(phi),
      u[2] * Math.cos(phi) + v[2] * Math.sin(phi),
    ];
    const at = (c: Vec3, n: Vec3, r: number): Vec3 => [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r];
    const ringA: Vec3[] = [];
    const ringB: Vec3[] = [];
    for (let j = 0; j < STICK_SIDES; j++) {
      const n0 = dir((Math.PI * 2 * j) / STICK_SIDES);
      const n1 = dir((Math.PI * 2 * (j + 1)) / STICK_SIDES);
      ringA.push(at(a, n0, ra));
      ringB.push(at(b, n0, rb));
      const c0 = scaleColor(color, litTint(n0));
      const c1 = scaleColor(color, litTint(n1));
      w.quad([at(a, n0, ra), at(b, n0, rb), at(b, n1, rb), at(a, n1, ra)], [n0, n0, n1, n1], [c0, c0, c1, c1]);
    }
    const capA: Vec3 = [-axis[0], -axis[1], -axis[2]];
    w.face(ringA, capA, scaleColor(color, litTint(capA)));
    w.face(ringB, axis, scaleColor(color, litTint(axis)));
  }

  // ───────────────────────── shadow ─────────────────────────

  /** Soft black disc (8.2 cm, alpha fading to 0 at the edge) just above the counter under the bowl. */
  private buildShadow(cx: number, cz: number): number {
    const radius = 4.1;
    const y = 0.05;
    const up: Vec3 = [0, 1, 0];
    const a0 = this.shadowAlpha;
    const rings = [
      { k: 0.6, a: a0 },
      { k: 0.8, a: a0 * 0.35 },
      { k: 1, a: 0 },
    ];
    const col = (a: number): RGBA => [0, 0, 0, a];
    const pt = (i: number, k: number): Vec3 => {
      const ang = (Math.PI * 2 * i) / SHADOW_SEGMENTS;
      return [cx + radius * k * Math.cos(ang), y, cz + radius * k * Math.sin(ang)];
    };
    const centre: Vec3 = [cx, y, cz];
    const w = new MeshWriter();
    for (let i = 0; i < SHADOW_SEGMENTS; i++) {
      w.tri3([centre, pt(i, rings[0].k), pt(i + 1, rings[0].k)], [up, up, up], [col(a0), col(rings[0].a), col(rings[0].a)], up);
      for (let r = 0; r + 1 < rings.length; r++) {
        const A = rings[r];
        const B = rings[r + 1];
        w.quad([pt(i, A.k), pt(i + 1, A.k), pt(i + 1, B.k), pt(i, B.k)], [up, up, up, up], [col(A.a), col(A.a), col(B.a), col(B.a)], up);
      }
    }
    w.commit(this.child("BowlShadow"), this.shadowMaterial);
    return w.vertexCount;
  }
}
