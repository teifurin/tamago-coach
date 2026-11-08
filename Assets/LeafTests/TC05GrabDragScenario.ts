import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { LeafHandInteractor } from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor";
import { TamagoLeafInteractor, TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;
const TRACKED = ["StoveSet", "Pan", "TimerRing", "StepCard", "NextButton"];
const NOMINAL_DRAG_CM = 10;
const DRAG_MS = 1000;
const SETTLE_AFTER_DRAG_MS = 500;
const RELEASE_WAIT_MS = 1500;

type Positions = Record<string, vec3>;

type DragResult = {
  before: Positions;
  after: Positions;
  updates: number;
  delta: vec3;
};

/**
 * Criterion 5 - grab bar: dragging the bar moves the whole set together along the drag, and the
 * set stays where it is released.
 *
 * LEAF's drag(vector, ms) adds `vector` to the simulated ray on EVERY drag update (per frame),
 * so the vector is sized from the measured frame rate to add up to ~10 cm over the drag, and the
 * assertion is made against the number of drag updates actually delivered.
 *
 * The interactor reports a 500 cm far-field ray like a real SIK HandInteractor: with LEAF's
 * mocked 0 cm, SIK's InteractableManipulation z-stretch clamp pulls the dragged set to 1 cm
 * from the ray origin (observed in the first run as a 69 cm jump toward the camera).
 */
@component
export class TC05GrabDragScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);
    const interactor = new TamagoLeafInteractor({ maxRaycastDistanceCm: 500 });
    const grab = T.findEnabledInteractable("GrabBar");
    const stove = T.requireObject("StoveSet");

    const fps = await T.measureFps(500);
    const expectedUpdates = Math.max(1, Math.round((fps * DRAG_MS) / 1000));
    const perUpdateCm = NOMINAL_DRAG_CM / expectedUpdates;
    const right = stove.getTransform().right;
    const dir = new vec3(right.x, 0, right.z).normalize();
    const dragVector = dir.uniformScale(perUpdateCm);
    print(`[tc-05] fps=${fps.toFixed(1)} -> ${perUpdateCm.toFixed(3)} cm per drag update along ${T.fmt(dir)} for ${DRAG_MS} ms (nominal ${NOMINAL_DRAG_CM} cm)`);

    const snapshot = (): Positions => {
      const positions: Positions = {};
      for (const name of TRACKED) positions[name] = T.worldPosition(name);
      return positions;
    };

    const attempt = async (label: string, doDrag: () => Promise<void>): Promise<DragResult> => {
      const before = snapshot();
      let updates = 0;
      const unsubscribe = grab.onDragUpdate.add(() => {
        updates++;
      });
      try {
        await doDrag();
      } finally {
        unsubscribe();
      }
      await sleep(SETTLE_AFTER_DRAG_MS);
      const after = snapshot();
      const delta = after["StoveSet"].sub(before["StoveSet"]);
      print(`[tc-05] ${label}: StoveSet moved ${T.fmt(delta)} (${delta.length.toFixed(2)} cm) over ${updates} drag updates`);
      return { before, after, updates, delta };
    };

    let used = "DefaultLeafInteractor";
    let result = await attempt(used, () => interactor.drag(grab, dragVector, DRAG_MS));
    if (result.delta.length < 0.5) {
      print("[tc-05] the scripted interactor did not move the set - trying the simulated right hand");
      used = 'LeafHandInteractor.get("right")';
      result = await attempt(used, () => LeafHandInteractor.get("right").drag(grab, dragVector, DRAG_MS));
    }
    print(`[tc-05] interactor used: ${used}`);

    const expected = perUpdateCm * result.updates;
    const along = result.delta.dot(dir);
    const perpendicular = result.delta.sub(dir.uniformScale(along)).length;
    const tolerance = Math.max(3, 0.3 * expected);
    print(`[tc-05] along drag=${along.toFixed(2)} cm (expected ${expected.toFixed(2)} = ${perUpdateCm.toFixed(3)} x ${result.updates}, tolerance ±${tolerance.toFixed(1)}), off-axis=${perpendicular.toFixed(2)} cm`);
    expect(result.delta.length >= 0.5, `StoveSet did not move (|delta| ${result.delta.length.toFixed(2)} cm) with ${used}`).toBe(true);
    expect(
      Math.abs(along - expected) <= tolerance,
      `StoveSet moved ${along.toFixed(1)} cm along the drag, expected ${expected.toFixed(1)} (${perUpdateCm.toFixed(3)} cm x ${result.updates} updates) ± ${tolerance.toFixed(1)}`,
    ).toBe(true);
    expect(perpendicular <= 3, `off-axis motion ${perpendicular.toFixed(2)} cm, expected <= 3`).toBe(true);

    for (const name of TRACKED) {
      const moved = result.after[name].sub(result.before[name]);
      const difference = moved.sub(result.delta).length;
      print(`[tc-05] ${name} moved ${T.fmt(moved)}`);
      expect(
        difference < 0.1,
        `${name} moved ${T.fmt(moved)} but StoveSet moved ${T.fmt(result.delta)} (difference ${difference.toFixed(3)} cm)`,
      ).toBe(true);
    }

    await sleep(RELEASE_WAIT_MS);
    const later = snapshot();
    for (const name of TRACKED) {
      const drift = later[name].distance(result.after[name]);
      expect(drift < 0.05, `${name} drifted ${drift.toFixed(3)} cm in ${RELEASE_WAIT_MS} ms after release; expected to stay put`).toBe(true);
    }
    print("[tc-05] all tracked objects stayed where released");
  }
}
