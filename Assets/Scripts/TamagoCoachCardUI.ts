import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { RoundedRectangle, RoundedRectBlendMode } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";

/**
 * TamagoCoachCardUI - the step card: a translucent UIKit RoundedRectangle plate (the "Frame" look
 * without window chrome - no close/follow buttons, no drag) with a yolk accent line along its top
 * edge and a FlexLayout column of left-aligned text rows: a header ROW ("Step 1 ·" + title), the
 * instruction (up to three lines) and the tip (up to two lines).
 *
 * Owns: SceneObjects CardStepText / CardTitleText / CardInstructionText / CardTipText, the
 *       CardAccent line and the expand/collapse animation of this (StepCard) object.
 * Expects: nothing wired; TamagoCoachMain pushes text through the setters below.
 * Must not: hold step state or decide when to expand - it is a passive view.
 *
 * LEAF contract: CardTitleText.text is exactly the bare step title; the "Step N ·" prefix lives in
 * the separate CardStepText object. Text sizes are em-square sizes (cm = size / 43.886).
 */
const EM_CM_PER_SIZE = 1 / 43.886; // em-square height in cm per text-size unit
const LINE_FACTOR = 1.3; // row height per line, as a multiple of the em square (room for descenders)

function lineHeightCm(size: number, lines: number): number {
  return size * EM_CM_PER_SIZE * LINE_FACTOR * lines;
}

function styleText(t: Text, size: number, weight: number, color: vec4, wrap: boolean): void {
  t.size = size;
  t.weight = weight;
  t.textFill.color = color;
  t.depthTest = true;
  t.horizontalAlignment = HorizontalAlignment.Left;
  t.verticalAlignment = VerticalAlignment.Center;
  t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow;
  t.verticalOverflow = VerticalOverflow.Overflow;
}

@component
export class TamagoCoachCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachCardUI – step card (step · title, instruction, tip)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Plate</span>')
  @ui.group_start("Plate")
  @input
  @hint("Card width, cm")
  @widget(new SliderWidget(10, 40, 0.5))
  widthCm: number = 24;

  @input
  @hint("Card height, cm")
  @widget(new SliderWidget(6, 30, 0.5))
  heightCm: number = 12;

  @input
  @hint("Corner radius of the plate, cm")
  @widget(new SliderWidget(0, 4, 0.1))
  cornerRadiusCm: number = 1.5;

  @input("vec4", "{0.08,0.09,0.11,1}")
  @hint("Plate colour (dark; the additive display renders dark colours as nearly transparent)")
  @widget(new ColorWidget())
  plateColor: vec4;

  @input
  @hint("Plate opacity (blend mode Normal)")
  @widget(new SliderWidget(0, 1, 0.05))
  plateOpacity: number = 0.7;

  @input
  @hint("Inset border thickness, cm (0 = no border)")
  @widget(new SliderWidget(0, 0.5, 0.01))
  borderCm: number = 0.15;

  @input("vec4", "{1,1,1,0.36}")
  @hint("Border colour; its alpha is multiplied by the plate opacity (0.36 x 0.7 = 25 % white)")
  @widget(new ColorWidget())
  borderColor: vec4;

  @input("vec4", "{1,0.78,0.2,1}")
  @hint("Yolk accent line along the top edge")
  @widget(new ColorWidget())
  accentColor: vec4;

  @input
  @hint("Accent line thickness, cm")
  @widget(new SliderWidget(0.1, 1, 0.05))
  accentCm: number = 0.3;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Text</span>')
  @ui.group_start("Text")
  @input
  @hint("Header row text size (step prefix and title; em-square, 43.886 = 1 cm)")
  @widget(new SliderWidget(40, 120, 1))
  titleSize: number = 56;

  @input
  @hint("Instruction text size")
  @widget(new SliderWidget(40, 100, 1))
  bodySize: number = 50;

  @input
  @hint("Tip text size")
  @widget(new SliderWidget(30, 100, 1))
  tipSize: number = 44;

  @input
  @hint("Width reserved for the step prefix in the header row, cm (left-aligned; the title follows after the gap)")
  @widget(new SliderWidget(3, 10, 0.1))
  stepWidthCm: number = 4.4;

  @input
  @hint("Format of the step prefix; {n} is the 1-based step number")
  stepFormat: string = "Step {n} ·";

  @input("vec4", "{1,0.78,0.2,1}")
  @hint("Step prefix colour (yolk)")
  @widget(new ColorWidget())
  stepColor: vec4;

  @input("vec4", "{1,1,1,1}")
  @hint("Title colour")
  @widget(new ColorWidget())
  titleColor: vec4;

  @input("vec4", "{1,1,1,1}")
  @hint("Instruction colour")
  @widget(new ColorWidget())
  textColor: vec4;

  @input("vec4", "{1,1,1,0.6}")
  @hint("Tip colour (dimmer secondary text)")
  @widget(new ColorWidget())
  tipColor: vec4;

  @input
  @hint("Side padding of the text column, cm")
  @widget(new SliderWidget(0, 3, 0.1))
  sidePaddingCm: number = 0.8;

  @input
  @hint("Expand/collapse animation length, seconds")
  @widget(new SliderWidget(0, 1, 0.05))
  animateSeconds: number = 0.2;
  @ui.group_end

  private stepText: Text | null = null;
  private titleText: Text | null = null;
  private instructionText: Text | null = null;
  private tipText: Text | null = null;
  private expanded = true;
  private animating = false;
  private animFrom = 1;
  private animTo = 1;
  private animT = 0;
  private disableWhenDone = false;

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas");

    // Plate first so the hierarchy DFS paints it behind everything else on the card.
    const plate = this.sceneObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle;
    plate.size = new vec2(this.widthCm, this.heightCm);
    plate.cornerRadius = this.cornerRadiusCm;
    plate.backgroundColor = this.plateColor;
    plate.border = this.borderCm > 0;
    plate.borderSize = this.borderCm;
    plate.borderColor = this.borderColor;
    plate.blendMode = RoundedRectBlendMode.Normal;
    plate.opacity = this.plateOpacity;
    plate.initialize();

    // Yolk accent line along the top edge, shortened so its ends stay inside the rounded corners.
    const accent = global.scene.createSceneObject("CardAccent");
    accent.setParent(this.sceneObject);
    accent.getTransform().setLocalPosition(new vec3(0, this.heightCm / 2 - this.accentCm / 2, 0.05));
    const inset = Math.max(0, this.cornerRadiusCm - this.accentCm);
    const line = accent.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle;
    line.size = new vec2(Math.max(1, this.widthCm - 2 * inset), this.accentCm);
    line.cornerRadius = this.accentCm / 2;
    line.backgroundColor = this.accentColor;
    line.border = false;
    line.blendMode = RoundedRectBlendMode.Disabled;
    line.opacity = 1;
    line.initialize();

    // Text column, lifted in front of the plate.
    const content = global.scene.createSceneObject("Content");
    content.setParent(this.sceneObject);
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6));

    const innerW = this.widthCm - 2 * this.sidePaddingCm;
    const headerH = lineHeightCm(this.titleSize, 1);
    const bodyH = lineHeightCm(this.bodySize, 3);
    const tipH = lineHeightCm(this.tipSize, 2);

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    flex.autoDiscoverItemsOnStart = false; // items are registered explicitly below
    flex.width = this.widthCm;
    flex.height = this.heightCm;
    flex.direction = FlexDirection.Column;
    flex.alignItems = FlexAlign.Stretch;
    flex.justifyContent = FlexJustify.Start;
    flex.rowGap = 0.3;
    flex.paddingTop = this.accentCm + 0.5;
    flex.paddingBottom = 0.3;
    flex.paddingLeft = this.sidePaddingCm;
    flex.paddingRight = this.sidePaddingCm;

    // Header row: "Step 1 ·" (fixed width, yolk) then the bare title (grows to the rest of the row).
    const header = global.scene.createSceneObject("CardHeaderRow");
    header.setParent(content);
    const headerItem = header.createComponent(FlexItem.getTypeName()) as FlexItem;
    headerItem.alignSelf = FlexAlignSelf.Stretch;
    headerItem.overrideHeight = headerH;
    const row = header.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    row.autoDiscoverItemsOnStart = false;
    row.width = innerW;
    row.height = headerH;
    row.direction = FlexDirection.Row;
    row.alignItems = FlexAlign.Center;
    row.justifyContent = FlexJustify.Start;
    row.columnGap = 0.4;

    const step = this.addText(header, "CardStepText", this.titleSize, 700, this.stepColor, false, this.stepWidthCm, headerH);
    step.item.overrideWidth = this.stepWidthCm;
    step.item.overrideHeight = headerH;
    this.stepText = step.text;
    const title = this.addText(header, "CardTitleText", this.titleSize, 700, this.titleColor, false, 1, headerH);
    title.item.flexGrow = 1;
    title.item.overrideHeight = headerH;
    this.titleText = title.text;
    row.addItems([step.item, title.item]);

    // Body and tip rows: fixed bands (3 and 2 lines) so wrapped text never collides with its neighbours.
    const body = this.addText(content, "CardInstructionText", this.bodySize, 500, this.textColor, true, 1, 1);
    body.item.alignSelf = FlexAlignSelf.Stretch;
    body.item.overrideHeight = bodyH;
    this.instructionText = body.text;
    const tip = this.addText(content, "CardTipText", this.tipSize, 400, this.tipColor, true, 1, 1);
    tip.item.alignSelf = FlexAlignSelf.Stretch;
    tip.item.overrideHeight = tipH;
    this.tipText = tip.text;
    flex.addItems([headerItem, body.item, tip.item]);

    this.createEvent("UpdateEvent").bind(() => this.animate());
  }

  /** Replace the title, instruction and tip (a new step). */
  setContent(title: string, instruction: string, tip: string): void {
    this.setTitle(title);
    this.setInstruction(instruction);
    this.setTip(tip);
  }

  /** 1-based step number shown as the "Step N ·" prefix in front of the title. */
  setStepNumber(n: number): void {
    if (this.stepText) this.stepText.text = this.stepFormat.replace("{n}", String(n));
  }

  setTitle(text: string): void {
    if (this.titleText) this.titleText.text = text;
  }

  setInstruction(text: string): void {
    if (this.instructionText) this.instructionText.text = text;
  }

  setTip(text: string): void {
    if (this.tipText) this.tipText.text = text;
  }

  /** Show the card (bloom in). Safe to call while already expanded. */
  expand(): void {
    if (!this.sceneObject.enabled) this.sceneObject.enabled = true;
    this.expanded = true;
    this.disableWhenDone = false;
    this.startAnimation(this.currentScale(), 1);
  }

  /** Shrink the card away, then disable it (ring + title stay visible). */
  collapse(): void {
    if (!this.expanded) return;
    this.expanded = false;
    this.disableWhenDone = true;
    this.startAnimation(this.currentScale(), 0.05);
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  private addText(
    parent: SceneObject,
    name: string,
    size: number,
    weight: number,
    color: vec4,
    wrap: boolean,
    rectW: number,
    rectH: number,
  ): { text: Text; item: FlexItem } {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    const t = so.createComponent("Component.Text") as Text;
    t.text = "";
    styleText(t, size, weight, color, wrap);
    t.layoutRect = Rect.create(-rectW / 2, rectW / 2, -rectH / 2, rectH / 2); // the layout rewrites this to the allocated cell
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem;
    return { text: t, item };
  }

  private currentScale(): number {
    return this.getTransform().getLocalScale().x;
  }

  private startAnimation(from: number, to: number): void {
    this.animFrom = from;
    this.animTo = to;
    this.animT = 0;
    this.animating = true;
    if (this.animateSeconds <= 0) this.finishAnimation();
  }

  private finishAnimation(): void {
    this.animating = false;
    this.getTransform().setLocalScale(new vec3(this.animTo, this.animTo, this.animTo));
    if (this.disableWhenDone) {
      this.disableWhenDone = false;
      this.sceneObject.enabled = false;
    }
  }

  private animate(): void {
    if (!this.animating) return;
    this.animT += getDeltaTime();
    const p = Math.min(1, this.animT / this.animateSeconds);
    const eased = 1 - (1 - p) * (1 - p);
    const s = this.animFrom + (this.animTo - this.animFrom) * eased;
    this.getTransform().setLocalScale(new vec3(s, s, s));
    if (p >= 1) this.finishAnimation();
  }
}
