import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import { TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;
const WORLD_LOCK_WAIT_MS = 2000;
const FORWARD_CM = 70;
const FORWARD_TOLERANCE_CM = 10;
const DROP_CM = 45;
const DROP_TOLERANCE_CM = 8;

/**
 * Criterion 1 - start layout: the stove set appears in front of and below the head, the card
 * sits near and above the pan, the first step is Prep / "1", and the set is world-locked.
 * Not covered here: the WASD walk-around and text readability (visual checks).
 */
@component
export class TC01StartLayoutScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);

    for (const name of ["StoveSet", "Counter", "Pan", "StepCard"]) {
      const so = findSceneObjectByName(name);
      expect(!!so, `"${name}" must exist in the scene`).toBe(true);
      expect(so!.isEnabledInHierarchy, `"${name}" must be enabled in the hierarchy`).toBe(true);
    }

    const cardTitle = T.readText("CardTitleText");
    const ringNumber = T.readText("RingStepNumberText");
    print(`[tc-01] start: CardTitleText="${cardTitle}" RingStepNumberText="${ringNumber}"`);
    expect(cardTitle, "CardTitleText at start").toBe("Prep");
    expect(ringNumber, "RingStepNumberText at start").toBe("1");

    // World-locked means: not hanging under a camera, and not moving once placed.
    const stove = T.requireObject("StoveSet");
    const parent = stove.getParent();
    print(`[tc-01] StoveSet parent: ${isNull(parent) ? "(none - scene root)" : parent.name}`);
    let cameraAncestor: string | null = null;
    let cursor: SceneObject | null = parent;
    while (!isNull(cursor)) {
      if (cursor!.getComponent("Component.Camera")) {
        cameraAncestor = cursor!.name;
        break;
      }
      cursor = cursor!.getParent();
    }
    expect(cameraAncestor, `StoveSet must not be parented under a camera (found "${cameraAncestor}")`).toBeNull();

    const head = WorldCameraFinderProvider.getInstance().getWorldPosition();
    const stovePos = stove.getTransform().getWorldPosition();
    const dx = stovePos.x - head.x;
    const dz = stovePos.z - head.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    const drop = head.y - stovePos.y;
    print(`[tc-01] head=${T.fmt(head)} StoveSet=${T.fmt(stovePos)} horizontal=${horizontal.toFixed(1)} cm drop=${drop.toFixed(1)} cm`);
    expect(
      Math.abs(horizontal - FORWARD_CM) <= FORWARD_TOLERANCE_CM,
      `StoveSet horizontal distance from the head is ${horizontal.toFixed(1)} cm, expected ${FORWARD_CM} ± ${FORWARD_TOLERANCE_CM}`,
    ).toBe(true);
    expect(
      Math.abs(drop - DROP_CM) <= DROP_TOLERANCE_CM,
      `StoveSet sits ${drop.toFixed(1)} cm below the head, expected ${DROP_CM} ± ${DROP_TOLERANCE_CM}`,
    ).toBe(true);

    const cardPos = T.worldPosition("StepCard");
    const panPos = T.worldPosition("Pan");
    const cardToPan = cardPos.distance(panPos);
    print(`[tc-01] StepCard=${T.fmt(cardPos)} Pan=${T.fmt(panPos)} distance=${cardToPan.toFixed(1)} cm`);
    expect(cardToPan < 25, `StepCard is ${cardToPan.toFixed(1)} cm from the Pan, expected < 25`).toBe(true);
    expect(cardPos.y > panPos.y, `StepCard y=${cardPos.y.toFixed(1)} must be above Pan y=${panPos.y.toFixed(1)}`).toBe(true);

    await sleep(WORLD_LOCK_WAIT_MS);
    const stovePosLater = stove.getTransform().getWorldPosition();
    const drift = stovePosLater.distance(stovePos);
    print(`[tc-01] StoveSet after ${WORLD_LOCK_WAIT_MS} ms: ${T.fmt(stovePosLater)} drift=${drift.toFixed(3)} cm`);
    expect(drift < 0.05, `StoveSet drifted ${drift.toFixed(3)} cm in ${WORLD_LOCK_WAIT_MS} ms; expected world-locked`).toBe(true);
  }
}
