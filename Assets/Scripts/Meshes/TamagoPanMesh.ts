import { MeshWriter, OutlinePoint, RGBA, Vec3, litTint, normalize3, roundedRect, scaleColor } from "./MeshKit";

/**
 * TamagoPanMesh - a rectangular tamagoyaki pan built at runtime: graphite body with rounded
 * inner corners, a bright silver lip on the rim and a rounded, slightly raised handle.
 *
 * Local frame (identity transform is the intended orientation):
 *   +X = right (handle side), +Y = up, +Z = toward the user (near rim), -Z = far rim.
 * Origin = centre of the interior floor's TOP surface:
 *   floor top y = 0, rim top y = depth (3), floor bottom y = -floorThickness.
 * Interior cavity: innerWidth (X) by innerLength (Z), i.e. x in [-6.5, 6.5], z in [-9, 9],
 *   with the four inner corners rounded (cornerRadius). Walls are wallThickness thick, so the
 *   outer footprint is x in [-7.1, 7.1], z in [-9.6, 9.6] (within the previous 7.6 / 10.1).
 * Handle: along +X from the outer wall, handleLength long, the front handleMetalLength on the
 *   body material and the rest on the wood material, tilted up by handleTiltDeg about the pan's
 *   Z axis so the far end rises; its top is flush with the rim at the attachment.
 *
 * One RenderMeshVisual per material: the body (floor + walls) stays on this object; runtime
 * children PanRim, PanHandleMetal and PanHandleWood carry the lip and the two handle parts.
 * Colours are baked per vertex and multiplied into the PBR base colour (Vertex Color = Base
 * Color); the inner walls are one tint step lighter than the outer walls. Nothing is black.
 */
@component
export class TamagoPanMesh extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoPanMesh – body, lip and handle</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Body material (PanBodyPBR: graphite, metallic 0.85 / roughness 0.45); also used for the metal handle grip")
  material: Material;

  @input
  @allowUndefined
  @hint("Lip material (PanRimPBR: metallic 1.0 / roughness 0.22); falls back to the body material")
  rimMaterial: Material;

  @input
  @allowUndefined
  @hint("Handle wood material (HandleWoodPBR: metallic 0 / roughness 0.6); falls back to the body material")
  handleWoodMaterial: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input innerWidth: number = 13;
  @input innerLength: number = 18;
  @input depth: number = 3;
  @input wallThickness: number = 0.6;
  @input floorThickness: number = 0.6;
  @input
  @hint("Height of the lip band at the top of the wall, cm")
  rimHeight: number = 0.5;
  @input
  @hint("Radius of the four inner cavity corners, cm")
  cornerRadius: number = 1.5;
  @input
  @hint("Arc segments per rounded corner")
  cornerSegments: number = 8;
  @input handleLength: number = 12;
  @input
  @hint("Length of the dark-metal front part of the handle, cm (the rest is wood)")
  handleMetalLength: number = 5;
  @input handleWidth: number = 2.5;
  @input handleThickness: number = 1.5;
  @input
  @hint("Handle corner rounding, cm (capsule-like bar)")
  handleCornerRadius: number = 0.6;
  @input
  @hint("Handle tilt about the pan's Z axis, degrees (far end rises)")
  handleTiltDeg: number = 8;

  @input("vec4", "{0.36,0.37,0.40,1}")
  @hint("Body colour: graphite (never black on the additive display)")
  @widget(new ColorWidget())
  bodyColor: vec4;

  @input("vec4", "{0.88,0.89,0.92,1}")
  @hint("Lip colour: bright silver")
  @widget(new ColorWidget())
  rimColor: vec4;

  @input("vec4", "{0.42,0.42,0.45,1}")
  @hint("Handle grip colour: dark metal")
  @widget(new ColorWidget())
  handleMetalColor: vec4;

  @input("vec4", "{0.55,0.38,0.22,1}")
  @hint("Handle wood colour")
  @widget(new ColorWidget())
  handleWoodColor: vec4;

  @input
  @hint("Vertex tint of the inner walls relative to the outer walls (1.0)")
  @widget(new SliderWidget(0.8, 1.3, 0.01))
  innerWallTint: number = 1.08;
  @ui.group_end

  onAwake(): void {
    const body = this.rgba(this.bodyColor);
    const rim = this.rgba(this.rimColor);
    const hw = this.innerWidth / 2;
    const hl = this.innerLength / 2;
    const t = this.wallThickness;
    const d = this.depth;
    const f = this.floorThickness;
    const wallTop = d - this.rimHeight;
    const segs = Math.max(1, Math.round(this.cornerSegments));
    const rIn = Math.max(0.05, Math.min(this.cornerRadius, hw, hl));
    const inner = roundedRect(hw, hl, rIn, segs);           // cavity outline (u = x, v = z)
    const outer = roundedRect(hw + t, hl + t, rIn + t, segs); // outer wall outline, same corner centres

    // Body: floor slab over the full outer footprint (cavity floor at y = 0) + the wall ring.
    const w = new MeshWriter();
    w.prismY(outer.map((q) => q.p), -f, 0, body, (n: Vec3) => (n[1] > 0.5 ? 0.92 : litTint(n)));
    this.ring(w, outer, inner, 0, wallTop, body, scaleColor(body, this.innerWallTint), false);
    const rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    w.commit(rmv, this.material);

    // Lip: a bright band on top of the wall, its own visual and material.
    const lw = new MeshWriter();
    this.ring(lw, outer, inner, wallTop, d, scaleColor(rim, 0.95), rim, true, rim);
    const lipObj = this.child("PanRim");
    lw.commit(lipObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual, this.rimMaterial || this.material);

    // Handle: a rounded bar along local +X, pivoting at the outer wall, tilted up about Z.
    const pivot = new vec3(hw + t, d - this.handleThickness / 2, 0);
    const tilt = quat.fromEulerAngles(0, 0, (this.handleTiltDeg * Math.PI) / 180);
    const metalObj = this.child("PanHandleMetal");
    const woodObj = this.child("PanHandleWood");
    for (const o of [metalObj, woodObj]) {
      o.getTransform().setLocalPosition(pivot);
      o.getTransform().setLocalRotation(tilt);
    }
    const metalLen = Math.max(0, Math.min(this.handleMetalLength, this.handleLength));
    const mw = new MeshWriter();
    this.bar(mw, -0.4, metalLen, false, this.rgba(this.handleMetalColor)); // starts 0.4 cm inside the wall
    mw.commit(metalObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual, this.material);
    const ww = new MeshWriter();
    this.bar(ww, metalLen, this.handleLength, true, this.rgba(this.handleWoodColor));
    ww.commit(woodObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual, this.handleWoodMaterial || this.material);

    print(
      "[TamagoPanMesh] built body " + w.vertexCount + " verts, lip " + lw.vertexCount + ", handle " + (mw.vertexCount + ww.vertexCount) +
        "; materials body=" + (this.material ? "ok" : "MISSING") + " rim=" + (this.rimMaterial ? "ok" : "fallback") +
        " wood=" + (this.handleWoodMaterial ? "ok" : "fallback"),
    );
  }

  private child(name: string): SceneObject {
    const so = global.scene.createSceneObject(name);
    so.setParent(this.sceneObject);
    return so;
  }

  /**
   * Ring wall between two index-matched outlines from y0 to y1: outer faces (normals outward),
   * inner faces (normals into the cavity) and, optionally, the flat top band between them.
   */
  private ring(
    w: MeshWriter,
    outer: OutlinePoint[],
    inner: OutlinePoint[],
    y0: number,
    y1: number,
    outerColor: RGBA,
    innerColor: RGBA,
    withTop: boolean,
    topColor?: RGBA,
  ): void {
    const n = outer.length;
    const up: Vec3 = [0, 1, 0];
    const tc = topColor || outerColor;
    for (let k = 0; k < n; k++) {
      const a = outer[k], b = outer[(k + 1) % n];
      const e = inner[k], c = inner[(k + 1) % n];
      const na: Vec3 = [a.n[0], 0, a.n[1]];
      const nb: Vec3 = [b.n[0], 0, b.n[1]];
      w.quad(
        [[a.p[0], y0, a.p[1]], [b.p[0], y0, b.p[1]], [b.p[0], y1, b.p[1]], [a.p[0], y1, a.p[1]]],
        [na, nb, nb, na],
        [outerColor, outerColor, outerColor, outerColor],
      );
      const ne: Vec3 = [-e.n[0], 0, -e.n[1]];
      const nc: Vec3 = [-c.n[0], 0, -c.n[1]];
      w.quad(
        [[e.p[0], y0, e.p[1]], [c.p[0], y0, c.p[1]], [c.p[0], y1, c.p[1]], [e.p[0], y1, e.p[1]]],
        [ne, nc, nc, ne],
        [innerColor, innerColor, innerColor, innerColor],
      );
      if (withTop) {
        w.quad(
          [[a.p[0], y1, a.p[1]], [b.p[0], y1, b.p[1]], [c.p[0], y1, c.p[1]], [e.p[0], y1, e.p[1]]],
          [up, up, up, up],
          [tc, tc, tc, tc],
          up,
        );
      }
    }
  }

  /**
   * Rounded bar along local +X from x0 to x1 with a rounded-rectangle cross-section (u = y,
   * v = z). `roundedEnd` closes the far end with a quarter-round cap (capsule-like); otherwise
   * the far end is left open for the next part to continue. The near end is always open.
   */
  private bar(w: MeshWriter, x0: number, x1: number, roundedEnd: boolean, color: RGBA): void {
    const hy = this.handleThickness / 2;
    const hz = this.handleWidth / 2;
    const prof = roundedRect(hy, hz, Math.min(this.handleCornerRadius, hy, hz), 4);
    const rings: { x: number; s: number; nx: number }[] = [{ x: x0, s: 1, nx: 0 }];
    if (roundedEnd) {
      const re = Math.min(hy, x1 - x0);
      const steps = 4;
      for (let k = 1; k <= steps; k++) {
        const th = (Math.PI / 2) * (k / steps);
        rings.push({ x: x1 - re + re * Math.sin(th), s: Math.cos(th), nx: Math.sin(th) });
      }
    } else {
      rings.push({ x: x1, s: 1, nx: 0 });
    }
    const P = (pt: OutlinePoint, r: { x: number; s: number; nx: number }): Vec3 => [r.x, pt.p[0] * r.s, pt.p[1] * r.s];
    const N = (pt: OutlinePoint, r: { x: number; s: number; nx: number }): Vec3 => normalize3([r.nx, pt.n[0] * r.s, pt.n[1] * r.s]);
    for (let r = 0; r + 1 < rings.length; r++) {
      const A = rings[r], B = rings[r + 1];
      for (let k = 0; k < prof.length; k++) {
        const p = prof[k], q = prof[(k + 1) % prof.length];
        w.quad([P(p, A), P(q, A), P(q, B), P(p, B)], [N(p, A), N(q, A), N(q, B), N(p, B)], [color, color, color, color]);
      }
    }
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, c.w];
  }
}
