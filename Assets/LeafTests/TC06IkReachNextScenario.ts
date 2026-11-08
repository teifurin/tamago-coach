import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { IKBodyInteractor } from "Leaf.lspkg/Interactors/interactor/ik/IKBodyInteractor";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { DiagnosticRecorder } from "Leaf.lspkg/Diagnostic/DiagnosticRecorder";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import { TamagoLeafInteractor as T } from "./TamagoLeafInteractor";

const START_SETTLE_MS = 1500;

/**
 * Reachability - a full-arm IK reach for the Next button, the way a user would press it.
 * A reach that does not converge is a placement finding about the Lens, not a test bug.
 *
 * No Bitmoji avatar on purpose: createIKInteractor() spawns an avatar whose rig is downloaded
 * from Snap's Bitmoji service, which this project must not contact. The IK arm/head solver and
 * its reach diagnostics do not need the visualizer.
 */
@component
export class TC06IkReachNextScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(START_SETTLE_MS);
    const main = T.getMain();
    main.setDemoSpeed(false);
    const next = T.findEnabledInteractable("NextButton");
    const before = main.getStepIndex();

    const ik = new IKBodyInteractor({ fallback: new DefaultLeafInteractor("TC06FallbackInteractor") });
    await ik.ready;

    const head = WorldCameraFinderProvider.getInstance().getWorldPosition();
    const target = next.getSceneObject().getTransform().getWorldPosition();
    const routing = ik.right.isIndirect(next) ? "indirect (far-field ray)" : "direct (poke within arm reach)";
    print(`[tc-06] NextButton at ${T.fmt(target)}, ${target.distance(head).toFixed(1)} cm from the head ${T.fmt(head)}; IK routing: ${routing}`);

    await ik.trigger(next);
    await sleep(500);

    const recorder = DiagnosticRecorder.getInstance();
    const report = recorder.toReport();
    if (recorder.getAll().length > 0) print(`[tc-06] IK diagnostics:\n${report}`);
    expect(
      recorder.hasErrors(),
      `IK reach diagnostics fired for NextButton (the scripted fallback may have pressed it instead): ${report}`,
    ).toBe(false);
    expect(main.getStepIndex(), `step index after the IK trigger (was ${before})`).toBe(before + 1);
    print(`[tc-06] step advanced ${before} -> ${main.getStepIndex()} via ${routing}`);
  }
}
