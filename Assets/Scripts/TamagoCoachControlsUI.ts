import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { Switch } from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch";

/**
 * TamagoCoachControlsUI - the Next and Back UIKit buttons (a bottom-anchored column on this
 * object) and the "Demo x10" UIKit switch row built under the authored DemoSwitchAnchor.
 *
 * Owns: SceneObjects NextButton / BackButton / DemoSwitch and their labels.
 * Expects: `demoSwitchAnchor` (authored, tilted like this object); if missing the switch row is
 *          built under this object below the buttons.
 * Must not: hold step state - it emits onNext / onBack / onDemoChanged and mirrors setDemo().
 *
 * Both groups are laid out with local +Y up and +Z toward the user; the authored objects carry
 * the 40-degree tilt. Content is lifted by half its height so it rises from the object position.
 */
type TextWithWeight = Text & { weight?: number };

const BUTTON_LABEL_Z = 0.08;

@component
export class TamagoCoachControlsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachControlsUI – Next, Back, Demo x10</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Authored anchor at the far-left corner of the counter for the Demo x10 switch row")
  demoSwitchAnchor: SceneObject;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec2", "{8,6}")
  @hint("Next button size, cm (width, height)")
  nextSizeCm: vec2;

  @input("vec2", "{6,4}")
  @hint("Back button size, cm (width, height)")
  backSizeCm: vec2;

  @input
  @hint("Gap between the Next and Back buttons, cm")
  @widget(new SliderWidget(0, 5, 0.1))
  buttonGapCm: number = 1.2;

  @input
  @hint("Label on the Next button")
  nextLabel: string = "Next";

  @input
  @hint("Label on the Back button")
  backLabel: string = "Back";

  @input
  @hint("Label next to the demo-speed switch")
  demoLabel: string = "Demo ×10";

  @input
  @hint("Button label text size (em-square; 60 ~ 1 cm cap height)")
  @widget(new SliderWidget(40, 100, 1))
  labelSize: number = 60;

  @input("vec4", "{1,1,1,1}")
  @hint("Label colour")
  @widget(new ColorWidget())
  labelColor: vec4;
  @ui.group_end

  private onNextEvent = new Event<void>();
  private onBackEvent = new Event<void>();
  private onDemoChangedEvent = new Event<boolean>();
  private demoSwitch: Switch | null = null;

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

    // Buttons column, bottom-anchored at this object's origin.
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

    this.addButton(buttons, "NextButton", this.nextLabel, this.nextSizeCm, () => this.onNextEvent.invoke());
    this.addButton(buttons, "BackButton", this.backLabel, this.backSizeCm, () => this.onBackEvent.invoke());

    // Demo x10 group (label above the switch, a narrow column) under the authored anchor
    // (fallback: under this object, below the buttons).
    const demoW = 6.5;
    const demoH = 4.4;
    let host: SceneObject = this.sceneObject;
    let groupY = -3.0 - demoH / 2;
    if (this.demoSwitchAnchor) {
      host = this.demoSwitchAnchor;
      host.createComponent("Component.Canvas");
      groupY = demoH / 2;
    }
    const row = global.scene.createSceneObject("DemoContent");
    row.setParent(host);
    row.getTransform().setLocalPosition(new vec3(0, groupY, 0));
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    rowFlex.width = demoW;
    rowFlex.height = demoH;
    rowFlex.direction = FlexDirection.Column;
    rowFlex.alignItems = FlexAlign.Center;
    rowFlex.justifyContent = FlexJustify.Center;
    rowFlex.rowGap = 0.3;

    this.addRowText(row, "DemoLabel", this.demoLabel, 6.2, 0);

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
    switchSO.createComponent(FlexItem.getTypeName());
    this.demoSwitch = sw;
  }

  /** Mirror a programmatic demo-speed change on the switch (no event is emitted). */
  setDemo(on: boolean): void {
    if (this.demoSwitch && this.demoSwitch.isOn !== on) this.demoSwitch.isOn = on;
  }

  private addButton(parent: SceneObject, name: string, label: string, size: vec2, onClick: () => void): void {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    const btn = so.createComponent(Button.getTypeName()) as Button;
    btn.size = new vec3(size.x, size.y, 1);
    this.addRowText(so, name + "Label", label, size.x - 0.5, BUTTON_LABEL_Z);
    so.createComponent(FlexItem.getTypeName());
    btn.onTriggerUp.add(() => onClick());
  }

  private addRowText(parent: SceneObject, name: string, text: string, widthCm: number, zLift: number): Text {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    so.getTransform().setLocalPosition(new vec3(0, 0, zLift));
    const t = so.createComponent("Component.Text") as Text;
    t.text = text;
    t.size = this.labelSize;
    (t as TextWithWeight).weight = 500;
    t.textFill.color = this.labelColor;
    t.depthTest = true;
    t.horizontalAlignment = HorizontalAlignment.Center;
    t.verticalAlignment = VerticalAlignment.Center;
    t.horizontalOverflow = HorizontalOverflow.Overflow;
    t.verticalOverflow = VerticalOverflow.Overflow;
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -1.2, 1.2);
    so.createComponent(FlexItem.getTypeName());
    return t;
  }
}
