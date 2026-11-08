import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

/**
 * TamagoCoachBillboard - yaw-only "face the user" for the step card, keeping a fixed tilt.
 *
 * Owns: this SceneObject's world rotation every frame = yaw toward the head about world Y,
 *       composed with a constant pitch about the card's local X (top leans away from the user).
 * Expects: to sit on the StepCard object. Nothing wired.
 * Must not: change position or scale.
 */
@component
export class TamagoCoachBillboard extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachBillboard – yaw-only face the user</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Tilt toward the user, degrees (the card's top leans away)")
  @widget(new SliderWidget(0, 60, 1))
  tiltDeg: number = 30;

  @input
  @hint("Turn smoothing per frame, 0..1 (1 = snap instantly)")
  @widget(new SliderWidget(0.05, 1, 0.05))
  smoothing: number = 0.25;
  @ui.group_end

  private cameraTransform: Transform | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform();
      this.aim(1);
    });
    this.createEvent("UpdateEvent").bind(() => this.aim(this.smoothing));
  }

  private aim(blend: number): void {
    if (!this.cameraTransform) return;
    const t = this.getTransform();
    const toHead = this.cameraTransform.getWorldPosition().sub(t.getWorldPosition());
    const flat = new vec3(toHead.x, 0, toHead.z);
    if (flat.length < 1e-4) return;
    // The card's content faces local +Z; rotate (0,0,1) onto the flat direction to the head.
    const yaw = Math.atan2(flat.x, flat.z);
    const pitch = (-this.tiltDeg * Math.PI) / 180; // negative X rotation tips the normal upward
    const target = quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(pitch, vec3.right()));
    const current = t.getWorldRotation();
    t.setWorldRotation(blend >= 1 ? target : quat.slerp(current, target, blend));
  }
}
