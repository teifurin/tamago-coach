import { MeshWriter, RGBA, Vec3, litTint, scaleColor } from "./Meshes/MeshKit";

/**
 * TamagoCoachEgg - the egg visuals inside the pan: the flat cooking layer (with the readiness
 * colour / gloss cue), the rolled log pushed to the pan's FAR side (three thicknesses) and the six
 * slices. Code-authored MeshBuilder geometry (MeshKit), rebuilt when state changes.
 *
 * Owns: RenderMeshVisuals on the authored children EggLayer / EggLog / EggSlices, and a runtime
 *       clone of `layerMaterial` whose roughness and alpha follow the readiness
 *       (fresh = glossy, 10 % translucent; set = matte, opaque).
 * Expects: `layerObject`, `logObject`, `slicesObject` (authored, named for tests), `layerMaterial`
 *          (EggLayerPBR, blendMode Normal), `logMaterial` (EggLogPBR) and `material` (fallback).
 * Must not: decide when things show - TamagoCoachMain calls the setters below.
 *
 * Local frame: same as the pan floor - origin = centre of the pan floor's top surface,
 * +X right, +Z toward the user (near rim), -Z the far rim. The log and the slices rest on the
 * floor against the far wall: the log's far side sits at the layer's far edge (z = -8.2 cm with
 * the default knobs, 0.8 cm inside the wall). While a log exists the flat layer covers only the
 * floor in front of it (between the log and the user, with a small gap), never under it.
 */

/** The log never comes closer than this to the pan's far wall, cm. */
const WALL_CLEARANCE_CM = 0.3;
/** Gap between the log's near side and the far edge of the next layer, cm. */
const LOG_LAYER_GAP_CM = 0.3;

@component
export class TamagoCoachEgg extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachEgg – layer, log and slices</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Authored child SceneObject 'EggLayer' (flat cooking layer)")
  layerObject: SceneObject;

  @input
  @hint("Authored child SceneObject 'EggLog' (rolled log)")
  logObject: SceneObject;

  @input
  @hint("Authored child SceneObject 'EggSlices' (six slices at Done)")
  slicesObject: SceneObject;

  @input
  @hint("Fallback vertex-colour material, used for any part without its own material")
  material: Material;

  @input
  @allowUndefined
  @hint("Lit PBR material for the cooking layer (EggLayerPBR, blendMode Normal); cloned at runtime so roughness and alpha can follow readiness")
  layerMaterial: Material;

  @input
  @allowUndefined
  @hint("Lit PBR material for the log and the slices (EggLogPBR, roughness 0.4)")
  logMaterial: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Layer width along X, cm (slightly inside the pan's 13 cm interior)")
  @widget(new SliderWidget(5, 20, 0.1))
  layerWidthCm: number = 12.4;

  @input
  @hint("Layer length along Z, cm (slightly inside the pan's 18 cm interior)")
  @widget(new SliderWidget(5, 25, 0.1))
  layerLengthCm: number = 16.4;

  @input
  @hint("Layer thickness, cm")
  @widget(new SliderWidget(0.1, 2, 0.1))
  layerThicknessCm: number = 0.5;

  @input("vec4", "{1.0,0.78,0.12,1}")
  @hint("Layer colour when just poured (saturated warm yellow, glossy)")
  @widget(new ColorWidget())
  freshColor: vec4;

  @input("vec4", "{0.98,0.92,0.66,1}")
  @hint("Layer colour when set and ready to roll (pale, matte)")
  @widget(new ColorWidget())
  setColor: vec4;

  @input
  @hint("Layer roughness when just poured (glossy)")
  @widget(new SliderWidget(0, 1, 0.01))
  freshRoughness: number = 0.15;

  @input
  @hint("Layer roughness when set (matte)")
  @widget(new SliderWidget(0, 1, 0.01))
  setRoughness: number = 0.8;

  @input
  @hint("Layer opacity when just poured (1 = opaque); set egg is always opaque")
  @widget(new SliderWidget(0.5, 1, 0.01))
  freshAlpha: number = 0.9;

  @input("vec4", "{0.93,0.72,0.22,1}")
  @hint("Colour of the rolled log and the slices (golden, one step darker than the layer)")
  @widget(new ColorWidget())
  logColor: vec4;

  @input
  @hint("Number of slightly darker bands around the log along its length (layered look)")
  @widget(new SliderWidget(0, 6, 1))
  logBands: number = 4;

  @input
  @hint("Width of each darker band along X, cm")
  @widget(new SliderWidget(0.2, 2, 0.1))
  bandWidthCm: number = 0.6;

  @input
  @hint("Band brightness relative to the log colour")
  @widget(new SliderWidget(0.7, 1, 0.01))
  bandTint: number = 0.9;

  @input
  @hint("Brightness of the cut faces (the +-X caps) relative to the log colour")
  @widget(new SliderWidget(1, 1.3, 0.01))
  cutFaceTint: number = 1.08;

  @input
  @hint("Log length along X, cm")
  @widget(new SliderWidget(4, 18, 0.5))
  logLengthCm: number = 11.5;

  @input
  @hint("Log radius after the first roll, cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  logRadius1Cm: number = 1.3;

  @input
  @hint("Log radius after the second roll, cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  logRadius2Cm: number = 1.9;

  @input
  @hint("Log radius after the third roll, cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  logRadius3Cm: number = 2.5;

  @input
  @hint("Pan interior length along Z, cm (keeps the log inside the far wall)")
  @widget(new SliderWidget(10, 25, 0.5))
  panInnerLengthCm: number = 18;

  @input
  @hint("Number of slices shown at Done")
  @widget(new SliderWidget(2, 10, 1))
  sliceCount: number = 6;

  @input
  @hint("Gap between slices, cm")
  @widget(new SliderWidget(0, 2, 0.1))
  sliceGapCm: number = 0.4;

  @input
  @hint("Render order of the translucent layer (drawn after the opaque pan, whatever the hierarchy order)")
  @widget(new SliderWidget(0, 10, 1))
  layerRenderOrder: number = 1;
  @ui.group_end

  private layerRmv: RenderMeshVisual | null = null;
  private logRmv: RenderMeshVisual | null = null;
  private slicesRmv: RenderMeshVisual | null = null;
  private layerMat: Material | null = null;
  private readinessStep = -1;
  private rolls = 0;

  onAwake(): void {
    if (!this.layerObject || !this.logObject || !this.slicesObject) {
      print("[TamagoCoachEgg] layerObject/logObject/slicesObject not wired - egg visuals disabled.");
      return;
    }
    this.layerRmv = this.layerObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    this.logRmv = this.logObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    this.slicesRmv = this.slicesObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    // The layer is translucent while fresh: draw it after the opaque pan (which sits later in
    // the hierarchy) so the pan floor shows through instead of the counter.
    this.layerRmv.renderOrder = Math.round(this.layerRenderOrder);
    const layerSource = this.layerMaterial || this.material;
    this.layerMat = layerSource ? layerSource.clone() : null;
    print("[TamagoCoachEgg] materials layer=" + (this.layerMaterial ? "ok" : "fallback") + " log=" + (this.logMaterial ? "ok" : "fallback") + " base=" + (this.material ? "ok" : "MISSING"));
    this.setReadiness(0);
    this.buildSlices();
    this.layerObject.enabled = false;
    this.logObject.enabled = false;
    this.slicesObject.enabled = false;
  }

  /** Show the flat cooking layer (visible while a layer step runs). */
  showLayer(visible: boolean): void {
    if (this.layerObject) this.layerObject.enabled = visible;
  }

  /** Readiness 0 (just poured, glossy) .. 1 (set, matte). Rebuilt in 5 % steps. */
  setReadiness(t: number): void {
    const clamped = Math.max(0, Math.min(1, t));
    const step = Math.round(clamped * 20);
    if (step === this.readinessStep) return;
    this.readinessStep = step;
    this.buildLayer(step / 20);
  }

  /** Number of completed rolls (0..3); 0 hides the log. The log gets thicker with each roll. */
  setRolls(rolls: number): void {
    this.rolls = Math.max(0, Math.min(3, Math.round(rolls)));
    if (this.logObject) {
      this.logObject.enabled = this.rolls > 0;
      if (this.rolls > 0) this.buildLog(this.radiusForRolls(this.rolls));
    }
    // The layer's footprint depends on the log (it only covers the floor in front of it) and
    // setReadiness() skips rebuilds while the readiness step is unchanged - rebuild it here.
    this.rebuildLayer();
  }

  getRolls(): number {
    return this.rolls;
  }

  /** Current log diameter in cm, 0 when there is no log yet (or it has been sliced). */
  getLogThicknessCm(): number {
    if (this.rolls <= 0 || !this.logObject || !this.logObject.enabled) return 0;
    return 2 * this.radiusForRolls(this.rolls);
  }

  /** Replace the log with six slices (Done) or hide them again. */
  showSlices(visible: boolean): void {
    if (this.slicesObject) this.slicesObject.enabled = visible;
    if (visible && this.logObject) this.logObject.enabled = false;
    if (!visible && this.logObject) this.logObject.enabled = this.rolls > 0;
  }

  private radiusForRolls(rolls: number): number {
    if (rolls >= 3) return this.logRadius3Cm;
    if (rolls === 2) return this.logRadius2Cm;
    return this.logRadius1Cm;
  }

  private buildLayer(t: number): void {
    if (!this.layerRmv) return;
    const f = this.freshColor;
    const s = this.setColor;
    const c: RGBA = [
      f.x + (s.x - f.x) * t,
      f.y + (s.y - f.y) * t,
      f.z + (s.z - f.z) * t,
      1,
    ];
    // Layer 1 (no log yet) covers the whole floor. Once a log sits at the far side, the next
    // layer is poured in front of it: from just past the log's near side to the layer's near edge.
    const zNear = this.layerLengthCm / 2;
    let zFar = -this.layerLengthCm / 2;
    if (this.rolls > 0) {
      zFar = Math.min(this.logNearZ(this.radiusForRolls(this.rolls)) + LOG_LAYER_GAP_CM, zNear - 1);
    }
    const w = new MeshWriter();
    w.box(
      [-this.layerWidthCm / 2, 0, zFar],
      [this.layerWidthCm / 2, this.layerThicknessCm, zNear],
      c,
      litTint,
    );
    w.commit(this.layerRmv, this.layerMat || this.material);
    // Gloss and translucency follow the readiness on the runtime clone (fresh = glossy and
    // slightly see-through, set = matte and opaque). Only meaningful on the PBR layer material.
    if (this.layerMat && this.layerMaterial) {
      const pass = this.layerMat.mainPass;
      pass.roughness = this.freshRoughness + (this.setRoughness - this.freshRoughness) * t;
      pass.baseColor = new vec4(1, 1, 1, this.freshAlpha + (1 - this.freshAlpha) * t);
    }
  }

  /** Rebuild the layer at the current readiness (no-op before the first setReadiness). */
  private rebuildLayer(): void {
    if (this.readinessStep >= 0) this.buildLayer(this.readinessStep / 20);
  }

  /**
   * Z of the log's axis for a given radius: the log's far side sits at the layer's far edge,
   * but never closer than WALL_CLEARANCE_CM to the pan's far wall (default knobs: -8.2 + r).
   */
  private logAxisZ(radius: number): number {
    const farWall = -(this.panInnerLengthCm / 2 - WALL_CLEARANCE_CM);
    return Math.max(farWall, -this.layerLengthCm / 2) + radius;
  }

  /** Z of the log's near side (the side facing the user). */
  private logNearZ(radius: number): number {
    return this.logAxisZ(radius) + radius;
  }

  private buildLog(radius: number): void {
    if (!this.logRmv) return;
    const w = new MeshWriter();
    this.cylinderX(w, -this.logLengthCm / 2, this.logLengthCm / 2, radius, this.logAxisZ(radius), radius, 24, Math.max(0, Math.round(this.logBands)));
    w.commit(this.logRmv, this.logMaterial || this.material);
  }

  private buildSlices(): void {
    if (!this.slicesRmv) return;
    const r = this.radiusForRolls(3);
    const n = Math.max(1, Math.round(this.sliceCount));
    const sliceLen = (this.logLengthCm - (n - 1) * this.sliceGapCm) / n;
    const w = new MeshWriter();
    for (let i = 0; i < n; i++) {
      const x0 = -this.logLengthCm / 2 + i * (sliceLen + this.sliceGapCm);
      this.cylinderX(w, x0, x0 + sliceLen, r, this.logAxisZ(r), r, 20, 0);
    }
    w.commit(this.slicesRmv, this.logMaterial || this.material);
  }

  /**
   * Cylinder whose axis runs along X from x0 to x1, centred at (cy, cz) in the YZ plane, with
   * smooth radial normals, `bands` slightly darker rings along its length and lighter cut faces.
   */
  private cylinderX(w: MeshWriter, x0: number, x1: number, cy: number, cz: number, r: number, sides: number, bands: number): void {
    const base: RGBA = [this.logColor.x, this.logColor.y, this.logColor.z, 1];
    const band = scaleColor(base, this.bandTint);
    const cap = scaleColor(base, this.cutFaceTint);
    const len = x1 - x0;
    const strips: { a: number; b: number; dark: boolean }[] = [];
    const bw = Math.min(this.bandWidthCm, len / (bands * 2 + 1));
    let cursor = x0;
    for (let k = 1; k <= bands; k++) {
      const centre = x0 + (len * k) / (bands + 1);
      strips.push({ a: cursor, b: centre - bw / 2, dark: false });
      strips.push({ a: centre - bw / 2, b: centre + bw / 2, dark: true });
      cursor = centre + bw / 2;
    }
    strips.push({ a: cursor, b: x1, dark: false });
    const P = (x: number, n: Vec3): Vec3 => [x, cy + r * n[1], cz + r * n[2]];
    for (const s of strips) {
      const c = s.dark ? band : base;
      for (let j = 0; j < sides; j++) {
        const phi0 = (Math.PI * 2 * j) / sides;
        const phi1 = (Math.PI * 2 * (j + 1)) / sides;
        const n0: Vec3 = [0, Math.cos(phi0), Math.sin(phi0)];
        const n1: Vec3 = [0, Math.cos(phi1), Math.sin(phi1)];
        w.quad([P(s.a, n0), P(s.b, n0), P(s.b, n1), P(s.a, n1)], [n0, n0, n1, n1], [c, c, c, c]);
      }
    }
    const ring = (x: number): Vec3[] => {
      const pts: Vec3[] = [];
      for (let j = 0; j < sides; j++) {
        const phi = (Math.PI * 2 * j) / sides;
        pts.push([x, cy + r * Math.cos(phi), cz + r * Math.sin(phi)]);
      }
      return pts;
    };
    w.face(ring(x0), [-1, 0, 0], cap);
    w.face(ring(x1), [1, 0, 0], cap);
  }
}
