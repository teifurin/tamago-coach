import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { findSceneObjectByName, nextFrame, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { TamagoCoachMain } from "../Scripts/TamagoCoachMain";

/**
 * TamagoLeafInteractor - shared helpers for the Tamago Coach LEAF scenarios.
 *
 * Additive test code only: nothing here changes the Lens. Scene objects are looked up by the
 * exact names the Lens authors or creates at runtime (TamagoCoach, StoveSet, NextButton,
 * CardTitleText, RingStepNumberText, ...). SIK is driven through the scripted
 * DefaultLeafInteractor; the static helpers are usable from scenarios that bring their own
 * interactor (the IK reach scenario).
 */
export type TamagoLeafInteractorOptions = {
  /**
   * Report this far-field ray length to SIK instead of LEAF's mocked 0 cm. SIK's
   * InteractableManipulation derives its far-field z-stretch clamp from
   * `maxRaycastDistance - 100 cm`; with LEAF's 0 the clamp collapses and any far-field drag
   * yanks the manipulated object to 1 cm from the ray origin. A real SIK HandInteractor reports
   * 500 cm, so pass 500 for drag scenarios that go through InteractableManipulation.
   */
  maxRaycastDistanceCm?: number;
};

export class TamagoLeafInteractor extends DefaultLeafInteractor {
  constructor(options: TamagoLeafInteractorOptions = {}) {
    super("TamagoLeafInteractor");
    if (options.maxRaycastDistanceCm !== undefined) {
      const distance = options.maxRaycastDistanceCm;
      // LEAF defines its override with `configurable: true`, so a redefinition after super() wins.
      Object.defineProperty(this.sikInteractor, "maxRaycastDistance", {
        get: () => distance,
        configurable: true,
      });
    }
  }

  // ───────────────────────── scene access ─────────────────────────

  /** The TamagoCoachMain component on the "TamagoCoach" root object (the Lens's test API). */
  static getMain(): TamagoCoachMain {
    const host = findSceneObjectByName("TamagoCoach");
    if (!host) throw new Error('SceneObject "TamagoCoach" not found');
    const main = host.getComponent(TamagoCoachMain.getTypeName()) as TamagoCoachMain | null;
    if (!main) throw new Error('TamagoCoachMain component not found on "TamagoCoach"');
    return main;
  }

  /** A SceneObject by exact name; throws with the name when missing. */
  static requireObject(name: string): SceneObject {
    const so = findSceneObjectByName(name);
    if (!so) throw new Error(`SceneObject "${name}" not found`);
    return so;
  }

  /** The .text of the Text component on the named object. */
  static readText(objectName: string): string {
    const so = TamagoLeafInteractor.requireObject(objectName);
    const text = so.getComponent("Component.Text") as Text | null;
    if (!text) throw new Error(`"${objectName}" has no Text component`);
    return text.text;
  }

  static worldPosition(objectName: string): vec3 {
    return TamagoLeafInteractor.requireObject(objectName).getTransform().getWorldPosition();
  }

  /** The first enabled SIK Interactable on an object with this exact name. */
  static findEnabledInteractable(name: string): Interactable {
    const interactable = findInteractablesByName(name, undefined, true)[0];
    if (!interactable) throw new Error(`Interactable "${name}" not found or not enabled`);
    return interactable;
  }

  // ───────────────────────── timing ─────────────────────────

  /** Polls `predicate` every `intervalMs`; resolves with the elapsed ms, throws on timeout. */
  static async waitUntil(
    predicate: () => boolean,
    timeoutMs: number,
    label: string,
    intervalMs: number = 100,
  ): Promise<number> {
    const start = getTime();
    while (!predicate()) {
      const elapsedMs = (getTime() - start) * 1000;
      if (elapsedMs > timeoutMs) {
        throw new Error(`Timed out after ${Math.round(elapsedMs)} ms waiting for ${label}`);
      }
      await sleep(intervalMs);
    }
    return Math.round((getTime() - start) * 1000);
  }

  /** Frames per second over a short sample (used to size per-update drag vectors). */
  static async measureFps(sampleMs: number): Promise<number> {
    const start = getTime();
    let frames = 0;
    while ((getTime() - start) * 1000 < sampleMs) {
      await nextFrame();
      frames++;
    }
    return frames / Math.max(1e-3, getTime() - start);
  }

  static fmt(v: vec3): string {
    return `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`;
  }

  // ───────────────────────── interactions ─────────────────────────

  /** Pinch a UIKit button by its SceneObject name (NextButton / BackButton). */
  async tapButton(buttonName: string, settleMs: number = 250): Promise<void> {
    const button = TamagoLeafInteractor.findEnabledInteractable(buttonName);
    await this.trigger(button);
    await sleep(settleMs);
  }

  /** Pinch the timer ring (pause / resume). */
  async tapRing(settleMs: number = 300): Promise<void> {
    const ring = TamagoLeafInteractor.findEnabledInteractable("TimerRing");
    await this.trigger(ring);
    await sleep(settleMs);
  }
}
