import { MeshWriter, RGBA, Vec3 } from "./Meshes/MeshKit";

/**
 * TamagoCoachEgg - the egg visuals inside the pan: the flat cooking layer (with the readiness
 * colour cue), the rolled log pushed to the pan's FAR side (three thicknesses) and the six slices.
 * Code-authored MeshBuilder geometry (MeshKit), rebuilt when state changes.
 *
 * Owns: RenderMeshVisuals on the authored children EggLayer / EggLog / EggSlices.
 * Expects: `layerObject`, `logObject`, `slicesObject` (authored, named for tests) and `material`.
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
  @hint("Unlit vertex-colour material (vertexBaseColorMaterial)")
  material: Material;
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

  @input("vec4", "{1.0,0.80,0.12,1}")
  @hint("Layer colour when just poured (glossy, bright yellow)")
  @widget(new ColorWidget())
  freshColor: vec4;

  @input("vec4", "{0.98,0.93,0.66,1}")
  @hint("Layer colour when set and ready to roll (paler, matte)")
  @widget(new ColorWidget())
  setColor: vec4;

  @input("vec4", "{0.98,0.86,0.36,1}")
  @hint("Colour of the rolled log and the slices")
  @widget(new ColorWidget())
  logColor: vec4;

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
  @ui.group_end

  private layerRmv: RenderMeshVisual | null = null;
  private logRmv: RenderMeshVisual | null = null;
  private slicesRmv: RenderMeshVisual | null = null;
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
    // Fresh egg reads "glossy" through a brighter top face; the set egg is flatter/matte.
    const topBoost = 1.0;
    const sideTint = 0.78 + 0.1 * t;
    const tint = (n: Vec3) => (n[1] > 0.5 ? topBoost : n[1] < -0.5 ? 0.6 : sideTint);
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
      tint,
    );
    w.commit(this.layerRmv, this.material);
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
    this.cylinderX(w, -this.logLengthCm / 2, this.logLengthCm / 2, radius, this.logAxisZ(radius), radius, 24);
    w.commit(this.logRmv, this.material);
  }

  private buildSlices(): void {
    if (!this.slicesRmv) return;
    const r = this.radiusForRolls(3);
    const n = Math.max(1, Math.round(this.sliceCount));
    const sliceLen = (this.logLengthCm - (n - 1) * this.sliceGapCm) / n;
    const w = new MeshWriter();
    for (let i = 0; i < n; i++) {
      const x0 = -this.logLengthCm / 2 + i * (sliceLen + this.sliceGapCm);
      this.cylinderX(w, x0, x0 + sliceLen, r, this.logAxisZ(r), r, 20);
    }
    w.commit(this.slicesRmv, this.material);
  }

  /** Cylinder whose axis runs along X from x0 to x1, centred at (cy, cz) in the YZ plane. */
  private cylinderX(w: MeshWriter, x0: number, x1: number, cy: number, cz: number, r: number, sides: number): void {
    const base: RGBA = [this.logColor.x, this.logColor.y, this.logColor.z, 1];
    const shade = (ny: number): RGBA => {
      const k = 0.62 + 0.38 * Math.max(0, ny);
      return [base[0] * k, base[1] * k, base[2] * k, 1];
    };
    const ring0: Vec3[] = [];
    const ring1: Vec3[] = [];
    for (let j = 0; j < sides; j++) {
      const phi = (Math.PI * 2 * j) / sides;
      ring0.push([x0, cy + r * Math.cos(phi), cz + r * Math.sin(phi)]);
      ring1.push([x1, cy + r * Math.cos(phi), cz + r * Math.sin(phi)]);
    }
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      const phiM = (Math.PI * 2 * (j + 0.5)) / sides;
      const n: Vec3 = [0, Math.cos(phiM), Math.sin(phiM)];
      w.face([ring0[j], ring1[j], ring1[k], ring0[k]], n, shade(n[1]));
    }
    w.face(ring0, [-1, 0, 0], shade(0.3));
    w.face(ring1, [1, 0, 0], shade(0.3));
  }
}
