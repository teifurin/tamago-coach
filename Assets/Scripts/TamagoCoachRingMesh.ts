import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { MeshWriter, RGBA, Vec3, lerpColor } from "./Meshes/MeshKit";

/**
 * TamagoCoachRingMesh - the timer ring: a dim full annulus (track) plus a bright arc that
 * depletes clockwise from 12 o'clock as the countdown runs. Code-authored MeshBuilder geometry.
 *
 * Owns: child "RingVisual" (scaled for the pulse) holding "RingTrack" and "RingArc" visuals,
 *       a box collider on this unit-scale object and a SIK Interactable (pinch -> onPinch,
 *       hover -> highlight). The ring lies in the local XY plane and faces local +Z.
 * Expects: `material` (unlit vertex-colour material).
 * Must not: know about steps or timers; TamagoCoachMain pushes `setFraction` and owns pause state.
 * Text inside/under the ring lives in TamagoCoachRingUI (child object "RingText").
 */
@component
export class TamagoCoachRingMesh extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TamagoCoachRingMesh – countdown ring geometry</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Unlit vertex-colour material (vertexBaseColorMaterial)")
  material: Material;
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Outer diameter of the ring, cm")
  @widget(new SliderWidget(3, 15, 0.5))
  outerDiameterCm: number = 6;

  @input
  @hint("Radial width of the band, cm")
  @widget(new SliderWidget(0.2, 3, 0.1))
  bandCm: number = 0.9;

  @input
  @hint("Ring thickness along its normal, cm")
  @widget(new SliderWidget(0.1, 2, 0.1))
  thicknessCm: number = 0.4;

  @input
  @hint("Arc resolution (segments around the full circle)")
  @widget(new SliderWidget(16, 128, 1))
  segments: number = 64;

  @input("vec4", "{1.0,0.78,0.2,1}")
  @hint("Colour of the remaining-time arc (yolk)")
  @widget(new ColorWidget())
  arcColor: vec4;

  @input("vec4", "{0.32,0.32,0.32,1}")
  @hint("Colour of the elapsed full-circle track (30 % white reads as faint white on the additive display)")
  @widget(new ColorWidget())
  trackColor: vec4;

  @input("vec4", "{1.0,0.9,0.5,1}")
  @hint("Arc colour while a hand/cursor aims at the ring")
  @widget(new ColorWidget())
  hoverColor: vec4;

  @input("vec4", "{1.0,0.62,0.2,1}")
  @hint("Arc colour while the countdown is paused")
  @widget(new ColorWidget())
  pausedColor: vec4;

  @input("vec4", "{1.0,0.80,0.55,1}")
  @hint("Track and arc colour at the peak of the Done colour pulse (warm)")
  @widget(new ColorWidget())
  pulseColor: vec4;

  @input
  @hint("Peak scale of one pulse at zero")
  @widget(new SliderWidget(1, 2, 0.05))
  pulseScale: number = 1.25;

  @input
  @hint("Duration of one pulse, seconds")
  @widget(new SliderWidget(0.1, 1, 0.05))
  pulseSeconds: number = 0.3;

  @input
  @hint("Extra collider size around the ring so it is easy to pinch, cm")
  @widget(new SliderWidget(0, 6, 0.5))
  colliderPaddingCm: number = 1.0;

  @input
  @hint("Draw the collider as a wireframe for hit-zone diagnosis")
  debugCollider: boolean = false;
  @ui.group_end

  private visualRoot: SceneObject | null = null;
  private trackRmv: RenderMeshVisual | null = null;
  private arcRmv: RenderMeshVisual | null = null;
  private arcSegments = -1;
  private hovered = false;
  private paused = false;
  private pulsesLeft = 0;
  private pulseT = 0;
  private pulsing = false;
  private colorPulseSeconds = 0;
  private colorPulseT = -1;
  private pulseK = 0;

  private onPinchEvent = new Event<void>();
  /** Fires when the user pinches/clicks the ring. */
  get onPinch(): PublicApi<void> {
    return this.onPinchEvent.publicApi();
  }

  onAwake(): void {
    this.visualRoot = global.scene.createSceneObject("RingVisual");
    this.visualRoot.setParent(this.sceneObject);

    const track = global.scene.createSceneObject("RingTrack");
    track.setParent(this.visualRoot);
    this.trackRmv = track.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    this.rebuildTrack(this.rgba(this.trackColor));

    const arc = global.scene.createSceneObject("RingArc");
    arc.setParent(this.visualRoot);
    arc.getTransform().setLocalPosition(new vec3(0, 0, 0.06)); // in front of the track, no z-fight
    this.arcRmv = arc.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    this.rebuildArc(this.segments);

    const collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const shape = Shape.createBoxShape();
    const d = this.outerDiameterCm + this.colliderPaddingCm;
    shape.size = new vec3(d, d, this.thicknessCm + 1.0);
    collider.shape = shape;
    collider.fitVisual = false;
    collider.debugDrawEnabled = this.debugCollider;

    const interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable;
    this.createEvent("OnStartEvent").bind(() => {
      interactable.onTriggerEnd.add(() => this.onPinchEvent.invoke());
      interactable.onHoverEnter.add(() => this.setHovered(true));
      interactable.onHoverExit.add(() => this.setHovered(false));
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.updatePulse();
      this.updateColorPulse();
    });
  }

  /** Remaining fraction 0..1; the bright arc covers that share of the circle from 12 o'clock. */
  setFraction(fraction: number): void {
    const f = Math.max(0, Math.min(1, fraction));
    const segs = Math.round(f * this.segments);
    if (segs !== this.arcSegments) this.rebuildArc(segs);
  }

  /** Show or hide the ring geometry (the collider stays so pinches are still delivered). */
  setVisible(visible: boolean): void {
    if (this.visualRoot) this.visualRoot.enabled = visible;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.rebuildArc(this.arcSegments);
  }

  /** Pulse the ring `times` times (used at a countdown's zero). */
  pulse(times: number): void {
    this.pulsesLeft = Math.max(1, Math.round(times));
    this.pulseT = 0;
    this.pulsing = true;
  }

  /**
   * One warm colour flash of the track and the arc: current colours -> pulseColor -> back (sine)
   * over `seconds`; the exact previous colours are restored at the end (hover/paused still win).
   */
  colorPulse(seconds: number): void {
    this.colorPulseSeconds = Math.max(0.05, seconds);
    this.colorPulseT = 0;
  }

  private setHovered(hovered: boolean): void {
    if (this.hovered === hovered) return;
    this.hovered = hovered;
    this.rebuildArc(this.arcSegments);
  }

  private currentArcColor(): RGBA {
    const base = this.hovered ? this.rgba(this.hoverColor) : this.paused ? this.rgba(this.pausedColor) : this.rgba(this.arcColor);
    return this.pulseK > 0 ? lerpColor(base, this.rgba(this.pulseColor), this.pulseK) : base;
  }

  private rebuildArc(segs: number): void {
    if (!this.arcRmv) return;
    this.arcSegments = segs;
    if (segs <= 0) {
      this.arcRmv.enabled = false;
      return;
    }
    this.arcRmv.enabled = true;
    const w = new MeshWriter();
    this.annulusArc(w, 0, (Math.PI * 2 * segs) / this.segments, segs, this.currentArcColor());
    w.commit(this.arcRmv, this.material);
  }

  /**
   * Annulus arc in the local XY plane from `a0` to `a1` (radians, clockwise from +Y),
   * extruded from -thickness/2 to +thickness/2 along Z. Front face normal +Z.
   */
  private annulusArc(w: MeshWriter, a0: number, a1: number, segs: number, color: RGBA): void {
    const rOut = this.outerDiameterCm / 2;
    const rIn = Math.max(0.05, rOut - this.bandCm);
    const zf = this.thicknessCm / 2;
    const zb = -zf;
    const front: RGBA = color;
    const back: RGBA = [color[0] * 0.75, color[1] * 0.75, color[2] * 0.75, color[3]];
    const wall: RGBA = [color[0] * 0.85, color[1] * 0.85, color[2] * 0.85, color[3]];
    const pt = (angle: number, r: number, z: number): Vec3 => [r * Math.sin(angle), r * Math.cos(angle), z];
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segs;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
      const tm = (t0 + t1) / 2;
      w.face([pt(t0, rOut, zf), pt(t1, rOut, zf), pt(t1, rIn, zf), pt(t0, rIn, zf)], [0, 0, 1], front);
      w.face([pt(t0, rOut, zb), pt(t1, rOut, zb), pt(t1, rIn, zb), pt(t0, rIn, zb)], [0, 0, -1], back);
      const nOut: Vec3 = [Math.sin(tm), Math.cos(tm), 0];
      const nIn: Vec3 = [-nOut[0], -nOut[1], 0];
      w.face([pt(t0, rOut, zb), pt(t1, rOut, zb), pt(t1, rOut, zf), pt(t0, rOut, zf)], nOut, wall);
      w.face([pt(t0, rIn, zb), pt(t1, rIn, zb), pt(t1, rIn, zf), pt(t0, rIn, zf)], nIn, wall);
    }
    if (segs > 0 && a1 - a0 < Math.PI * 2 - 1e-6) {
      // End caps of a partial arc.
      w.face([pt(a0, rIn, zb), pt(a0, rOut, zb), pt(a0, rOut, zf), pt(a0, rIn, zf)], [-Math.cos(a0), Math.sin(a0), 0], wall);
      w.face([pt(a1, rIn, zb), pt(a1, rOut, zb), pt(a1, rOut, zf), pt(a1, rIn, zf)], [Math.cos(a1), -Math.sin(a1), 0], wall);
    }
  }

  private updatePulse(): void {
    if (!this.pulsing || !this.visualRoot) return;
    this.pulseT += getDeltaTime();
    let phase = this.pulseSeconds > 0 ? this.pulseT / this.pulseSeconds : 1;
    if (phase >= 1) {
      this.pulsesLeft -= 1;
      this.pulseT = 0;
      phase = 0;
      if (this.pulsesLeft <= 0) {
        this.pulsing = false;
        this.visualRoot.getTransform().setLocalScale(new vec3(1, 1, 1));
        return;
      }
    }
    const s = 1 + (this.pulseScale - 1) * Math.sin(Math.PI * phase);
    this.visualRoot.getTransform().setLocalScale(new vec3(s, s, 1));
  }

  private rebuildTrack(color: RGBA): void {
    if (!this.trackRmv) return;
    const tw = new MeshWriter();
    this.annulusArc(tw, 0, Math.PI * 2, this.segments, color);
    tw.commit(this.trackRmv, this.material);
  }

  private updateColorPulse(): void {
    if (this.colorPulseT < 0) return;
    this.colorPulseT += getDeltaTime();
    const p = Math.min(1, this.colorPulseT / this.colorPulseSeconds);
    this.pulseK = p >= 1 ? 0 : Math.sin(Math.PI * p);
    if (p >= 1) this.colorPulseT = -1;
    // Rebuild both with the blended colours; the final frame (pulseK 0) restores the exact colours.
    const track = this.rgba(this.trackColor);
    this.rebuildTrack(this.pulseK > 0 ? lerpColor(track, this.rgba(this.pulseColor), this.pulseK) : track);
    this.rebuildArc(this.arcSegments);
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, c.w];
  }
}
