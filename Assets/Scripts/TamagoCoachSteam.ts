/**
 * TamagoCoachSteam - two wisps of steam rising from the pan while the Heat countdown runs.
 * Pure appearance: soft white elongated puffs (eight per wisp, phases evenly spread so each wisp
 * reads as one continuous rising streak) that rise, sway along a gentle S path, grow and fade,
 * then respawn at the pan rim. Deterministic, driven by UpdateEvent + getDeltaTime().
 *
 * Owns: runtime child "SteamPuffs" of this (Steam) object with one RenderMeshVisual whose mesh is
 *       rebuilt in place every frame (one MeshBuilder kept alive: erase + re-append the vertices).
 *       No collider, no Interactable, nothing is read by tests.
 * Expects: `material` (ShadowSoft: unlit vertex colour, blendMode Normal, depthWrite off).
 * Must not: decide when steam shows - TamagoCoachMain calls setActive(); default off.
 *
 * Local frame: this object sits at the pan centre at rim height; +X right, +Y up, +Z toward the
 * user. The puffs lie in vertical planes facing +Z (the user sees them face-on). Per-puff alpha
 * peaks at maxAlpha right after birth and fades linearly to 0 at the top; with the soft edge
 * (full alpha only inside half the radius) at most two puffs ever stack at full strength, so the
 * combined opacity stays under 30 % everywhere (1 - (1 - 0.14)^2 = 26 %).
 */

/** Wisp bases relative to this object (pan centre, rim height): left-far and right-near. */
const WISP_OFFSETS: [number, number, number][] = [
  [-3, 0, -1.5],
  [3, 0, 1.5],
];
/** Soft edge: fraction of the radius at full alpha, a mid ring, then alpha 0 at the rim. */
const RINGS: { k: number; a: number }[] = [
  { k: 0.5, a: 1 },
  { k: 0.78, a: 0.35 },
  { k: 1, a: 0 },
];
const FLOATS_PER_VERTEX = 10;

@component
export class TamagoCoachSteam extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachSteam – steam wisps over the pan (Heat)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("ShadowSoft: unlit vertex-colour material, blendMode Normal, depthWrite off (white vertex colour = steam)")
  material: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Width of one puff at scale 1, cm (puffs grow from 0.7x to 1.3x over their life)")
  @widget(new SliderWidget(1, 5, 0.1))
  puffDiameterCm: number = 2.2;

  @input
  @hint("Height / width of each puff (1 = round disc, 1.6 = elongated wisp)")
  @widget(new SliderWidget(1, 3, 0.1))
  puffAspect: number = 1.6;

  @input
  @hint("Puffs per wisp, evenly spread over the cycle (more = a more continuous streak)")
  @widget(new SliderWidget(3, 12, 1))
  puffsPerWisp: number = 8;

  @input
  @hint("How far each puff rises over its life, cm")
  @widget(new SliderWidget(3, 20, 0.5))
  riseCm: number = 9;

  @input
  @hint("Life of one puff (rise time), seconds")
  @widget(new SliderWidget(0.5, 4, 0.1))
  cycleSeconds: number = 1.8;

  @input
  @hint("Sideways sway amplitude of the streak, cm")
  @widget(new SliderWidget(0, 3, 0.1))
  swayCm: number = 0.8;

  @input
  @hint("Peak opacity of one puff (keep <= 0.15 so two stacked puffs stay under 30 %)")
  @widget(new SliderWidget(0, 0.3, 0.01))
  maxAlpha: number = 0.14;

  @input
  @hint("Render order of the translucent puffs (after the egg layer's 1 so they draw last)")
  @widget(new SliderWidget(0, 10, 1))
  renderOrder: number = 6;
  @ui.group_end

  private puffsObject: SceneObject | null = null;
  private builder: MeshBuilder | null = null;
  private verts: number[] = [];
  private active = false;
  private time = 0;
  private puffCount = 8;
  private readonly segments = 24;

  onAwake(): void {
    this.puffsObject = global.scene.createSceneObject("SteamPuffs");
    this.puffsObject.setParent(this.sceneObject);
    const rmv = this.puffsObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.renderOrder = Math.round(this.renderOrder);

    this.builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ]);
    this.builder.topology = MeshTopology.Triangles;
    this.builder.indexType = MeshIndexType.UInt16;

    this.puffCount = Math.max(1, Math.round(this.puffsPerWisp));
    const puffs = WISP_OFFSETS.length * this.puffCount;
    const perPuff = 1 + RINGS.length * this.segments;
    this.verts = new Array<number>(puffs * perPuff * FLOATS_PER_VERTEX).fill(0);
    this.fillVertices(0);
    // Static topology: per puff a centre fan to the first ring, then quad strips between rings.
    // Counter-clockwise seen from +Z, which is the front (Lens Studio culls back faces).
    const indices: number[] = [];
    const segs = this.segments;
    for (let p = 0; p < puffs; p++) {
      const b = p * perPuff;
      const ring = (m: number, j: number): number => b + 1 + m * segs + (j % segs);
      for (let j = 0; j < segs; j++) {
        indices.push(b, ring(0, j), ring(0, j + 1));
        for (let m = 0; m + 1 < RINGS.length; m++) {
          indices.push(ring(m, j), ring(m, j + 1), ring(m + 1, j + 1));
          indices.push(ring(m, j), ring(m + 1, j + 1), ring(m + 1, j));
        }
      }
    }
    this.builder.appendVerticesInterleaved(this.verts);
    this.builder.appendIndices(indices);
    rmv.mesh = this.builder.getMesh();
    if (this.material) rmv.mainMaterial = this.material;
    this.builder.updateMesh();
    this.puffsObject.enabled = this.active;
    print("[TamagoCoachSteam] built " + puffs + " puffs, " + this.builder.getVerticesCount() + " verts, " + indices.length / 3 + " tris, material=" + (this.material ? "ok" : "MISSING"));
    this.createEvent("UpdateEvent").bind(() => this.update());
  }

  /** Show (true) or hide (false) the steam; hidden = the puffs' object is disabled. */
  setActive(on: boolean): void {
    this.active = on;
    if (this.puffsObject) this.puffsObject.enabled = on;
  }

  isActive(): boolean {
    return this.active;
  }

  private update(): void {
    if (!this.active || !this.builder) return;
    this.time += getDeltaTime();
    this.fillVertices(this.time);
    this.builder.eraseVertices(0, this.builder.getVerticesCount());
    this.builder.appendVerticesInterleaved(this.verts);
    this.builder.updateMesh();
  }

  /** Writes every puff's vertices for the given time into `verts` (same layout as the indices). */
  private fillVertices(time: number): void {
    const segs = this.segments;
    const cycle = Math.max(0.1, this.cycleSeconds);
    const aspect = Math.max(0.2, this.puffAspect);
    let o = 0;
    const put = (x: number, y: number, z: number, a: number): void => {
      const v = this.verts;
      v[o] = x; v[o + 1] = y; v[o + 2] = z;
      v[o + 3] = 0; v[o + 4] = 0; v[o + 5] = 1;
      v[o + 6] = 1; v[o + 7] = 1; v[o + 8] = 1; v[o + 9] = a;
      o += FLOATS_PER_VERTEX;
    };
    for (let wI = 0; wI < WISP_OFFSETS.length; wI++) {
      const base = WISP_OFFSETS[wI];
      for (let k = 0; k < this.puffCount; k++) {
        // Life 0..1, evenly staggered along the cycle; the second wisp runs out of step.
        const t = (time / cycle + k / this.puffCount + wI * 0.37) % 1;
        // The sway is a function of life only, so every puff of a wisp follows the same S path
        // and the wisp reads as one streak (the two wisps bend opposite ways).
        const sway = this.swayCm * Math.sin(Math.PI * 2 * t + wI * Math.PI);
        const x = base[0] + sway;
        const y = base[1] + this.riseCm * t;
        const z = base[2];
        const r = (this.puffDiameterCm / 2) * (0.7 + 0.6 * t);
        const ry = r * aspect;
        // Quick fade-in at birth (no pop), then a linear fade to nothing at the top.
        const alpha = this.maxAlpha * (1 - t) * Math.min(1, t / 0.12);
        put(x, y, z, alpha);
        for (let m = 0; m < RINGS.length; m++) {
          const rk = r * RINGS[m].k;
          const rky = ry * RINGS[m].k;
          const a = alpha * RINGS[m].a;
          for (let j = 0; j < segs; j++) {
            const ang = (Math.PI * 2 * j) / segs;
            put(x + rk * Math.cos(ang), y + rky * Math.sin(ang), z, a);
          }
        }
      }
    }
  }
}
