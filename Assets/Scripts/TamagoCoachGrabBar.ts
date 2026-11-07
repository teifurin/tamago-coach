import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { MeshWriter, RGBA } from "./Meshes/MeshKit";

/**
 * TamagoCoachGrabBar - the bar along the counter's near edge that drags the whole stove set.
 *
 * Owns: the bar visual (child "GrabBarVisual"), a box collider on this (unit-scale) object,
 *       a SIK Interactable (hover highlight) and an InteractableManipulation whose manipulate
 *       root is `stoveSet`, translation only. The set stays where it is released.
 * Expects: `stoveSet` (the StoveSet root SceneObject) and `material`.
 * Must not: move anything itself or know about steps/timers.
 *
 * Local frame: origin = centre of the bar; the bar spans +-widthCm/2 in X, +-heightCm/2 in Y,
 * +-depthCm/2 in Z. Author the object so the bar's underside touches the counter top.
 */
@component
export class TamagoCoachGrabBar extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachGrabBar – drag the whole set</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Root SceneObject moved by the grab (the StoveSet)")
  stoveSet: SceneObject;

  @input
  @hint("Unlit vertex-colour material (vertexBaseColorMaterial)")
  material: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Bar width along X, cm")
  @widget(new SliderWidget(10, 60, 1))
  widthCm: number = 30;

  @input
  @hint("Bar height along Y, cm")
  @widget(new SliderWidget(0.5, 5, 0.1))
  heightCm: number = 1.2;

  @input
  @hint("Bar depth along Z, cm")
  @widget(new SliderWidget(1, 10, 0.5))
  depthCm: number = 3;

  @input("vec4", "{0.55,0.72,0.92,1}")
  @hint("Bar colour at rest")
  @widget(new ColorWidget())
  barColor: vec4;

  @input("vec4", "{0.85,0.96,1.0,1}")
  @hint("Bar colour while a hand/cursor aims at it")
  @widget(new ColorWidget())
  hoverColor: vec4;

  @input
  @hint("Extra collider size around the bar so it is easy to grab, cm")
  @widget(new SliderWidget(0, 6, 0.5))
  colliderPaddingCm: number = 1.5;

  @input
  @hint("Draw the collider as a wireframe for hit-zone diagnosis")
  debugCollider: boolean = false;
  @ui.group_end

  private rmv: RenderMeshVisual | null = null;

  onAwake(): void {
    const visual = global.scene.createSceneObject("GrabBarVisual");
    visual.setParent(this.sceneObject);
    this.rmv = visual.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    this.rebuild(this.barColor);

    // Collider on this unit-scale object (never scaled; the visual is a child).
    const collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const shape = Shape.createBoxShape();
    shape.size = new vec3(
      this.widthCm + this.colliderPaddingCm,
      this.heightCm + this.colliderPaddingCm,
      this.depthCm + this.colliderPaddingCm,
    );
    collider.shape = shape;
    collider.fitVisual = false;
    collider.debugDrawEnabled = this.debugCollider;

    // Interactable first (InteractableManipulation looks it up on the same object at OnStart).
    const interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable;
    const manipulation = this.sceneObject.createComponent(
      InteractableManipulation.getTypeName(),
    ) as InteractableManipulation;
    manipulation.setCanRotate(false);
    manipulation.setCanScale(false);
    if (this.stoveSet) {
      manipulation.setManipulateRoot(this.stoveSet.getTransform());
    } else {
      print("[TamagoCoachGrabBar] stoveSet is not wired - the bar will only move itself.");
    }

    this.createEvent("OnStartEvent").bind(() => {
      interactable.onHoverEnter.add(() => this.rebuild(this.hoverColor));
      interactable.onHoverExit.add(() => this.rebuild(this.barColor));
    });
  }

  private rebuild(color: vec4): void {
    if (!this.rmv) return;
    const c: RGBA = [color.x, color.y, color.z, color.w];
    const w = new MeshWriter();
    w.box(
      [-this.widthCm / 2, -this.heightCm / 2, -this.depthCm / 2],
      [this.widthCm / 2, this.heightCm / 2, this.depthCm / 2],
      c,
    );
    w.commit(this.rmv, this.material);
  }
}
