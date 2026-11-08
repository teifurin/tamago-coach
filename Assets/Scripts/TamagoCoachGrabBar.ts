import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { MeshWriter, RGBA, Vec3, scaleColor } from "./Meshes/MeshKit";

/**
 * TamagoCoachGrabBar - the bar along the counter's near edge that drags the whole stove set.
 *
 * Owns: the bar visual (child "GrabBarVisual": a horizontal capsule along X with three raised
 *       grip ridges in the middle), a box collider on this (unit-scale) object, a SIK Interactable
 *       (hover highlight) and an InteractableManipulation whose manipulate root is `stoveSet`,
 *       translation only. The set stays where it is released.
 * Expects: `stoveSet` (the StoveSet root SceneObject) and `material` (GrabBarPBR).
 * Must not: move anything itself or know about steps/timers.
 *
 * Local frame: origin = centre of the bar; the capsule spans +-widthCm/2 in X with radius
 * heightCm/2 (so it is heightCm high and heightCm deep). The collider box is widthCm x heightCm x
 * depthCm plus padding. Author the object so the capsule's underside touches the counter top
 * (y = heightCm/2 above it).
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
  @hint("Lit vertex-colour PBR material (GrabBarPBR: metallic 0.1 / roughness 0.5)")
  material: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Bar length along X, cm (capsule end to end)")
  @widget(new SliderWidget(10, 60, 1))
  widthCm: number = 30;

  @input
  @hint("Bar height along Y, cm (= capsule diameter)")
  @widget(new SliderWidget(0.5, 5, 0.1))
  heightCm: number = 2;

  @input
  @hint("Collider depth along Z, cm (the capsule itself is heightCm deep)")
  @widget(new SliderWidget(1, 10, 0.5))
  depthCm: number = 2;

  @input("vec4", "{0.45,0.52,0.62,1}")
  @hint("Bar colour at rest (low-saturation grey-blue)")
  @widget(new ColorWidget())
  barColor: vec4;

  @input("vec4", "{0.74,0.82,0.94,1}")
  @hint("Bar colour while a hand/cursor aims at it")
  @widget(new ColorWidget())
  hoverColor: vec4;

  @input
  @hint("Number of raised grip ridges in the middle")
  @widget(new SliderWidget(0, 7, 1))
  ridgeCount: number = 3;

  @input
  @hint("Spacing between grip ridges along X, cm")
  @widget(new SliderWidget(0.5, 6, 0.1))
  ridgeSpacingCm: number = 2;

  @input
  @hint("Ridge radius relative to the capsule radius")
  @widget(new SliderWidget(1, 1.5, 0.01))
  ridgeRadiusScale: number = 1.15;

  @input
  @hint("Ridge width along X, cm")
  @widget(new SliderWidget(0.1, 2, 0.1))
  ridgeWidthCm: number = 0.4;

  @input
  @hint("Segments around the capsule")
  @widget(new SliderWidget(6, 32, 1))
  segments: number = 12;

  @input
  @hint("Rings per hemispherical end cap")
  @widget(new SliderWidget(2, 12, 1))
  capRings: number = 6;

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
    const r = Math.max(0.05, this.heightCm / 2);
    const half = this.widthCm / 2;
    const segs = Math.max(3, Math.round(this.segments));
    const w = new MeshWriter();
    this.capsuleX(w, -half, half, r, segs, Math.max(1, Math.round(this.capRings)), c);
    const ridges = Math.max(0, Math.round(this.ridgeCount));
    const rw = Math.max(0.05, this.ridgeWidthCm);
    for (let k = 0; k < ridges; k++) {
      const x = (k - (ridges - 1) / 2) * this.ridgeSpacingCm;
      this.ridgeX(w, x - rw / 2, x + rw / 2, r * this.ridgeRadiusScale, segs, scaleColor(c, 0.96));
    }
    w.commit(this.rmv, this.material);
  }

  /** Capsule along X from x0 to x1 (end to end) with radius r: cylinder body + two hemispheres, smooth normals. */
  private capsuleX(w: MeshWriter, x0: number, x1: number, r: number, segs: number, capRings: number, c: RGBA): void {
    const rings: { x: number; s: number; nx: number }[] = [];
    for (let k = 0; k <= capRings; k++) {
      const th = (Math.PI / 2) * (1 - k / capRings); // 90 deg (tip) -> 0 (body start)
      rings.push({ x: x0 + r - r * Math.sin(th), s: Math.cos(th), nx: -Math.sin(th) });
    }
    for (let k = 0; k <= capRings; k++) {
      const th = (Math.PI / 2) * (k / capRings); // 0 (body end) -> 90 deg (tip)
      rings.push({ x: x1 - r + r * Math.sin(th), s: Math.cos(th), nx: Math.sin(th) });
    }
    this.sweep(w, rings, r, segs, c);
  }

  /** Short cylinder (a grip ridge) along X from xa to xb with radius rr: side plus two flat discs. */
  private ridgeX(w: MeshWriter, xa: number, xb: number, rr: number, segs: number, c: RGBA): void {
    this.sweep(w, [{ x: xa, s: 1, nx: 0 }, { x: xb, s: 1, nx: 0 }], rr, segs, c);
    const disc = (x: number): Vec3[] => {
      const pts: Vec3[] = [];
      for (let j = 0; j < segs; j++) {
        const phi = (Math.PI * 2 * j) / segs;
        pts.push([x, rr * Math.cos(phi), rr * Math.sin(phi)]);
      }
      return pts;
    };
    w.face(disc(xa), [-1, 0, 0], c);
    w.face(disc(xb), [1, 0, 0], c);
  }

  /** Surface of revolution about X through the given rings (x, radius scale, normal x-component). */
  private sweep(w: MeshWriter, rings: { x: number; s: number; nx: number }[], r: number, segs: number, c: RGBA): void {
    const P = (ring: { x: number; s: number; nx: number }, phi: number): Vec3 => [ring.x, r * ring.s * Math.cos(phi), r * ring.s * Math.sin(phi)];
    const N = (ring: { x: number; s: number; nx: number }, phi: number): Vec3 => {
      const lateral = Math.sqrt(Math.max(0, 1 - ring.nx * ring.nx));
      return [ring.nx, lateral * Math.cos(phi), lateral * Math.sin(phi)];
    };
    for (let i = 0; i + 1 < rings.length; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let j = 0; j < segs; j++) {
        const p0 = (Math.PI * 2 * j) / segs;
        const p1 = (Math.PI * 2 * (j + 1)) / segs;
        w.quad([P(A, p0), P(A, p1), P(B, p1), P(B, p0)], [N(A, p0), N(A, p1), N(B, p1), N(B, p0)], [c, c, c, c]);
      }
    }
  }
}
