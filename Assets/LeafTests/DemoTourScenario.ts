import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { TamagoLeafInteractor, TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;
const SETTLE_MS = 50; // Leaf's sleep() rejects 0; the beat prints ~50 ms after the pinch resolves

/**
 * Demo tour for the video capture (no assertions): walks the whole flow on camera the way the
 * storyboard wants it and prints "[BEAT] <name>" at every beat, so the editor can map the Lens
 * Studio log timestamps onto the screen recording. Demo x10 is switched through its UI switch
 * like a user would. Nothing here changes the Lens.
 *
 * Beats (hold times are real seconds):
 *   prep 4 s -> Next: heat 6 s (steam) -> ring pinch: paused 2 s -> ring pinch: resumed
 *   -> Next: layer1 with Demo off 9 s (card collapses at 6 s, egg sets) -> Demo on, zero in ~2 s
 *   -> roll cue 8 s (chime, "Roll now", arrow sweeps) -> Next: layer2 (log at the far side) 4 s
 *   -> zero + 3 s -> Demo off, Next: layer3 5 s (short card stays up; under Demo it would collapse
 *   after 0.6 s) -> Demo on, zero + 3 s -> Next: rest (12 s under Demo) -> done + 8 s.
 */
@component
export class DemoTourScenario extends Scenario {
  async run(): Promise<void> {
    const beat = (name: string): void => print("[BEAT] " + name);
    beat("scenario_start");
    await sleep(START_SETTLE_MS);
    const interactor = new TamagoLeafInteractor();
    const main = T.getMain();

    // A fresh reset lands on Prep with Demo off; make sure anyway, through the UI.
    if (main.isDemoSpeed()) await interactor.tapButton("DemoSwitch");
    let guard = 0;
    while (main.getStepIndex() > 0 && guard++ < 6) await interactor.tapButton("BackButton");

    beat("prep");
    await sleep(4000);

    await interactor.tapButton("NextButton", SETTLE_MS); // Heat: 1:00 real time, steam over the pan
    beat("heat");
    await sleep(6000);

    await interactor.tapRing(SETTLE_MS); // pause: pause glyph on the ring
    beat("heat_paused");
    await sleep(2000);
    await interactor.tapRing(SETTLE_MS); // resume
    beat("heat_resumed");
    await sleep(1000);

    await interactor.tapButton("NextButton", SETTLE_MS); // Layer 1 with Demo off: long card, slow egg
    beat("layer1");
    await sleep(9000); // the card collapses at 6 s, the egg goes from glossy toward matte

    await interactor.tapButton("DemoSwitch", SETTLE_MS); // Demo x10 on: the remaining ~21 s take ~2 s
    beat("demo_on");
    await T.waitUntil(() => main.isRollCueActive(), 20000, "Layer 1 zero (roll cue)");
    beat("layer1_zero_rollnow");
    await sleep(8000); // chime, ring pulses, "Roll now", arrow sweeps

    await interactor.tapButton("NextButton", SETTLE_MS); // Layer 2: the first log appears at the far side
    beat("layer2");
    await sleep(4000);
    await T.waitUntil(() => main.isRollCueActive(), 20000, "Layer 2 zero (roll cue)");
    beat("layer2_zero_rollnow");
    await sleep(3000);

    await interactor.tapButton("DemoSwitch", SETTLE_MS); // Demo off so the short Layer 3 card stays up
    beat("demo_off");
    await interactor.tapButton("NextButton", SETTLE_MS); // Layer 3: thicker log, "Pour, wait, roll."
    beat("layer3");
    await sleep(5000);
    await interactor.tapButton("DemoSwitch", SETTLE_MS); // Demo on again: zero in ~2.5 s
    beat("demo_on_2");
    await T.waitUntil(() => main.isRollCueActive(), 20000, "Layer 3 zero (roll cue)");
    beat("layer3_zero_rollnow");
    await sleep(3000);

    await interactor.tapButton("NextButton", SETTLE_MS); // Rest & slice: 2:00 -> 12 s under Demo
    beat("rest");
    await T.waitUntil(() => main.isDone(), 40000, "Rest & slice zero (Done)");
    beat("done"); // six slices reveal one by one, warm pulse, Done card
    await sleep(8000);
    beat("end");
  }
}
