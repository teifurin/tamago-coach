import { MeshWriter, RGBA, Vec3, defaultTint } from "./MeshKit";

/**
 * TamagoPanMesh - a plain rectangular tamagoyaki pan built from boxes at runtime.
 *
 * Local frame (identity transform is the intended orientation):
 *   +X = right (handle side), +Y = up, +Z = toward the user (near rim), -Z = far rim.
 * Origin = centre of the interior floor's TOP surface:
 *   floor top y = 0, rim top y = depth (3), floor bottom y = -floorThickness.
 * Interior cavity: innerWidth (X) by innerLength (Z), i.e. x in [-6.5, 6.5], z in [-9, 9].
 * Outer footprint at the rim: x in [-7.6, 7.6], z in [-9.6, 9.6] (walls 0.8 + rim overhang 0.3).
 * Handle: along +X from the rim's outer edge, handleLength long, centred on z = 0,
 *   top flush with the rim (y in [depth - handleThickness, depth]).
 *
 * Colours are baked per face (unlit vertex-colour material): medium grey body,
 * light rim band, slightly darker interior floor. Nothing is black or near-black.
 */
@component
export class TamagoPanMesh extends BaseScriptComponent {
  @input material: Material;
  @input innerWidth: number = 13;
  @input innerLength: number = 18;
  @input depth: number = 3;
  @input wallThickness: number = 0.8;
  @input floorThickness: number = 0.6;
  @input rimHeight: number = 0.5;
  @input rimOverhang: number = 0.3;
  @input handleLength: number = 12;
  @input handleWidth: number = 2.5;
  @input handleThickness: number = 1.5;

  onAwake(): void {
    const body: RGBA = [0.52, 0.52, 0.54, 1];
    const rim: RGBA = [0.86, 0.87, 0.9, 1];
    const handle: RGBA = [0.42, 0.4, 0.38, 1];
    const floorTint = (n: Vec3) => (n[1] > 0.5 ? 0.9 : defaultTint(n));

    const hw = this.innerWidth / 2;
    const hl = this.innerLength / 2;
    const t = this.wallThickness;
    const d = this.depth;
    const f = this.floorThickness;
    const o = this.rimOverhang;
    const ox = hw + t;
    const oz = hl + t;
    const wallTop = d - this.rimHeight;

    const w = new MeshWriter();

    // Floor: full outer footprint, top surface at y = 0.
    w.box([-ox, -f, -oz], [ox, 0, oz], body, floorTint);

    // Walls from the floor up to the rim band.
    w.box([hw, 0, -oz], [ox, wallTop, oz], body);     // +X (handle side)
    w.box([-ox, 0, -oz], [-hw, wallTop, oz], body);   // -X
    w.box([-hw, 0, hl], [hw, wallTop, oz], body);     // +Z near wall
    w.box([-hw, 0, -oz], [hw, wallTop, -hl], body);   // -Z far wall

    // Light rim band on top of the walls, overhanging outward.
    w.box([hw, wallTop, -oz - o], [ox + o, d, oz + o], rim);
    w.box([-ox - o, wallTop, -oz - o], [-hw, d, oz + o], rim);
    w.box([-hw, wallTop, hl], [hw, d, oz + o], rim);
    w.box([-hw, wallTop, -oz - o], [hw, d, -hl], rim);

    // Handle on +X, top flush with the rim.
    const hx0 = ox + o;
    w.box(
      [hx0, d - this.handleThickness, -this.handleWidth / 2],
      [hx0 + this.handleLength, d, this.handleWidth / 2],
      handle,
    );

    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    w.commit(rmv, this.material);
    print("[TamagoPanMesh] built " + w.vertexCount + " verts / " + w.triangleCount + " tris, material=" + (this.material ? "ok" : "MISSING"));
  }
}
