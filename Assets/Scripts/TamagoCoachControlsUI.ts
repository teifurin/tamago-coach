import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { Switch } from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch";
import { RoundedRectangleVisual } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import { GradientParameters } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";

/**
 * TamagoCoachControlsUI - the Next and Back UIKit buttons (a bottom-anchored column on this
 * object) and the "Demo x10" row (label + UIKit switch) built under the authored DemoSwitchAnchor.
 *
 * Owns: SceneObjects NextButton / BackButton / DemoContent / DemoLabel / DemoSwitch and the labels.
 * Expects: `demoSwitchAnchor` (authored, tilted like this object); if missing the demo row is
 *          built under this object below the buttons.
 * Must not: hold step state - it emits onNext / onBack / onDemoChanged and mirrors setDemo().
 *
 * Look: both buttons are UIKit Buttons (theme SnapOS2, shape Rectangle) whose RoundedRectangleVisual
 * is recoloured after initialisation - Next in yolk with a dark label, Back as a dark plate with a
 * white label. Hover scales a button 1.0 -> hoverScale (ease-out, never a position change); the
 * brighter hovered gradient is the glow. The ButtonsContent column, button sizes and gap are the
 * tc-06 contract and stay as authored.
 */
const BUTTON_LABEL_Z = 0.08;

type HoverTween = { transform: Transform; from: number; to: number; t: number; active: boolean };

function flatGradient(top: vec4, bottom: vec4): GradientParameters {
  return {
    enabled: true,
    type: "Linear",
    start: new vec2(0, 1),
    end: new vec2(0, -1),
    stop0: { enabled: true, percent: 0, color: top },
    stop1: { enabled: true, percent: 1, color: bottom },
  };
}

function shade(c: vec4, k: number): vec4 {
  return new vec4(c.x * k, c.y * k, c.z * k, c.w);
}

function lighten(c: vec4, k: number): vec4 {
  return new vec4(c.x + (1 - c.x) * k, c.y + (1 - c.y) * k, c.z + (1 - c.z) * k, c.w);
}

@component
export class TamagoCoachControlsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachControlsUI – Next, Back, Demo x10</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Authored anchor at the far-left corner of the counter for the Demo x10 row")
  demoSwitchAnchor: SceneObject;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Layout</span>')
  @ui.group_start("Layout")
  @input("vec2", "{8,6}")
  @hint("Next button size, cm (width, height) - tc-06 contract")
  nextSizeCm: vec2;

  @input("vec2", "{6,4}")
  @hint("Back button size, cm (width, height) - tc-06 contract")
  backSizeCm: vec2;

  @input
  @hint("Gap between the Next and Back buttons, cm - tc-06 contract")
  @widget(new SliderWidget(0, 5, 0.1))
  buttonGapCm: number = 1.2;

  @input
  @hint("Corner radius of both buttons, cm")
  @widget(new SliderWidget(0, 3, 0.1))
  cornerRadiusCm: number = 1.2;

  @input
  @hint("Border thickness of both buttons, cm")
  @widget(new SliderWidget(0, 0.5, 0.01))
  borderCm: number = 0.15;

  @input
  @hint("Button scale while hovered (1 = no scale change)")
  @widget(new SliderWidget(1, 1.3, 0.01))
  hoverScale: number = 1.05;

  @input
  @hint("Hover scale tween length, seconds (ease-out)")
  @widget(new SliderWidget(0, 0.5, 0.01))
  hoverSeconds: number = 0.12;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Next button</span>')
  @ui.group_start("Next")
  @input
  @hint("Label on the Next button")
  nextLabel: string = "Next ›";

  @input
  @hint("Next label text size (em-square; 60 ~ 1 cm cap height)")
  @widget(new SliderWidget(40, 100, 1))
  labelSize: number = 60;

  @input("vec4", "{0.12,0.12,0.14,1}")
  @hint("Next label colour (dark on yolk)")
  @widget(new ColorWidget())
  nextLabelColor: vec4;

  @input("vec4", "{1,0.78,0.2,1}")
  @hint("Next plate colour, top gradient stop (yolk)")
  @widget(new ColorWidget())
  nextColor: vec4;

  @input("vec4", "{0.98,0.72,0.16,1}")
  @hint("Next plate colour, bottom gradient stop")
  @widget(new ColorWidget())
  nextColorBottom: vec4;

  @input("vec4", "{1,0.86,0.38,1}")
  @hint("Next plate colour while hovered (the glow)")
  @widget(new ColorWidget())
  nextHoverColor: vec4;

  @input("vec4", "{0.9,0.66,0.12,1}")
  @hint("Next plate colour while pinched")
  @widget(new ColorWidget())
  nextPressColor: vec4;

  @input("vec4", "{1,0.95,0.8,1}")
  @hint("Next border colour")
  @widget(new ColorWidget())
  nextBorderColor: vec4;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Back button</span>')
  @ui.group_start("Back")
  @input
  @hint("Label on the Back button")
  backLabel: string = "‹ Back";

  @input
  @hint("Back label text size")
  @widget(new SliderWidget(40, 100, 1))
  backLabelSize: number = 56;

  @input("vec4", "{1,1,1,1}")
  @hint("Back label colour")
  @widget(new ColorWidget())
  backLabelColor: vec4;

  @input("vec4", "{0.16,0.17,0.19,1}")
  @hint("Back plate colour (dark, opaque)")
  @widget(new ColorWidget())
  backColor: vec4;

  @input("vec4", "{0.26,0.27,0.30,1}")
  @hint("Back plate colour while hovered")
  @widget(new ColorWidget())
  backHoverColor: vec4;

  @input("vec4", "{0.78,0.78,0.80,1}")
  @hint("Back border colour")
  @widget(new ColorWidget())
  backBorderColor: vec4;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Demo x10 row</span>')
  @ui.group_start("Demo")
  @input
  @hint("Label next to the demo-speed switch")
  demoLabel: string = "Demo ×10";

  @input
  @hint("Demo label text size")
  @widget(new SliderWidget(30, 100, 1))
  demoLabelSize: number = 44;

  @input
  @hint("Width reserved for the demo label, cm (the switch follows after the gap)")
  @widget(new SliderWidget(2, 10, 0.1))
  demoLabelWidthCm: number = 4.6;

  @input
  @hint("Sideways shift of the demo row from the anchor, cm (+ = toward the counter centre, so the label stays on the counter)")
  @widget(new SliderWidget(-10, 10, 0.5))
  demoRowShiftCm: number = 3;

  @input("vec4", "{1,1,1,0.7}")
  @hint("Demo label colour")
  @widget(new ColorWidget())
  demoLabelColor: vec4;

  @input("vec4", "{1,0.78,0.2,1}")
  @hint("Switch knob colour while Demo x10 is on (yolk)")
  @widget(new ColorWidget())
  knobOnColor: vec4;
  @ui.group_end

  private onNextEvent = new Event<void>();
  private onBackEvent = new Event<void>();
  private onDemoChangedEvent = new Event<boolean>();
  private demoSwitch: Switch | null = null;
  private tweens: HoverTween[] = [];

  get onNext(): PublicApi<void> {
    return this.onNextEvent.publicApi();
  }
  get onBack(): PublicApi<void> {
    return this.onBackEvent.publicApi();
  }
  /** Fires with the new state when the user flips the Demo x10 switch. */
  get onDemoChanged(): PublicApi<boolean> {
    return this.onDemoChangedEvent.publicApi();
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas");

    // Buttons column, bottom-anchored at this object's origin (tc-06 contract: unchanged).
    const colW = Math.max(this.nextSizeCm.x, this.backSizeCm.x) + 1;
    const colH = this.nextSizeCm.y + this.buttonGapCm + this.backSizeCm.y;
    const buttons = global.scene.createSceneObject("ButtonsContent");
    buttons.setParent(this.sceneObject);
    buttons.getTransform().setLocalPosition(new vec3(0, colH / 2, 0));
    const col = buttons.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    col.width = colW;
    col.height = colH;
    col.direction = FlexDirection.Column;
    col.alignItems = FlexAlign.Center;
    col.justifyContent = FlexJustify.Start;
    col.rowGap = this.buttonGapCm;

    const next = this.addButton(buttons, "NextButton", this.nextSizeCm, "Primary", () => this.onNextEvent.invoke());
    this.addRowText(next.sceneObject, "NextButtonLabel", this.nextLabel, this.nextSizeCm.x - 0.5, BUTTON_LABEL_Z, this.labelSize, 700, this.nextLabelColor);
    this.styleButton(next, this.nextColor, this.nextColorBottom, this.nextHoverColor, this.nextPressColor, this.nextBorderColor);

    const back = this.addButton(buttons, "BackButton", this.backSizeCm, "PrimaryNeutral", () => this.onBackEvent.invoke());
    this.addRowText(back.sceneObject, "BackButtonLabel", this.backLabel, this.backSizeCm.x - 0.5, BUTTON_LABEL_Z, this.backLabelSize, 500, this.backLabelColor);
    this.styleButton(back, this.backColor, shade(this.backColor, 0.94), this.backHoverColor, shade(this.backColor, 0.8), this.backBorderColor);

    // Demo x10 row (label on the left, switch on the right, same baseline) under the authored
    // anchor (fallback: under this object, below the buttons).
    const demoW = 10;
    const demoH = 2.6;
    let host: SceneObject = this.sceneObject;
    let groupY = -3.0 - demoH / 2;
    if (this.demoSwitchAnchor) {
      host = this.demoSwitchAnchor;
      host.createComponent("Component.Canvas");
      groupY = demoH / 2;
    }
    const row = global.scene.createSceneObject("DemoContent");
    row.setParent(host);
    row.getTransform().setLocalPosition(new vec3(this.demoRowShiftCm, groupY, 0));
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    rowFlex.width = demoW;
    rowFlex.height = demoH;
    rowFlex.direction = FlexDirection.Row;
    rowFlex.alignItems = FlexAlign.Center;
    rowFlex.justifyContent = FlexJustify.Center;
    rowFlex.columnGap = 0.6;

    this.addRowText(row, "DemoLabel", this.demoLabel, this.demoLabelWidthCm, 0, this.demoLabelSize, 500, this.demoLabelColor);

    const switchSO = global.scene.createSceneObject("DemoSwitch");
    switchSO.setParent(row);
    const sw = switchSO.createComponent(Switch.getTypeName()) as Switch;
    sw.size = new vec3(4, 2, 1); // BEFORE init
    sw.isOn = false;
    // UIKit 2.0.0: onFinished's boolean is the `explicit` flag (true = user interaction, false = a
    // programmatic isOn change), NOT the switch state. Read the state from the switch itself and
    // ignore the echo of our own setDemo(), so Main -> UI -> Main cannot loop or flicker.
    sw.onFinished.add((explicit: boolean) => {
      if (explicit) this.onDemoChangedEvent.invoke(sw.isOn);
    });
    // Yolk knob while on (the SnapOS2 track keeps its own on/off look).
    sw.onInitialized.add(() => {
      const knob = sw.knobVisual;
      if (knob instanceof RoundedRectangleVisual) {
        knob.toggledDefaultBaseType = "Gradient";
        knob.toggledHoveredBaseType = "Gradient";
        knob.toggledTriggeredBaseType = "Gradient";
        knob.toggledDefaultGradient = flatGradient(this.knobOnColor, shade(this.knobOnColor, 0.9));
        knob.toggledHoveredGradient = flatGradient(lighten(this.knobOnColor, 0.25), lighten(this.knobOnColor, 0.1));
        knob.toggledTriggeredGradient = flatGradient(shade(this.knobOnColor, 0.9), shade(this.knobOnColor, 0.8));
      }
    });
    switchSO.createComponent(FlexItem.getTypeName());
    this.demoSwitch = sw;

    this.createEvent("UpdateEvent").bind(() => this.updateTweens());
  }

  /** Mirror a programmatic demo-speed change on the switch (no event is emitted). */
  setDemo(on: boolean): void {
    if (this.demoSwitch && this.demoSwitch.isOn !== on) this.demoSwitch.isOn = on;
  }

  private addButton(parent: SceneObject, name: string, size: vec2, style: string, onClick: () => void): Button {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    const btn = so.createComponent(Button.getTypeName()) as Button;
    btn.setVariant({ theme: "SnapOS2", shape: "Rectangle", style }); // BEFORE init
    btn.size = new vec3(size.x, size.y, 1); // BEFORE init
    so.createComponent(FlexItem.getTypeName());
    btn.onTriggerUp.add(() => onClick());
    const tween: HoverTween = { transform: so.getTransform(), from: 1, to: 1, t: 0, active: false };
    this.tweens.push(tween);
    btn.onHoverEnter.add(() => this.startScaleTween(tween, this.hoverScale));
    btn.onHoverExit.add(() => this.startScaleTween(tween, 1));
    return btn;
  }

  /** Recolour a button's RoundedRectangleVisual once it exists (after the button initialises). */
  private styleButton(btn: Button, top: vec4, bottom: vec4, hovered: vec4, pressed: vec4, border: vec4): void {
    btn.onInitialized.add(() => {
      const vis = btn.visual;
      if (!(vis instanceof RoundedRectangleVisual)) {
        print("[TamagoCoachControlsUI] " + btn.sceneObject.name + ": visual is not a RoundedRectangleVisual, theme colours kept");
        return;
      }
      vis.defaultBaseType = "Gradient";
      vis.hoveredBaseType = "Gradient";
      vis.triggeredBaseType = "Gradient";
      vis.defaultGradient = flatGradient(top, bottom);
      vis.hoveredGradient = flatGradient(hovered, shade(hovered, 0.94));
      vis.triggeredGradient = flatGradient(pressed, shade(pressed, 0.94));
      const hasBorder = this.borderCm > 0;
      vis.defaultHasBorder = hasBorder;
      vis.hoveredHasBorder = hasBorder;
      vis.triggeredHasBorder = hasBorder;
      vis.defaultBorderSize = this.borderCm;
      vis.hoveredBorderSize = this.borderCm;
      vis.triggeredBorderSize = this.borderCm;
      vis.defaultBorderType = "Color";
      vis.hoveredBorderType = "Color";
      vis.triggeredBorderType = "Color";
      vis.borderDefaultColor = border;
      vis.borderHoveredColor = border;
      vis.borderTriggeredColor = border;
      vis.cornerRadius = this.cornerRadiusCm;
    });
  }

  private addRowText(parent: SceneObject, name: string, text: string, widthCm: number, zLift: number, size: number, weight: number, color: vec4): Text {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    so.getTransform().setLocalPosition(new vec3(0, 0, zLift));
    const t = so.createComponent("Component.Text") as Text;
    t.text = text;
    t.size = size;
    t.weight = weight;
    t.textFill.color = color;
    t.depthTest = true;
    t.horizontalAlignment = HorizontalAlignment.Center;
    t.verticalAlignment = VerticalAlignment.Center;
    t.horizontalOverflow = HorizontalOverflow.Overflow;
    t.verticalOverflow = VerticalOverflow.Overflow;
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.2, 1.2);
    so.createComponent(FlexItem.getTypeName());
    return t;
  }

  // ───────────── hover scale tween (scale only, never position) ─────────────

  private startScaleTween(tween: HoverTween, to: number): void {
    tween.from = tween.transform.getLocalScale().x;
    tween.to = to;
    tween.t = 0;
    tween.active = Math.abs(tween.from - to) > 1e-4;
  }

  private updateTweens(): void {
    const dt = getDeltaTime();
    for (const tween of this.tweens) {
      if (!tween.active) continue;
      tween.t += dt;
      const p = this.hoverSeconds > 0 ? Math.min(1, tween.t / this.hoverSeconds) : 1;
      const eased = 1 - (1 - p) * (1 - p);
      const s = tween.from + (tween.to - tween.from) * eased;
      tween.transform.setLocalScale(new vec3(s, s, s));
      if (p >= 1) tween.active = false;
    }
  }
}
