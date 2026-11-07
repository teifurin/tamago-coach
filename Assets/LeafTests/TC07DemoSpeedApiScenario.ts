import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { Switch } from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch";
import { TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;

/**
 * Regression test for the Demo x10 driver API: TamagoCoachMain.setDemoSpeed(on) must leave
 * isDemoSpeed() equal to `on` and mirror the state onto the "Demo x10" UIKit Switch, in both
 * directions, without bouncing back.
 *
 * Background: UIKit 2.0.0's Switch.onFinished passes its `explicit` flag (false for a
 * programmatic isOn change), not the switch state. TamagoCoachControlsUI once forwarded that
 * boolean as the new demo state, so setDemoSpeed(true) was immediately undone. The handler now
 * reads sw.isOn and ignores the programmatic echo; this scenario guards that fix.
 */
@component
export class TC07DemoSpeedApiScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);
    const main = T.getMain();
    const demoSwitch = T.requireObject("DemoSwitch").getComponent(Switch.getTypeName()) as Switch | null;
    const switchState = (): string => (demoSwitch ? String(demoSwitch.isOn) : "n/a");
    print(`[tc-07] before: isDemoSpeed()=${main.isDemoSpeed()} DemoSwitch.isOn=${switchState()}`);

    main.setDemoSpeed(true);
    await sleep(300);
    print(`[tc-07] after setDemoSpeed(true): isDemoSpeed()=${main.isDemoSpeed()} DemoSwitch.isOn=${switchState()}`);
    expect(
      main.isDemoSpeed(),
      `isDemoSpeed() after setDemoSpeed(true) (DemoSwitch.isOn=${switchState()})`,
    ).toBe(true);
    if (demoSwitch) {
      expect(demoSwitch.isOn, "DemoSwitch.isOn mirrors setDemoSpeed(true)").toBe(true);
    }

    // The state must hold (no delayed bounce from the switch's own events).
    await sleep(700);
    expect(main.isDemoSpeed(), "isDemoSpeed() still true 1 s after setDemoSpeed(true)").toBe(true);

    main.setDemoSpeed(false);
    await sleep(300);
    print(`[tc-07] after setDemoSpeed(false): isDemoSpeed()=${main.isDemoSpeed()} DemoSwitch.isOn=${switchState()}`);
    expect(
      main.isDemoSpeed(),
      `isDemoSpeed() after setDemoSpeed(false) (DemoSwitch.isOn=${switchState()})`,
    ).toBe(false);
    if (demoSwitch) {
      expect(demoSwitch.isOn, "DemoSwitch.isOn mirrors setDemoSpeed(false)").toBe(false);
    }
  }
}
