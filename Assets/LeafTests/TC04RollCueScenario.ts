import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { TamagoLeafInteractor, TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;
const ROLL_CUE_TIMEOUT_MS = 8000;

/**
 * Criterion 4 - roll cue: under Demo x10 the Layer 1 countdown reaches zero in ~3 s; the card
 * says "Roll now", the arrow appears, and Next after the cue adds the layer to the log
 * (thicker log, arrow hidden). The chime at zero is checked by ear only.
 *
 * Demo x10 is switched on the way a user does it - a pinch on the "Demo x10" UIKit switch
 * (DemoSwitch). The driver API setDemoSpeed(true) does not stick (see tc-07-demo-speed-api).
 */
@component
export class TC04RollCueScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);
    const interactor = new TamagoLeafInteractor();
    const main = T.getMain();
    if (!main.isDemoSpeed()) {
      await interactor.tapButton("DemoSwitch");
    }
    expect(main.isDemoSpeed(), "isDemoSpeed() after pinching the Demo x10 switch").toBe(true);

    let guard = 0;
    while (main.getStepIndex() > 0 && guard++ < 6) {
      await interactor.tapButton("BackButton");
    }
    await interactor.tapButton("NextButton"); // Heat
    await interactor.tapButton("NextButton"); // Layer 1
    expect(T.readText("RingStepNumberText"), "ring number on Layer 1").toBe("3");
    expect(main.getStepTitle(), "step title").toBe("Layer 1");
    expect(main.isRollCueActive(), "no roll cue right after opening Layer 1").toBe(false);

    // Observe (not assert) the card collapsing during the countdown while waiting for zero.
    const stepCard = T.requireObject("StepCard");
    let collapsedSeen = false;
    const elapsedMs = await T.waitUntil(
      () => {
        if (!stepCard.enabled) collapsedSeen = true;
        return main.isRollCueActive();
      },
      ROLL_CUE_TIMEOUT_MS,
      "the roll cue (Layer 1 countdown zero)",
    );
    print(`[tc-04] roll cue after ${elapsedMs} ms (about 3000 expected under Demo x10); card collapsed during the countdown: ${collapsedSeen}`);
    await sleep(300);

    const instruction = T.readText("CardInstructionText");
    const ringTime = T.readText("RingTimeText");
    const before = main.getLogThicknessCm();
    print(`[tc-04] at zero: CardInstructionText="${instruction}" RingTimeText="${ringTime}" RollArrow.enabled=${T.requireObject("RollArrow").enabled} StepCard.enabled=${stepCard.enabled} log=${before} cm`);
    expect(instruction.includes("Roll now"), `CardInstructionText at zero: "${instruction}"`).toBe(true);
    expect(T.requireObject("RollArrow").enabled, "RollArrow enabled during the roll cue").toBe(true);
    expect(stepCard.enabled, "StepCard re-expanded at zero").toBe(true);
    expect(ringTime, "RingTimeText at zero").toBe("0:00");
    expect(before, "log thickness before the first Next-after-roll-cue").toBe(0);

    await interactor.tapButton("NextButton");
    const after = main.getLogThicknessCm();
    print(`[tc-04] after Next: log=${after} cm RollArrow.enabled=${T.requireObject("RollArrow").enabled} step="${main.getStepTitle()}" ring="${T.readText("RingStepNumberText")}"`);
    expect(T.requireObject("RollArrow").enabled, "RollArrow hidden after Next").toBe(false);
    expect(main.isRollCueActive(), "roll cue cleared after Next").toBe(false);
    expect(after, `log thickness after Next (${after} cm) must exceed the value before (${before} cm)`).toBeGreaterThan(before);
    expect(main.getStepTitle(), "step after Next").toBe("Layer 2");
    expect(T.readText("RingStepNumberText"), "ring number on Layer 2").toBe("4");
    print("[tc-04] the chime at zero cannot be verified by LEAF - check it by ear.");
  }
}
