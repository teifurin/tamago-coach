import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { TamagoLeafInteractor, TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;

/** Ring step number and step name per step, in order. */
const EXPECTED: Array<[string, string]> = [
  ["1", "Prep"],
  ["2", "Heat"],
  ["3", "Layer 1"],
  ["4", "Layer 2"],
  ["5", "Layer 3"],
  ["6", "Rest & slice"],
];

/**
 * Criterion 2 - stepping: Next walks Prep -> Heat -> Layer 1 -> Layer 2 -> Layer 3 -> Rest & slice
 * with the ring number "1".."6" and the card title in step, and Back returns one step.
 * Demo x10 is left OFF so the countdowns are long and the taps are never racing a zero.
 */
@component
export class TC02StepsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);
    const interactor = new TamagoLeafInteractor();
    const main = T.getMain();
    main.setDemoSpeed(false);

    // Start from Prep through the UI, whatever a previous run left behind.
    let guard = 0;
    while (main.getStepIndex() > 0 && guard++ < EXPECTED.length) {
      await interactor.tapButton("BackButton");
    }

    const check = (step: number, where: string): void => {
      const [number, title] = EXPECTED[step];
      const ringNumber = T.readText("RingStepNumberText");
      const cardTitle = T.readText("CardTitleText");
      const ringTitle = T.readText("RingTitleText");
      print(`[tc-02] ${where}: ring="${ringNumber}" card="${cardTitle}" ringTitle="${ringTitle}" index=${main.getStepIndex()}`);
      expect(ringNumber, `RingStepNumberText ${where}`).toBe(number);
      expect(cardTitle, `CardTitleText ${where}`).toBe(title);
      expect(ringTitle, `RingTitleText ${where}`).toBe(title);
      expect(main.getStepIndex(), `getStepIndex() ${where}`).toBe(step);
    };

    check(0, "at start");
    for (let step = 1; step < EXPECTED.length; step++) {
      await interactor.tapButton("NextButton");
      check(step, `after Next #${step}`);
    }

    await interactor.tapButton("BackButton");
    check(4, "after Back");
  }
}
