import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { TamagoLeafInteractor, TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;
const DRAG_CM = 10;
const DRAG_MS = 2000;

/**
 * Demo grab for the video capture (no assertions): drags the grab bar so the whole set slides
 * about 10 cm to the right over 2 s, rests, slides back, rests. Prints "[BEAT] <name>" at every
 * beat. Same drag mechanics as tc-05 (per-update vector sized from the frame rate, 500 cm ray).
 */
@component
export class DemoGrabScenario extends Scenario {
  async run(): Promise<void> {
    const beat = (name: string): void => print("[BEAT] " + name);
    beat("scenario_start");
    await sleep(START_SETTLE_MS);
    const interactor = new TamagoLeafInteractor({ maxRaycastDistanceCm: 500 });
    const grab = T.findEnabledInteractable("GrabBar");
    const stove = T.requireObject("StoveSet");

    const fps = await T.measureFps(500);
    const updates = Math.max(1, Math.round((fps * DRAG_MS) / 1000));
    const right = stove.getTransform().right;
    const dir = new vec3(right.x, 0, right.z).normalize();
    const step = dir.uniformScale(DRAG_CM / updates);
    print(`[DemoGrab] fps=${fps.toFixed(1)} -> ${(DRAG_CM / updates).toFixed(3)} cm per drag update along ${T.fmt(dir)}`);

    beat("grab_idle");
    await sleep(1500);

    const before = T.worldPosition("StoveSet");
    beat("grab_drag_right");
    await interactor.drag(grab, step, DRAG_MS);
    const mid = T.worldPosition("StoveSet");
    print(`[DemoGrab] moved ${T.fmt(mid.sub(before))} (${mid.sub(before).length.toFixed(2)} cm)`);
    beat("grab_released_right");
    await sleep(1500);

    beat("grab_drag_back");
    await interactor.drag(grab, step.uniformScale(-1), DRAG_MS);
    const after = T.worldPosition("StoveSet");
    print(`[DemoGrab] back ${T.fmt(after.sub(mid))} (${after.sub(mid).length.toFixed(2)} cm), net ${T.fmt(after.sub(before))}`);
    beat("grab_released_back");
    await sleep(2000);
    beat("end");
  }
}
