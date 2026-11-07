import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";

/**
 * TamagoCoachCardUI - the step card: a dark UIKit BackPlate with three light text rows laid out
 * by a FlexLayout column in the card's upper two-thirds (the timer ring overlaps the lower third).
 *
 * Owns: SceneObjects CardTitleText / CardInstructionText / CardTipText and the expand/collapse
 *       animation of this (StepCard) object.
 * Expects: nothing wired; TamagoCoachMain pushes text through the setters below.
 * Must not: hold step state or decide when to expand - it is a passive view.
 *
 * Text sizes are em-square sizes (cm = size / 43.886); 54 keeps cap height >= 0.8 cm.
 */
type TextWithWeight = Text & { weight?: number };

function styleText(t: Text, size: number, weight: number, color: vec4, wrap: boolean): void {
  t.size = size;
  (t as TextWithWeight).weight = weight;
  t.textFill.color = color;
  t.depthTest = true;
  t.horizontalAlignment = HorizontalAlignment.Center;
  t.verticalAlignment = VerticalAlignment.Center;
  t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow;
  t.verticalOverflow = VerticalOverflow.Overflow;
}

@component
export class TamagoCoachCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachCardUI – step card (title, instruction, tip)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Card width, cm")
  @widget(new SliderWidget(10, 40, 0.5))
  widthCm: number = 24;

  @input
  @hint("Card height, cm")
  @widget(new SliderWidget(6, 30, 0.5))
  heightCm: number = 12;

  @input
  @hint("Title text size (em-square, 43.886 = 1 cm)")
  @widget(new SliderWidget(40, 120, 1))
  titleSize: number = 64;

  @input
  @hint("Instruction and tip text size (54 keeps cap height >= 0.8 cm)")
  @widget(new SliderWidget(40, 100, 1))
  bodySize: number = 54;

  @input("vec4", "{1,1,1,1}")
  @hint("Title colour")
  @widget(new ColorWidget())
  titleColor: vec4;

  @input("vec4", "{1,1,1,1}")
  @hint("Instruction colour")
  @widget(new ColorWidget())
  textColor: vec4;

  @input("vec4", "{1,1,1,0.72}")
  @hint("Tip colour (dimmer secondary text)")
  @widget(new ColorWidget())
  tipColor: vec4;

  @input
  @hint("UIKit BackPlate style")
  @widget(new ComboBoxWidget([new ComboBoxItem("dark", "dark"), new ComboBoxItem("default", "default"), new ComboBoxItem("simple", "simple")]))
  plateStyle: string = "dark";

  @input
  @hint("Expand/collapse animation length, seconds")
  @widget(new SliderWidget(0, 1, 0.05))
  animateSeconds: number = 0.2;
  @ui.group_end

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

    // BackPlate first so the hierarchy DFS paints it behind the content.
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate;
    plate.size = new vec2(this.widthCm, this.heightCm);
    plate.style = this.plateStyle as "default" | "dark" | "simple";

    const content = global.scene.createSceneObject("Content");
    content.setParent(this.sceneObject);
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6));

    const pad = 0.5;
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    flex.width = this.widthCm;
    flex.height = this.heightCm;
    flex.direction = FlexDirection.Column;
    flex.alignItems = FlexAlign.Stretch;
    flex.justifyContent = FlexJustify.Start;
    flex.rowGap = 0.2;
    flex.paddingTop = 0.3;
    flex.paddingBottom = 0;
    flex.paddingLeft = pad;
    flex.paddingRight = pad;

    // Rows: fixed heights so the text stays in the upper two-thirds regardless of line count.
    this.titleText = this.addRow(content, "CardTitleText", this.titleSize, 700, this.titleColor, 1.7, false);
    this.instructionText = this.addRow(content, "CardInstructionText", this.bodySize, 500, this.textColor, 4.2, true);
    this.tipText = this.addRow(content, "CardTipText", this.bodySize, 500, this.tipColor, 1.6, true);

    this.createEvent("UpdateEvent").bind(() => this.animate());
  }

  /** Replace all three lines (a new step). */
  setContent(title: string, instruction: string, tip: string): void {
    this.setTitle(title);
    this.setInstruction(instruction);
    this.setTip(tip);
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

  private addRow(parent: SceneObject, name: string, size: number, weight: number, color: vec4, height: number, wrap: boolean): Text {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    const t = so.createComponent("Component.Text") as Text;
    t.text = "";
    styleText(t, size, weight, color, wrap);
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5); // placeholder; the layout allocates the row width
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem;
    item.alignSelf = FlexAlignSelf.Stretch;
    item.overrideHeight = height;
    return t;
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
