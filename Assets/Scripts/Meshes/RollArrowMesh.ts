import { MeshWriter, Vec2, Vec3 } from "./MeshKit";

/**
 * RollArrowMesh - the flat roll-cue arrow, built at runtime.
 *
 * Local frame (identity transform is the intended orientation):
 *   lies flat in the local y = 0 plane (thickness centred on y 0),
 *   `arrowLength` cm long along Z, tip pointing toward +Z (toward the user when the
 *   stove set is in front of the camera). Origin = centre of the arrow's bounding box.
 *   Place it at (egg top + 1 cm) above the egg; no rotation needed.
 *
 * Sweep: when `animate` is on, the arrow slides along its local +Z by
 * `sweepDistance` over `sweepSeconds` (ease-out, then restarts) around the
 * position authored in the scene. The base position is captured in onAwake and
 * re-captured each time the object is enabled; it is restored on disable, so
 * toggling the object or moving its parent never drifts it.
 */
@component
export class RollArrowMesh extends BaseScriptComponent {
  @input material: Material;
  // Named arrowLength on purpose: Lens Studio rejects "length" as an @input name.
  @input arrowLength: number = 12;
  @input headLength: number = 4.5;
  @input headWidth: number = 7;
  @input shaftWidth: number = 3;
  @input thickness: number = 0.3;
  @input animate: boolean = true;
  @input sweepDistance: number = 4;
  @input sweepSeconds: number = 1.2;

  private basePos: vec3 | null = null;

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
    const tint = (n: Vec3) => (n[1] > 0.5 ? 1.0 : n[1] < -0.5 ? 0.75 : 0.85);

    const w = new MeshWriter();
    w.prismY(poly, -this.thickness / 2, this.thickness / 2, [1.0, 0.72, 0.1, 1], tint);

    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    w.commit(rmv, this.material);
    print("[RollArrowMesh] built " + w.vertexCount + " verts / " + w.triangleCount + " tris, material=" + (this.material ? "ok" : "MISSING"));

    this.basePos = this.getTransform().getLocalPosition();
    this.createEvent("OnEnableEvent").bind(() => {
      this.basePos = this.getTransform().getLocalPosition();
    });
    this.createEvent("OnDisableEvent").bind(() => {
      if (this.basePos) this.getTransform().setLocalPosition(this.basePos);
    });
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  private onUpdate(): void {
    if (!this.animate || !this.basePos || this.sweepSeconds <= 0) return;
    const phase = (getTime() % this.sweepSeconds) / this.sweepSeconds; // 0..1 sawtooth
    const eased = 1 - (1 - phase) * (1 - phase);                       // ease-out
    const offset = (eased - 0.5) * this.sweepDistance;
    this.getTransform().setLocalPosition(
      new vec3(this.basePos.x, this.basePos.y, this.basePos.z + offset),
    );
  }
}
