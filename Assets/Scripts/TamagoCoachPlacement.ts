import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

/**
 * TamagoCoachPlacement - places the StoveSet root ONCE relative to the user's head at start,
 * then leaves it alone (world-locked; the set is never parented to the camera).
 *
 * Owns: a single delayed placement of this SceneObject's world transform.
 * Expects: to sit on the StoveSet root. Nothing wired.
 * Must not: follow the camera or re-place after the first placement.
 *
 * The placement waits `delaySeconds` because the Interactive Preview camera is not reliable on
 * frame 0. Position = head + flattened view direction * forwardCm, dropped by belowEyeCm; the
 * set's yaw is aligned to the user's facing so its far edge (-Z) points away from the user.
 */
@component
export class TamagoCoachPlacement extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachPlacement – one-shot placement at start</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Distance in front of the head, cm")
  @widget(new SliderWidget(30, 150, 1))
  forwardCm: number = 70;

  @input
  @hint("Drop of the counter top below eye level, cm")
  @widget(new SliderWidget(0, 100, 1))
  belowEyeCm: number = 45;

  @input
  @hint("Seconds to wait after start before placing (camera pose settles)")
  @widget(new SliderWidget(0, 2, 0.05))
  delaySeconds: number = 0.3;

  @input
  @hint("Off = keep the authored transform instead of placing relative to the head")
  placeAtStart: boolean = true;
  @ui.group_end

  private placed = false;

  onAwake(): void {
    if (!this.placeAtStart) return;
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => this.placeOnce());
    delayed.reset(this.delaySeconds);
  }

  /** Place the set relative to the current head pose. Runs once; later calls are ignored. */
  placeOnce(): void {
    if (this.placed) return;
    this.placed = true;
    const cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform();
    const headPos = cameraTransform.getWorldPosition();
    // Lens Studio cameras look down their local -Z, i.e. along Transform.back.
    const look = cameraTransform.back;
    let flat = new vec3(look.x, 0, look.z);
    if (flat.length < 1e-4) flat = new vec3(0, 0, -1);
    flat = flat.normalize();

    const position = headPos.add(flat.uniformScale(this.forwardCm)).add(new vec3(0, -this.belowEyeCm, 0));
    // The set's local +Z must point back toward the user: rotate (0,0,1) onto -flat.
    const yaw = Math.atan2(-flat.x, -flat.z);
    const rotation = quat.angleAxis(yaw, vec3.up());

    const t = this.getTransform();
    t.setWorldRotation(rotation);
    t.setWorldPosition(position);
    print(
      "[TamagoCoachPlacement] placed at (" +
        position.x.toFixed(1) + ", " + position.y.toFixed(1) + ", " + position.z.toFixed(1) +
        ") yaw=" + ((yaw * 180) / Math.PI).toFixed(1) + " deg",
    );
  }
}
