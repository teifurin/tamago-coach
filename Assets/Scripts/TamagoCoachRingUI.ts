import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";

/**
 * TamagoCoachRingUI - the text that lives on the timer ring: the step number and remaining time
 * centred inside the ring, the pause glyph "II" over the number while paused, and the one-line
 * step title in the gap under the ring. Two FlexLayout columns (centre group, title group).
 *
 * Owns: SceneObjects RingStepNumberText / RingTimeText / RingPauseGlyph / RingTitleText.
 * Expects: to sit on the "RingText" child of TimerRing (same plane, slightly in front).
 * Must not: count time or decide pause - TamagoCoachMain pushes values through the setters.
 */
type TextWithWeight = Text & { weight?: number };

function styleText(t: Text, size: number, weight: number, color: vec4): void {
  t.size = size;
  (t as TextWithWeight).weight = weight;
  t.textFill.color = color;
  t.depthTest = true;
  t.horizontalAlignment = HorizontalAlignment.Center;
  t.verticalAlignment = VerticalAlignment.Center;
  t.horizontalOverflow = HorizontalOverflow.Overflow;
  t.verticalOverflow = VerticalOverflow.Overflow;
}

@component
export class TamagoCoachRingUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachRingUI – ring number, time, title, pause glyph</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Width/height of the centre text group, cm (fits inside the ring)")
  @widget(new SliderWidget(3, 12, 0.5))
  centerSizeCm: number = 6;

  @input
  @hint("How far below the ring centre the title line sits, cm")
  @widget(new SliderWidget(2, 10, 0.1))
  titleOffsetCm: number = 4.3;

  @input
  @hint("Step number / pause glyph text size")
  @widget(new SliderWidget(40, 140, 1))
  numberSize: number = 84;

  @input
  @hint("Remaining-time and title text size (54 keeps cap height >= 0.8 cm)")
  @widget(new SliderWidget(40, 100, 1))
  smallSize: number = 54;

  @input("vec4", "{1,1,1,1}")
  @hint("Step number colour")
  @widget(new ColorWidget())
  numberColor: vec4;

  @input("vec4", "{1,1,1,0.9}")
  @hint("Remaining-time colour")
  @widget(new ColorWidget())
  timeColor: vec4;

  @input("vec4", "{1,1,1,1}")
  @hint("Title colour")
  @widget(new ColorWidget())
  titleColor: vec4;

  @input("vec4", "{1,0.72,0.25,1}")
  @hint("Pause glyph colour")
  @widget(new ColorWidget())
  pauseColor: vec4;

  @input
  @hint("Text shown over the step number while paused")
  pauseGlyph: string = "II";
  @ui.group_end

  private numberText: Text | null = null;
  private timeText: Text | null = null;
  private titleText: Text | null = null;
  private glyphObject: SceneObject | null = null;
  private stepNumber = 1;
  private paused = false;

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas");

    // Centre group: number above time, both centred on the ring centre.
    const center = global.scene.createSceneObject("RingCenter");
    center.setParent(this.sceneObject);
    const col = center.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    col.width = this.centerSizeCm;
    col.height = this.centerSizeCm;
    col.direction = FlexDirection.Column;
    col.alignItems = FlexAlign.Stretch;
    col.justifyContent = FlexJustify.Center;
    col.rowGap = 0.1;

    const numberRow = this.addRow(center, "RingStepNumberText", this.numberSize, 700, this.numberColor, 2.2);
    this.numberText = numberRow.text;
    this.timeText = this.addRow(center, "RingTimeText", this.smallSize, 500, this.timeColor, 1.5).text;

    // Pause glyph rides on the number row (a child, so it follows the laid-out position).
    this.glyphObject = global.scene.createSceneObject("RingPauseGlyph");
    this.glyphObject.setParent(numberRow.object);
    this.glyphObject.getTransform().setLocalPosition(new vec3(0, 0, 0.05));
    const glyph = this.glyphObject.createComponent("Component.Text") as Text;
    glyph.text = this.pauseGlyph;
    styleText(glyph, this.numberSize, 700, this.pauseColor);
    glyph.layoutRect = Rect.create(-1.5, 1.5, -1.1, 1.1);
    this.glyphObject.enabled = false;

    // Title group under the ring.
    const titleGroup = global.scene.createSceneObject("RingTitleGroup");
    titleGroup.setParent(this.sceneObject);
    titleGroup.getTransform().setLocalPosition(new vec3(0, -this.titleOffsetCm, 0));
    const titleCol = titleGroup.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    titleCol.width = 16;
    titleCol.height = 1.8;
    titleCol.direction = FlexDirection.Column;
    titleCol.alignItems = FlexAlign.Stretch;
    titleCol.justifyContent = FlexJustify.Center;
    this.titleText = this.addRow(titleGroup, "RingTitleText", this.smallSize, 700, this.titleColor, 1.6).text;
  }

  /** 1-based step number shown in the middle of the ring. */
  setStepNumber(n: number): void {
    this.stepNumber = n;
    if (this.numberText && !this.paused) this.numberText.text = String(n);
  }

  /** Remaining time text, e.g. "0:30". Pass "" to hide it (Prep has no timer). */
  setTime(text: string): void {
    if (this.timeText) this.timeText.text = text;
  }

  setTitle(text: string): void {
    if (this.titleText) this.titleText.text = text;
  }

  /** Show the pause glyph instead of the step number. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.glyphObject) this.glyphObject.enabled = paused;
    if (this.numberText) this.numberText.text = paused ? "" : String(this.stepNumber);
  }

  private addRow(parent: SceneObject, name: string, size: number, weight: number, color: vec4, height: number): { object: SceneObject; text: Text } {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    const t = so.createComponent("Component.Text") as Text;
    t.text = "";
    styleText(t, size, weight, color);
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5);
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem;
    item.alignSelf = FlexAlignSelf.Stretch;
    item.overrideHeight = height;
    return { object: so, text: t };
  }
}
