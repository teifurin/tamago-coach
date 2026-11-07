import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { TamagoLeafInteractor, TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;
const COUNT_WAIT_MS = 3000;
const PAUSE_WAIT_MS = 2000;
const RESUME_WAIT_MS = 2000;

/**
 * Criterion 3 - countdown and pause: Heat counts down in real time (Demo OFF), a pinch on the
 * ring freezes the countdown and shows the pause glyph, a second pinch resumes it.
 */
@component
export class TC03CountdownPauseScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);
    const interactor = new TamagoLeafInteractor();
    const main = T.getMain();
    main.setDemoSpeed(false);
    expect(main.isDemoSpeed(), "Demo x10 must be off for the real-time countdown check").toBe(false);

    // Open Heat through the UI (Back to Prep first if a previous run left the Lens elsewhere).
    let guard = 0;
    while (main.getStepIndex() > 0 && guard++ < 6) {
      await interactor.tapButton("BackButton");
    }
    await interactor.tapButton("NextButton");
    expect(main.getStepTitle(), "step after Next from Prep").toBe("Heat");
    expect(T.readText("RingStepNumberText"), "ring number on Heat").toBe("2");

    const r0 = main.getRemainingSeconds();
    const t0 = T.readText("RingTimeText");
    print(`[tc-03] Heat opened: remaining=${r0.toFixed(2)} s RingTimeText="${t0}"`);
    expect(r0 > 0, `the Heat countdown must be running (remaining ${r0.toFixed(2)} s)`).toBe(true);

    await sleep(COUNT_WAIT_MS);
    const r1 = main.getRemainingSeconds();
    const t1 = T.readText("RingTimeText");
    print(`[tc-03] after ${COUNT_WAIT_MS} ms: remaining=${r1.toFixed(2)} s RingTimeText="${t1}" (consumed ${(r0 - r1).toFixed(2)} recipe-s; Demo off => about 3)`);
    expect(r1, `remaining after ${COUNT_WAIT_MS} ms (${r1.toFixed(2)}) must be below the earlier value (${r0.toFixed(2)})`).toBeLessThan(r0);
    expect(t1 !== t0, `RingTimeText must change while counting ("${t0}" -> "${t1}")`).toBe(true);

    // Pause.
    await interactor.tapRing();
    expect(main.isPaused(), "isPaused() after pinching the ring").toBe(true);
    expect(T.requireObject("RingPauseGlyph").enabled, "RingPauseGlyph enabled while paused").toBe(true);
    const r2 = main.getRemainingSeconds();
    const t2 = T.readText("RingTimeText");
    await sleep(PAUSE_WAIT_MS);
    const r3 = main.getRemainingSeconds();
    const t3 = T.readText("RingTimeText");
    print(`[tc-03] paused: remaining ${r2.toFixed(2)} -> ${r3.toFixed(2)} s over ${PAUSE_WAIT_MS} ms, RingTimeText "${t2}" -> "${t3}"`);
    expect(r3, `remaining must not change while paused (${r2.toFixed(2)} -> ${r3.toFixed(2)})`).toBe(r2);
    expect(t3, "RingTimeText must stay frozen while paused").toBe(t2);

    // Resume.
    await interactor.tapRing();
    expect(main.isPaused(), "isPaused() after the second pinch").toBe(false);
    expect(T.requireObject("RingPauseGlyph").enabled, "RingPauseGlyph hidden after resume").toBe(false);
    await sleep(RESUME_WAIT_MS);
    const r4 = main.getRemainingSeconds();
    print(`[tc-03] resumed: remaining=${r4.toFixed(2)} s after ${RESUME_WAIT_MS} ms (paused value ${r3.toFixed(2)})`);
    expect(r4, `remaining after resume (${r4.toFixed(2)}) must be below the paused value (${r3.toFixed(2)})`).toBeLessThan(r3);
  }
}
