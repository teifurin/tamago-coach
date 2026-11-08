import { MeshWriter, RGBA, Vec2, Vec3, lerpColor } from "./MeshKit";

/** Ghost copy opacities, nearest-to-the-arrow first (the brief's 0.35 / 0.2 / 0.1). */
const GHOST_ALPHAS = [0.35, 0.2, 0.1];
/** Each ghost sits this much lower than the previous one so the coplanar copies never z-fight. */
const GHOST_DROP_CM = 0.03;

/**
 * RollArrowMesh - the 3D roll-cue arrow, built at runtime, with a sweep-and-trail animation.
 *
 * Local frame (identity transform is the intended orientation): a flat prism `thickness` cm
 * thick centred on local y = 0, `arrowLength` cm long along Z with the tip at +Z (toward the
 * user when the stove set is in front of the camera). Origin = centre of the arrow's bounding
 * box. The colour runs tail (orange) -> head (yellow) in the vertex colours; the material
 * (ArrowGlow: blendMode Normal, baseColor alpha 0.7) is cloned so its alpha can be animated.
 *
 * Animation, restarted every time the object is enabled (TamagoCoachMain enables it per roll
 * cue and disables it on Next):
 *   1. `sweepCount` sweeps: from the authored position (the base) travel +Z by `sweepDistance`
 *      over `sweepSeconds` with an ease-out, with `ghostCount` fading ghost copies (children
 *      sharing the mesh, own material clones at 0.35 / 0.2 / 0.1 alpha) trailing up to
 *      `trailSeconds` behind.
 *   2. Then rest at the near end and pulse gently forever (scale 1 <-> pulseScaleMax, alpha
 *      baseAlpha <-> pulseAlphaMin, at pulseHz).
 * OnDisableEvent restores the base position and scale, so toggling never drifts the arrow.
 */
@component
export class RollArrowMesh extends BaseScriptComponent {
  @input material: Material;
  // Named arrowLength on purpose: Lens Studio rejects "length" as an @input name.
  @input arrowLength: number = 12;
  @input headLength: number = 4.5;
  @input headWidth: number = 7;
  @input shaftWidth: number = 3;
  @input thickness: number = 0.8;

  @input("vec4", "{1.0,0.55,0.10,1}")
  @hint("Vertex colour at the tail (far end)")
  @widget(new ColorWidget())
  tailColor: vec4;

  @input("vec4", "{1.0,0.92,0.35,1}")
  @hint("Vertex colour at the head (tip, toward the user)")
  @widget(new ColorWidget())
  headColor: vec4;

  @input animate: boolean = true;
  @input
  @hint("Travel along local +Z per sweep, cm")
  sweepDistance: number = 8;
  @input
  @hint("Duration of one sweep, seconds (ease-out)")
  sweepSeconds: number = 1.2;
  @input
  @hint("Number of sweeps before the arrow rests at the near end and pulses")
  sweepCount: number = 3;
  @input
  @hint("How far behind the arrow the last ghost trails, seconds")
  trailSeconds: number = 0.4;
  @input
  @hint("Ghost copies in the trail (0..3)")
  ghostCount: number = 3;
  @input
  @hint("Arrow opacity while sweeping and at the top of the pulse")
  baseAlpha: number = 0.7;
  @input
  @hint("Arrow opacity at the bottom of the pulse")
  pulseAlphaMin: number = 0.55;
  @input
  @hint("Peak scale of the resting pulse")
  pulseScaleMax: number = 1.04;
  @input
  @hint("Resting pulse rate, Hz")
  pulseHz: number = 1.5;
  @input
  @hint("Render order of the translucent arrow (after the egg layer); ghosts use the next values")
  drawOrder: number = 2;

  private basePos: vec3 | null = null;
  private mat: Material | null = null;
  private ghosts: { obj: SceneObject; mat: Material | null; lag: number }[] = [];
  private elapsed = 0;

  onAwake(): void {
    const hl = this.arrowLength / 2;
    const hs = this.shaftWidth / 2;
    const hh = this.headWidth / 2;
    const zHead = hl - this.headLength;
    // (u, v) = (x, z). Tip at +Z, tail at -Z.
    const poly: Vec2[] = [
      [0, hl],
      [-hh, zHead],
      [-hs, zHead],
      [-hs, -hl],
      [hs, -hl],
      [hs, zHead],
      [hh, zHead],
    ];
    const tail = this.rgba(this.tailColor);
    const head = this.rgba(this.headColor);
    const colorAt = (u: number, v: number): RGBA => lerpColor(tail, head, Math.max(0, Math.min(1, (v + hl) / (2 * hl))));
    const tint = (n: Vec3) => (n[1] > 0.5 ? 1.0 : n[1] < -0.5 ? 0.85 : 0.92);

    const w = new MeshWriter();
    w.prismYShaded(poly, -this.thickness / 2, this.thickness / 2, colorAt, tint);

    this.mat = this.material ? this.material.clone() : null;
    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.renderOrder = Math.round(this.drawOrder);
    w.commit(rmv, this.mat);
    this.setAlpha(this.mat, this.baseAlpha);
    print("[RollArrowMesh] built " + w.vertexCount + " verts / " + w.triangleCount + " tris, material=" + (this.material ? "ok" : "MISSING"));

    // Ghost copies: children sharing the mesh, each on its own material clone, hidden until used.
    const n = Math.max(0, Math.min(GHOST_ALPHAS.length, Math.round(this.ghostCount)));
    for (let k = 1; k <= n; k++) {
      const obj = global.scene.createSceneObject("RollArrowGhost" + k);
      obj.setParent(this.sceneObject);
      obj.getTransform().setLocalPosition(new vec3(0, -GHOST_DROP_CM * k, 0));
      const g = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      g.mesh = rmv.mesh;
      g.renderOrder = Math.round(this.drawOrder) + k;
      const gm = this.mat ? this.mat.clone() : null;
      if (gm) {
        gm.mainPass.depthWrite = false;
        g.mainMaterial = gm;
        this.setAlpha(gm, GHOST_ALPHAS[k - 1]);
      }
      obj.enabled = false;
      this.ghosts.push({ obj, mat: gm, lag: (this.trailSeconds * k) / n });
    }

    this.basePos = this.copy(this.getTransform().getLocalPosition());
    this.createEvent("OnEnableEvent").bind(() => {
      this.basePos = this.copy(this.getTransform().getLocalPosition());
      this.elapsed = 0;
      this.apply();
    });
    this.createEvent("OnDisableEvent").bind(() => this.reset());
    this.createEvent("UpdateEvent").bind(() => {
      this.elapsed += getDeltaTime();
      this.apply();
    });
  }

  /** Back to the authored pose: base position, unit scale, base alpha, no ghosts. */
  private reset(): void {
    const tr = this.getTransform();
    if (this.basePos) tr.setLocalPosition(this.copy(this.basePos));
    tr.setLocalScale(new vec3(1, 1, 1));
    this.setAlpha(this.mat, this.baseAlpha);
    for (const g of this.ghosts) if (g.obj.enabled) g.obj.enabled = false;
  }

  private apply(): void {
    if (!this.animate || !this.basePos) return;
    const tr = this.getTransform();
    const b = this.basePos;
    const sweepT = this.sweepSeconds > 0 ? this.sweepSeconds : 1.2;
    const total = Math.max(0, Math.round(this.sweepCount)) * sweepT;
    if (this.elapsed < total) {
      const tc = this.elapsed % sweepT;
      const zArrow = this.sweepDistance * this.easeOut(tc / sweepT);
      tr.setLocalPosition(new vec3(b.x, b.y, b.z + zArrow));
      tr.setLocalScale(new vec3(1, 1, 1));
      this.setAlpha(this.mat, this.baseAlpha);
      for (let k = 0; k < this.ghosts.length; k++) {
        const g = this.ghosts[k];
        const tg = tc - g.lag;
        const show = tg >= 0;
        if (g.obj.enabled !== show) g.obj.enabled = show;
        if (show) {
          // Ghosts are children: their local z is the lag behind the arrow itself.
          g.obj.getTransform().setLocalPosition(new vec3(0, -GHOST_DROP_CM * (k + 1), this.sweepDistance * this.easeOut(tg / sweepT) - zArrow));
        }
      }
    } else {
      for (const g of this.ghosts) if (g.obj.enabled) g.obj.enabled = false;
      const phase = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.pulseHz * (this.elapsed - total)); // 0..1, starts at 0
      const s = 1 + (this.pulseScaleMax - 1) * phase;
      tr.setLocalPosition(new vec3(b.x, b.y, b.z + this.sweepDistance));
      tr.setLocalScale(new vec3(s, s, s));
      this.setAlpha(this.mat, this.baseAlpha + (this.pulseAlphaMin - this.baseAlpha) * phase);
    }
  }

  private easeOut(p: number): number {
    const q = Math.max(0, Math.min(1, p));
    return 1 - (1 - q) * (1 - q);
  }

  private setAlpha(mat: Material | null, a: number): void {
    if (mat) mat.mainPass.baseColor = new vec4(1, 1, 1, a);
  }

  private copy(v: vec3): vec3 {
    return new vec3(v.x, v.y, v.z);
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, c.w];
  }
}
