import { MeshWriter, RGBA, Vec3, roundedRect } from "./Meshes/MeshKit";

/**
 * TamagoCoachContactShadows - faux contact shadows on the virtual counter and a soft halo behind
 * the step card. Pure appearance: soft black vertex-alpha discs on a translucent, depth-tested,
 * non-depth-writing material (ShadowSoft). Nothing here is interactive or read by tests.
 *
 * Owns: one RenderMeshVisual on this object (three ellipses lying `liftCm` above the counter top
 *       in the StoveSet frame: under the pan, under the Next/Back group and under the card's
 *       footprint between the pan's far rim and the counter's far edge) and a runtime child
 *       "CardHalo" of `cardObject` (a 10 % dark rounded quad `haloBehindCm` behind the card
 *       plane, facing +Z like the card, so it moves, turns and hides with the card).
 * Expects: `material` (ShadowSoft) and optionally `cardObject` (StepCard).
 * Must not: move, hold state, or be looked up by tests.
 *
 * On the additive display pure black is transparent, so the halo is invisible against the real
 * world (it only helps the preview / video); the ellipses darken the virtual counter and do show.
 */
@component
export class TamagoCoachContactShadows extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachContactShadows – faux shadows and card halo</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("ShadowSoft: unlit vertex-colour material, blendMode Normal, depthWrite off")
  material: Material;

  @input
  @allowUndefined
  @hint("The step card (StepCard); a CardHalo child is created behind it at runtime")
  cardObject: SceneObject;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Height of the shadow discs above the counter top, cm")
  @widget(new SliderWidget(0, 1, 0.01))
  liftCm: number = 0.05;

  @input
  @hint("Opacity at the centre of each shadow")
  @widget(new SliderWidget(0, 1, 0.01))
  maxAlpha: number = 0.2;

  @input
  @hint("Fraction of the radius that stays fully dark before the fade to the edge")
  @widget(new SliderWidget(0, 1, 0.01))
  fadeFrom: number = 0.65;

  @input
  @hint("Segments around each disc")
  @widget(new SliderWidget(8, 64, 1))
  segments: number = 32;

  @input
  @hint("Shadows never reach past this local z (the counter's near edge minus a margin), cm")
  clampZMax: number = 17.4;

  @input panX: number = 3;
  @input panZ: number = 0;
  @input panWidthCm: number = 19;
  @input panLengthCm: number = 23;

  @input controlsX: number = -12.5;
  @input controlsZ: number = 11.5;
  @input controlsWidthCm: number = 12;
  @input controlsLengthCm: number = 14;

  @input cardX: number = 3;
  @input cardZ: number = -14;
  @input cardWidthCm: number = 22;
  @input cardLengthCm: number = 6;

  @input haloWidthCm: number = 26;
  @input haloHeightCm: number = 14;
  @input
  @hint("Opacity of the card halo")
  @widget(new SliderWidget(0, 1, 0.01))
  haloAlpha: number = 0.1;
  @input
  @hint("Distance of the halo behind the card plane, cm")
  haloBehindCm: number = 0.5;
  @input haloCornerCm: number = 2;
  @ui.group_end

  onAwake(): void {
    const w = new MeshWriter();
    this.ellipse(w, this.panX, this.panZ, this.panWidthCm / 2, this.panLengthCm / 2);
    this.ellipse(w, this.controlsX, this.controlsZ, this.controlsWidthCm / 2, this.controlsLengthCm / 2);
    this.ellipse(w, this.cardX, this.cardZ, this.cardWidthCm / 2, this.cardLengthCm / 2);
    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    w.commit(rmv, this.material);

    let haloVerts = 0;
    if (this.cardObject) {
      const halo = global.scene.createSceneObject("CardHalo");
      halo.setParent(this.cardObject);
      halo.getTransform().setLocalPosition(new vec3(0, 0, -this.haloBehindCm));
      const hw = new MeshWriter();
      const outline = roundedRect(this.haloWidthCm / 2, this.haloHeightCm / 2, this.haloCornerCm, 6);
      hw.face(outline.map((q): Vec3 => [q.p[0], q.p[1], 0]), [0, 0, 1], [0, 0, 0, this.haloAlpha]);
      hw.commit(halo.createComponent("Component.RenderMeshVisual") as RenderMeshVisual, this.material);
      haloVerts = hw.vertexCount;
    }
    print("[TamagoCoachContactShadows] built " + w.vertexCount + " shadow verts, halo " + haloVerts + " verts, material=" + (this.material ? "ok" : "MISSING") + ", card=" + (this.cardObject ? "ok" : "none"));
  }

  /**
   * Soft ellipse in the local XZ plane at y = liftCm: a centre fan to the fully dark inner ring,
   * then two quad rings fading to alpha 0 at the edge. Vertex z is clamped to clampZMax.
   */
  private ellipse(w: MeshWriter, cx: number, cz: number, rx: number, rz: number): void {
    const y = this.liftCm;
    const up: Vec3 = [0, 1, 0];
    const segs = Math.max(8, Math.round(this.segments));
    const a0 = this.maxAlpha;
    const k0 = Math.max(0, Math.min(1, this.fadeFrom));
    const rings = [
      { k: k0, a: a0 },
      { k: k0 + (1 - k0) * 0.5, a: a0 * 0.35 },
      { k: 1, a: 0 },
    ];
    const col = (a: number): RGBA => [0, 0, 0, a];
    const pt = (i: number, k: number): Vec3 => {
      const ang = (Math.PI * 2 * i) / segs;
      return [cx + rx * k * Math.cos(ang), y, Math.min(this.clampZMax, cz + rz * k * Math.sin(ang))];
    };
    const centre: Vec3 = [cx, y, Math.min(this.clampZMax, cz)];
    for (let i = 0; i < segs; i++) {
      w.tri3([centre, pt(i, rings[0].k), pt(i + 1, rings[0].k)], [up, up, up], [col(a0), col(rings[0].a), col(rings[0].a)], up);
      for (let r = 0; r + 1 < rings.length; r++) {
        const A = rings[r], B = rings[r + 1];
        w.quad(
          [pt(i, A.k), pt(i + 1, A.k), pt(i + 1, B.k), pt(i, B.k)],
          [up, up, up, up],
          [col(A.a), col(A.a), col(B.a), col(B.a)],
          up,
        );
      }
    }
  }
}
