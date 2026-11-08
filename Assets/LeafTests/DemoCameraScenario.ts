import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import { TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;

/**
 * Demo camera moves for the video capture (no assertions). The Interactive Preview camera can
 * only be teleported from outside (MovePreviewCamera), so this scenario drives the Camera
 * Object's world transform from inside the Lens, every frame, for a smooth move:
 *   mode=orbit  - one full circle around the StoveSet at the head's height and radius, looking
 *                 at the set, ending exactly where it started (the user view);
 *   mode=reveal - the opening shot: from a slightly raised view (startPitchDeg above level, so
 *                 the card top is out of the Specs field of view) slowly tilting down to the
 *                 current device pitch (about -33 deg).
 * While the move runs, the Camera Object's DeviceTracking component is disabled so the device
 * pose stops overwriting the camera transform every frame (the step card's billboard, which
 * reads the camera transform in its own UpdateEvent, then follows the moved camera too); the
 * pose is applied in UpdateEvent and again in LateUpdateEvent. Tracking is re-enabled at the end.
 * Parameters: mode, moveSeconds, holdSeconds (hold before and after the move), startPitchDeg (reveal).
 */
@component
export class DemoCameraScenario extends Scenario {
  private cameraTransform: Transform | null = null;
  private active = false;
  private pose: { position: vec3; rotation: quat } | null = null;

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.apply());
    this.createEvent("LateUpdateEvent").bind(() => this.apply());
  }

  private apply(): void {
    if (!this.active || !this.pose || !this.cameraTransform) return;
    this.cameraTransform.setWorldPosition(this.pose.position);
    this.cameraTransform.setWorldRotation(this.pose.rotation);
  }

  /** Camera rotation looking along `dir` (cameras look down local -Z): yaw about Y, then pitch about X. */
  private static lookRotation(dir: vec3): quat {
    const d = dir.normalize();
    const yaw = Math.atan2(-d.x, -d.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    return quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(pitch, vec3.right()));
  }

  private static smoothstep(s: number): number {
    const x = Math.max(0, Math.min(1, s));
    return x * x * (3 - 2 * x);
  }

  async run(config?: ScenarioConfig): Promise<void> {
    const beat = (name: string): void => print("[BEAT] " + name);
    const mode = (config && config.get("mode")) || "orbit";
    const moveSeconds = Number((config && config.get("moveSeconds")) || (mode === "orbit" ? "8" : "5"));
    const holdSeconds = Number((config && config.get("holdSeconds")) || (mode === "orbit" ? "1" : "1.5"));
    const startPitchDeg = Number((config && config.get("startPitchDeg")) || "6");
    beat("scenario_start");
    await sleep(START_SETTLE_MS);

    const camera = WorldCameraFinderProvider.getInstance().getComponent();
    const cameraObject = camera.getSceneObject();
    this.cameraTransform = camera.getTransform();
    const tracking = cameraObject.getComponent("Component.DeviceTracking") as DeviceTracking | null;
    print(`[DemoCamera] camera object "${cameraObject.name}" DeviceTracking=${tracking ? "found" : "none"}`);
    const card = T.requireObject("StepCard").getTransform();

    const p0 = this.cameraTransform.getWorldPosition();
    const look0 = this.cameraTransform.back; // current view direction (device pose)
    const target = T.worldPosition("StoveSet");
    print(`[DemoCamera] mode=${mode} move=${moveSeconds}s hold=${holdSeconds}s startPitch=${startPitchDeg} head=${T.fmt(p0)} look=${T.fmt(look0)} target=${T.fmt(target)}`);

    // Pose at progress s in [0, 1].
    let poseAt: (s: number) => { position: vec3; rotation: quat };
    if (mode === "orbit") {
      const hx = p0.x - target.x;
      const hz = p0.z - target.z;
      const radius = Math.sqrt(hx * hx + hz * hz);
      const phi0 = Math.atan2(hx, hz);
      poseAt = (s: number) => {
        const phi = phi0 + 2 * Math.PI * DemoCameraScenario.smoothstep(s);
        const position = new vec3(target.x + radius * Math.sin(phi), p0.y, target.z + radius * Math.cos(phi));
        return { position, rotation: DemoCameraScenario.lookRotation(target.sub(position)) };
      };
    } else {
      const yaw = Math.atan2(-look0.x, -look0.z);
      const pitchEnd = Math.asin(Math.max(-1, Math.min(1, look0.y)));
      const pitchStart = (startPitchDeg * Math.PI) / 180;
      poseAt = (s: number) => {
        const pitch = pitchStart + (pitchEnd - pitchStart) * DemoCameraScenario.smoothstep(s);
        const rotation = quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(pitch, vec3.right()));
        return { position: p0, rotation };
      };
    }

    this.pose = poseAt(0);
    if (tracking) tracking.enabled = false;
    this.active = true;
    beat(`cam_${mode}_hold_start`);
    await sleep(holdSeconds * 1000);
    beat(`cam_${mode}_move_start`);
    const t0 = getTime();
    let nextReport = 0;
    while (true) {
      const s = (getTime() - t0) / moveSeconds;
      this.pose = poseAt(Math.min(1, s));
      if (s >= nextReport) {
        // Diagnostics: the card's facing (its content faces local +Z) vs the bearing to the camera.
        const f = card.forward;
        const toCam = this.pose.position.sub(card.getWorldPosition());
        const cardYaw = (Math.atan2(f.x, f.z) * 180) / Math.PI;
        const camBearing = (Math.atan2(toCam.x, toCam.z) * 180) / Math.PI;
        print(`[DemoCamera] s=${s.toFixed(2)} cam=${T.fmt(this.pose.position)} cardYaw=${cardYaw.toFixed(1)} camBearing=${camBearing.toFixed(1)}`);
        nextReport += 0.25;
      }
      if (s >= 1) break;
      await sleep(1); // one short delayed event per frame-ish; apply() runs every frame anyway
    }
    beat(`cam_${mode}_move_end`);
    await sleep(holdSeconds * 1000);
    this.active = false;
    if (tracking) tracking.enabled = true; // the device pose takes over again (same pose as the move's end)
    beat("end");
  }
}
