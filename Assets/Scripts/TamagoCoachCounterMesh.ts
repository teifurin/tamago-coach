import { MeshWriter, RGBA, Vec3, hashNoise, scaleColor } from "./Meshes/MeshKit";

/**
 * TamagoCoachCounterMesh - the light-wood counter slab the virtual stove set sits on.
 *
 * Owns: one RenderMeshVisual built at runtime: a slab with a chamfered top edge, a tessellated
 *       top face carrying subtle deterministic per-vertex noise (wood-like variation), vertical
 *       sides one tint step darker than the top, and a darker bottom.
 * Expects: `material` = a lit PBR material with Vertex Color = Base Color (CounterPBR).
 * Must not: hold gameplay state or react to input.
 *
 * Local frame: origin = centre of the slab's TOP surface (the counter top is y = 0);
 * the slab extends down to y = -thicknessCm. +X right, +Z toward the user.
 */
@component
export class TamagoCoachCounterMesh extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachCounterMesh – counter slab</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Lit vertex-colour PBR material (CounterPBR: Vertex Color = Base Color, roughness 0.75)")
  material: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Slab width along X, cm")
  @widget(new SliderWidget(20, 120, 1))
  widthCm: number = 50;

  @input
  @hint("Slab depth along Z (near-far), cm")
  @widget(new SliderWidget(20, 100, 1))
  depthCm: number = 35;

  @input
  @hint("Slab thickness along Y, cm (extends below the counter top)")
  @widget(new SliderWidget(0.5, 10, 0.5))
  thicknessCm: number = 2;

  @input("vec4", "{0.80,0.68,0.52,1}")
  @hint("Slab colour, light wood (keep it light: black is transparent on Specs)")
  @widget(new ColorWidget())
  color: vec4;

  @input
  @hint("Chamfer (bevel) along the top edges, cm")
  @widget(new SliderWidget(0, 2, 0.1))
  chamferCm: number = 0.5;

  @input
  @hint("Per-vertex brightness noise on the top face, +- percent")
  @widget(new SliderWidget(0, 15, 0.5))
  noisePercent: number = 4;

  @input
  @hint("Top face tessellation along X (cells)")
  @widget(new SliderWidget(1, 40, 1))
  gridX: number = 10;

  @input
  @hint("Top face tessellation along Z (cells)")
  @widget(new SliderWidget(1, 40, 1))
  gridZ: number = 7;

  @input
  @hint("Brightness of the vertical sides relative to the top")
  @widget(new SliderWidget(0.5, 1, 0.01))
  sideTint: number = 0.86;

  @input
  @hint("Brightness of the chamfer strip relative to the top")
  @widget(new SliderWidget(0.5, 1, 0.01))
  bevelTint: number = 0.93;

  @input
  @hint("Brightness of the underside relative to the top")
  @widget(new SliderWidget(0.3, 1, 0.01))
  bottomTint: number = 0.8;
  @ui.group_end

  onAwake(): void {
    const base: RGBA = [this.color.x, this.color.y, this.color.z, this.color.w];
    const hw = this.widthCm / 2;
    const hd = this.depthCm / 2;
    const t = this.thicknessCm;
    const ch = Math.max(0, Math.min(this.chamferCm, t / 2, hw / 2, hd / 2));
    const w = new MeshWriter();

    // Top face at y = 0, inset by the chamfer, as a grid with deterministic per-vertex noise.
    // Each cell has its own four vertices, but a vertex's colour depends only on its lattice
    // (i, j), so neighbouring cells agree and the variation reads as one continuous surface.
    const nx = Math.max(1, Math.round(this.gridX));
    const nz = Math.max(1, Math.round(this.gridZ));
    const amp = this.noisePercent / 100;
    const up: Vec3 = [0, 1, 0];
    const tx = hw - ch;
    const tz = hd - ch;
    const vcol = (i: number, j: number): RGBA => scaleColor(base, 1 + amp * hashNoise(i, j, 7));
    const vpos = (i: number, j: number): Vec3 => [-tx + (2 * tx * i) / nx, 0, -tz + (2 * tz * j) / nz];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        w.quad(
          [vpos(i, j), vpos(i + 1, j), vpos(i + 1, j + 1), vpos(i, j + 1)],
          [up, up, up, up],
          [vcol(i, j), vcol(i + 1, j), vcol(i + 1, j + 1), vcol(i, j + 1)],
          up,
        );
      }
    }

    // Chamfer: four planar strips from the inset top edge (y = 0) out to the full footprint at
    // y = -ch. Adjacent strips share their corner edge, so the bevel closes without gaps.
    if (ch > 0) {
      const bevel = scaleColor(base, this.bevelTint);
      const s = Math.SQRT1_2;
      w.face([[tx, 0, -tz], [hw, -ch, -hd], [hw, -ch, hd], [tx, 0, tz]], [s, s, 0], bevel);
      w.face([[-tx, 0, tz], [-hw, -ch, hd], [-hw, -ch, -hd], [-tx, 0, -tz]], [-s, s, 0], bevel);
      w.face([[tx, 0, tz], [hw, -ch, hd], [-hw, -ch, hd], [-tx, 0, tz]], [0, s, s], bevel);
      w.face([[-tx, 0, -tz], [-hw, -ch, -hd], [hw, -ch, -hd], [tx, 0, -tz]], [0, s, -s], bevel);
    }

    // Vertical sides from the underside up to the chamfer, then the underside itself.
    const side = scaleColor(base, this.sideTint);
    const yb = -t;
    const yc = -ch;
    w.face([[hw, yb, -hd], [hw, yc, -hd], [hw, yc, hd], [hw, yb, hd]], [1, 0, 0], side);
    w.face([[-hw, yb, hd], [-hw, yc, hd], [-hw, yc, -hd], [-hw, yb, -hd]], [-1, 0, 0], side);
    w.face([[-hw, yb, hd], [hw, yb, hd], [hw, yc, hd], [-hw, yc, hd]], [0, 0, 1], side);
    w.face([[hw, yb, -hd], [-hw, yb, -hd], [-hw, yc, -hd], [hw, yc, -hd]], [0, 0, -1], side);
    w.face([[-hw, yb, hd], [-hw, yb, -hd], [hw, yb, -hd], [hw, yb, hd]], [0, -1, 0], scaleColor(base, this.bottomTint));

    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    w.commit(rmv, this.material);
    print("[TamagoCoachCounterMesh] built " + w.vertexCount + " verts / " + w.triangleCount + " tris, material=" + (this.material ? "ok" : "MISSING"));
  }
}
