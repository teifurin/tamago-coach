import { MeshWriter, RGBA } from "./Meshes/MeshKit";

/**
 * TamagoCoachCounterMesh - the plain counter slab the virtual stove set sits on.
 *
 * Owns: one RenderMeshVisual built at runtime (a box with baked per-face shading).
 * Expects: `material` = the unlit vertex-colour material (SimpleVertexBaseColor).
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
  @hint("Unlit vertex-colour material (vertexBaseColorMaterial from SimpleVertexBaseColor)")
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

  @input("vec4", "{0.80,0.77,0.72,1}")
  @hint("Slab colour (keep it light: black is transparent on Specs)")
  @widget(new ColorWidget())
  color: vec4;
  @ui.group_end

  onAwake(): void {
    const c: RGBA = [this.color.x, this.color.y, this.color.z, this.color.w];
    const w = new MeshWriter();
    w.box(
      [-this.widthCm / 2, -this.thicknessCm, -this.depthCm / 2],
      [this.widthCm / 2, 0, this.depthCm / 2],
      c,
    );
    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    w.commit(rmv, this.material);
  }
}
