import { TamagoCoachCardUI } from "./TamagoCoachCardUI";
import { TamagoCoachRingUI } from "./TamagoCoachRingUI";
import { TamagoCoachControlsUI } from "./TamagoCoachControlsUI";
import { TamagoCoachRingMesh } from "./TamagoCoachRingMesh";
import { TamagoCoachEgg } from "./TamagoCoachEgg";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

/**
 * TamagoCoachMain - the coaching state machine: six steps, auto-starting countdowns, pause,
 * Demo x10, the roll cue (card text + arrow), the chime, the egg log and the Done state.
 *
 * Owns: all step/timer state (single source of truth) and the orchestration of the views.
 * Expects (wired by the bootstrap): cardUI, ringUI, controlsUI, ringMesh, egg, rollArrow,
 *          chimeAudio (optional). Nothing is created in code except event subscriptions.
 * Must not: author UI or geometry - the views are passive and only receive setter calls.
 *
 * Test API (read-only unless noted): getStepIndex() 0-based, getStepTitle(), getRemainingSeconds()
 * (recipe seconds left on the ring), isPaused(), isRollCueActive(), isDemoSpeed(),
 * getLogThicknessCm(); drivers: setDemoSpeed(on), next(), back(), togglePause().
 * Prints: `[TamagoCoach] step=<i> title="<title>"` on every step change and
 *         `[TamagoCoach] zero step=<i> rollCue=<bool>` on every countdown zero.
 */
interface StepDef {
  title: string;
  instruction: string;
  tip: string;
  seconds: number;
  zeroInstruction: string;
  zeroTip: string;
  isLayer: boolean;
}

// Step texts verbatim from devpost/design-brief.md ("Steps and timers"). The card says less each layer.
const STEPS: StepDef[] = [
  {
    title: "Prep",
    instruction: "Beat 3 eggs with 1 tbsp sugar, 1 tsp soy sauce, a pinch of salt.",
    tip: "No timer. Pinch Next when the mix is ready.",
    seconds: 0,
    zeroInstruction: "",
    zeroTip: "",
    isLayer: false,
  },
  {
    title: "Heat",
    instruction: "Oil the pan, medium-low.",
    tip: "Tip: a drop of egg should sizzle softly.",
    seconds: 60,
    zeroInstruction: "Pan's ready. Pour 1/3 of the egg.",
    zeroTip: "Then pinch Next.",
    isLayer: false,
  },
  {
    title: "Layer 1",
    instruction: "Pour 1/3, tilt to cover, pop big bubbles.",
    tip: "Wait until the top is just barely wet.",
    seconds: 30,
    zeroInstruction: "Roll now",
    zeroTip: "Follow the arrow: from the far side toward you.",
    isLayer: true,
  },
  {
    title: "Layer 2",
    instruction: "Push the roll to the far side, oil, pour the next 1/3, lift the roll so egg flows under.",
    tip: "Same rhythm as before.",
    seconds: 30,
    zeroInstruction: "Roll now",
    zeroTip: "Far side toward you.",
    isLayer: true,
  },
  {
    title: "Layer 3",
    instruction: "Pour, wait, roll. You know this.",
    tip: "",
    seconds: 30,
    zeroInstruction: "Roll now",
    zeroTip: "",
    isLayer: true,
  },
  {
    title: "Rest & slice",
    instruction: "Shape it, let it rest.",
    tip: "",
    seconds: 120,
    zeroInstruction: "Done! You've learned the layer, pour, roll cycle.",
    zeroTip: "Slice into 6 pieces.",
    isLayer: false,
  },
];

@component
export class TamagoCoachMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachMain – step and timer state machine</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Step card UI module (StepCard / TamagoCoachCardUI)")
  cardUI: TamagoCoachCardUI;

  @input
  @hint("Ring text UI module (RingText / TamagoCoachRingUI)")
  ringUI: TamagoCoachRingUI;

  @input
  @hint("Next / Back / Demo x10 UI module (Controls / TamagoCoachControlsUI)")
  controlsUI: TamagoCoachControlsUI;

  @input
  @hint("Timer ring geometry + pinch (TimerRing / TamagoCoachRingMesh)")
  ringMesh: TamagoCoachRingMesh;

  @input
  @hint("Egg visuals (Egg / TamagoCoachEgg)")
  egg: TamagoCoachEgg;

  @input
  @hint("The roll arrow SceneObject (enabled only during a roll cue)")
  rollArrow: SceneObject;

  @input
  @allowUndefined
  @hint("AudioComponent on ChimeAudio (at the pan); drop a WAV on it if none is set")
  chimeAudio: AudioComponent;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Timer speed multiplier while Demo x10 is on")
  @widget(new SliderWidget(2, 20, 1))
  demoSpeedFactor: number = 10;

  @input
  @hint("Seconds after a countdown starts before the card collapses to ring + title (scaled by Demo)")
  @widget(new SliderWidget(0, 30, 0.5))
  cardCollapseSeconds: number = 6;

  @input
  @hint("Start with Demo x10 on")
  demoAtStart: boolean = false;

  @input
  @hint("0-based step to open at start (0 = Prep); a later step starts with the earlier layers already rolled - useful for testing")
  @widget(new SliderWidget(0, 5, 1))
  startAtStep: number = 0;

  @input
  @hint("Number of ring pulses at zero")
  @widget(new SliderWidget(1, 6, 1))
  pulseCount: number = 3;

  @input
  @hint("Play the chime as spatial audio at the pan (creates a runtime audio listener that follows the head)")
  spatialChime: boolean = true;

  @input
  @hint("Print the world bounds of every mesh under this object 1 s after start (layout check)")
  debugBounds: boolean = false;
  @ui.group_end

  private stepIndex = 0;
  private durationSeconds = 0;
  private remainingSeconds = 0;
  private running = false;
  private paused = false;
  private atZero = false;
  private rollCue = false;
  private demo = false;
  private rolls = 0;
  private done = false;
  private collapseCountdown = -1;
  private listenerObject: SceneObject | null = null;
  private headTransform: Transform | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start());
    this.createEvent("UpdateEvent").bind(() => this.update());
  }

  // ───────────────────────── public test / driver API ─────────────────────────

  getStepIndex(): number {
    return this.stepIndex;
  }
  getStepTitle(): string {
    return STEPS[this.stepIndex].title;
  }
  getRemainingSeconds(): number {
    return this.running || this.atZero ? Math.max(0, this.remainingSeconds) : 0;
  }
  isPaused(): boolean {
    return this.paused;
  }
  isRollCueActive(): boolean {
    return this.rollCue;
  }
  isDemoSpeed(): boolean {
    return this.demo;
  }
  getLogThicknessCm(): number {
    return this.egg ? this.egg.getLogThicknessCm() : 0;
  }
  isDone(): boolean {
    return this.done;
  }

  setDemoSpeed(on: boolean): void {
    if (this.demo === on) return; // idempotent, so a UI echo of our own setDemo() can never loop
    this.demo = on;
    if (this.controlsUI) this.controlsUI.setDemo(on);
  }

  /** Advance one step (after a roll cue the layer joins the log). At Done, restarts at Prep. */
  next(): void {
    if (this.rollCue) {
      this.rolls = Math.min(3, this.rolls + 1);
      if (this.egg) this.egg.setRolls(this.rolls);
    }
    if (this.done || this.stepIndex >= STEPS.length - 1) {
      if (this.done) this.enterStep(0);
      return;
    }
    this.enterStep(this.stepIndex + 1);
  }

  back(): void {
    if (this.stepIndex > 0) this.enterStep(this.stepIndex - 1);
  }

  /** Pause or resume the running countdown (no effect without a countdown). */
  togglePause(): void {
    if (!this.running || this.atZero) return;
    this.paused = !this.paused;
    if (this.ringUI) this.ringUI.setPaused(this.paused);
    if (this.ringMesh) this.ringMesh.setPaused(this.paused);
  }

  // ───────────────────────── lifecycle ─────────────────────────

  private start(): void {
    const missing: string[] = [];
    if (!this.cardUI) missing.push("cardUI");
    if (!this.ringUI) missing.push("ringUI");
    if (!this.controlsUI) missing.push("controlsUI");
    if (!this.ringMesh) missing.push("ringMesh");
    if (!this.egg) missing.push("egg");
    if (!this.rollArrow) missing.push("rollArrow");
    if (missing.length > 0) {
      print("[TamagoCoach] required @input not wired: " + missing.join(", ") + " (check Phase B wiring)");
    }
    if (this.controlsUI) {
      this.controlsUI.onNext.add(() => this.next());
      this.controlsUI.onBack.add(() => this.back());
      this.controlsUI.onDemoChanged.add((on: boolean) => this.setDemoSpeed(on));
    }
    if (this.ringMesh) this.ringMesh.onPinch.add(() => this.togglePause());
    if (this.chimeAudio) {
      this.chimeAudio.spatialAudio.enabled = this.spatialChime;
      if (!this.chimeAudio.audioTrack) print("[TamagoCoach] ChimeAudio has no audio track yet - the chime is silent.");
      if (this.spatialChime) {
        // Spatial audio needs an AudioListener at the head. The Camera Object is left untouched;
        // a runtime-only listener object follows the head transform every frame instead.
        this.headTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform();
        this.listenerObject = global.scene.createSceneObject("TamagoCoachAudioListener");
        this.listenerObject.createComponent("Component.AudioListenerComponent");
        this.followHead();
      }
    }
    if (this.demoAtStart) this.setDemoSpeed(true);
    if (this.debugBounds) {
      const delayed = this.createEvent("DelayedCallbackEvent");
      delayed.bind(() => this.printBounds(this.sceneObject, 0));
      delayed.reset(1.0);
    }
    const first = Math.max(0, Math.min(STEPS.length - 1, Math.round(this.startAtStep)));
    // Opening at a later step implies the earlier layers were rolled (Layer 2 = one log, ...).
    this.rolls = Math.max(0, Math.min(3, first - 2));
    if (this.egg) this.egg.setRolls(this.rolls);
    this.enterStep(first);
  }

  private enterStep(index: number): void {
    const step = STEPS[index];
    this.stepIndex = index;
    this.atZero = false;
    this.rollCue = false;
    this.paused = false;
    this.done = false;
    if (index === 0) {
      this.rolls = 0;
      if (this.egg) this.egg.setRolls(0);
    }
    if (this.rollArrow) this.rollArrow.enabled = false;
    if (this.egg) {
      this.egg.showSlices(false);
      this.egg.showLayer(step.isLayer);
      this.egg.setReadiness(0);
    }
    if (this.cardUI) {
      this.cardUI.setStepNumber(index + 1);
      this.cardUI.setContent(step.title, step.instruction, step.tip);
      this.cardUI.expand();
    }
    if (this.ringUI) {
      this.ringUI.setPaused(false);
      this.ringUI.setStepNumber(index + 1);
      this.ringUI.setTitle(step.title);
      this.ringUI.setTitleVisible(false); // view only: the expanded card already shows the title
      this.ringUI.setCenterVisible(step.seconds > 0); // view only: no lonely number without a countdown
    }
    if (this.ringMesh) this.ringMesh.setPaused(false);

    if (step.seconds > 0) {
      this.durationSeconds = step.seconds;
      this.remainingSeconds = step.seconds;
      this.running = true;
      this.collapseCountdown = this.cardCollapseSeconds;
      if (this.ringMesh) {
        this.ringMesh.setVisible(true);
        this.ringMesh.setFraction(1);
      }
      if (this.ringUI) this.ringUI.setTime(this.formatTime(this.remainingSeconds));
    } else {
      this.durationSeconds = 0;
      this.remainingSeconds = 0;
      this.running = false;
      this.collapseCountdown = -1;
      if (this.ringMesh) this.ringMesh.setVisible(false);
      if (this.ringUI) this.ringUI.setTime("");
    }
    print('[TamagoCoach] step=' + index + ' title="' + step.title + '"');
  }

  private followHead(): void {
    if (!this.listenerObject || !this.headTransform) return;
    const t = this.listenerObject.getTransform();
    t.setWorldPosition(this.headTransform.getWorldPosition());
    t.setWorldRotation(this.headTransform.getWorldRotation());
  }

  private update(): void {
    this.followHead();
    if (!this.running || this.paused || this.atZero) return;
    const rate = this.demo ? this.demoSpeedFactor : 1;
    const dt = getDeltaTime() * rate;
    this.remainingSeconds -= dt;

    if (this.collapseCountdown >= 0) {
      this.collapseCountdown -= dt;
      if (this.collapseCountdown < 0) {
        if (this.cardUI) this.cardUI.collapse();
        if (this.ringUI) this.ringUI.setTitleVisible(true); // view only: card collapsed, ring shows the title
      }
    }

    const step = STEPS[this.stepIndex];
    const fraction = this.durationSeconds > 0 ? Math.max(0, this.remainingSeconds / this.durationSeconds) : 0;
    if (this.ringUI) this.ringUI.setTime(this.formatTime(Math.max(0, this.remainingSeconds)));
    if (this.ringMesh) this.ringMesh.setFraction(fraction);
    if (step.isLayer && this.egg) this.egg.setReadiness(1 - fraction);

    if (this.remainingSeconds <= 0) this.onZero();
  }

  private onZero(): void {
    const step = STEPS[this.stepIndex];
    this.remainingSeconds = 0;
    this.atZero = true;
    this.running = false;
    this.collapseCountdown = -1;
    if (this.ringUI) this.ringUI.setTime(this.formatTime(0));
    if (this.ringMesh) {
      this.ringMesh.setFraction(0);
      this.ringMesh.pulse(this.pulseCount);
    }
    if (this.chimeAudio && this.chimeAudio.audioTrack) this.chimeAudio.play(1);
    if (this.cardUI) {
      this.cardUI.setInstruction(step.zeroInstruction);
      this.cardUI.setTip(step.zeroTip);
      this.cardUI.expand();
    }
    if (this.ringUI) this.ringUI.setTitleVisible(false); // view only: the card is expanded again
    if (step.isLayer) {
      this.rollCue = true;
      if (this.rollArrow) this.rollArrow.enabled = true;
      if (this.egg) this.egg.setReadiness(1);
    }
    if (this.stepIndex === STEPS.length - 1) {
      this.done = true;
      if (this.egg) this.egg.showSlices(true);
    }
    print("[TamagoCoach] zero step=" + this.stepIndex + " rollCue=" + this.rollCue);
  }

  /** m:ss, rounded up so the ring shows the full value at the start and 0:00 only at zero. */
  private formatTime(seconds: number): string {
    const total = Math.max(0, Math.ceil(seconds - 1e-6));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ":" + (s < 10 ? "0" + s : String(s));
  }

  private printBounds(obj: SceneObject, depth: number): void {
    const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null;
    if (rmv && obj.enabled) {
      const a = rmv.worldAabbMin();
      const b = rmv.worldAabbMax();
      print(
        "[TamagoCoach bounds] " + obj.name +
          " min=(" + a.x.toFixed(1) + "," + a.y.toFixed(1) + "," + a.z.toFixed(1) + ")" +
          " max=(" + b.x.toFixed(1) + "," + b.y.toFixed(1) + "," + b.z.toFixed(1) + ")",
      );
    }
    for (let i = 0; i < obj.getChildrenCount(); i++) this.printBounds(obj.getChild(i), depth + 1);
  }
}
