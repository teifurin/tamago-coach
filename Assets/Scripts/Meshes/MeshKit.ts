/**
 * MeshKit - shared MeshBuilder helpers for Tamago Coach's code-built primitives.
 *
 * Vertex layout: position(3) normal(3) color(4). Topology Triangles, indices UInt16.
 * Every triangle is auto-oriented against the outward normal it is given, so all
 * faces wind counter-clockwise when seen from outside (Lens Studio culls back faces).
 * Colours are "baked": on the unlit vertex-colour material each face gets a tint by its
 * normal (`defaultTint`, top brightest, bottom darkest) to keep edges readable; meshes on a
 * lit PBR material use the much milder `litTint` and let the light do the shading.
 *
 * Units are centimetres. This file is a module (no @component); import it from
 * a component script with:  import { MeshWriter } from "./MeshKit";
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type RGBA = [number, number, number, number];
export type Tint = (normal: Vec3) => number;
/** A 2D outline point with its outward unit normal (see `roundedRect`). */
export type OutlinePoint = { p: Vec2; n: Vec2 };

/** Default baked shading for the UNLIT material: top 1.0, front/back 0.86, left/right 0.74, bottom 0.6. */
export function defaultTint(n: Vec3): number {
  if (n[1] > 0.5) return 1.0;
  if (n[1] < -0.5) return 0.6;
  if (Math.abs(n[2]) > 0.5) return 0.86;
  return 0.74;
}

/** Milder baked shading for meshes on a LIT (PBR) material: top 1.0, vertical faces 0.95, bottom 0.9. */
export function litTint(n: Vec3): number {
  if (n[1] > 0.5) return 1.0;
  if (n[1] < -0.5) return 0.9;
  return 0.95;
}

export function scaleColor(c: RGBA, k: number): RGBA {
  return [c[0] * k, c[1] * k, c[2] * k, c[3]];
}

export function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

export function normalize3(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Deterministic hash noise in [-1, 1] for an integer lattice point: same input, same output, every run. */
export function hashNoise(i: number, j: number, seed: number = 0): number {
  let h = Math.imul(i + 1, 374761393) + Math.imul(j + 1, 668265263) + Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return ((h >>> 0) % 20001) / 10000 - 1;
}

/**
 * Rounded-rectangle outline in a 2D (u, v) frame: half sizes `hu` / `hv`, corner radius `r`,
 * `segs` arc segments per corner. Points come in increasing-angle order (CCW in (u, v)) with the
 * outward unit normal at every point: smooth around the corners, flat along the straight edges
 * (the two arc end points that bound a straight edge both carry that edge's normal).
 * Two outlines built with the same `segs` are index-matched, which the ring builders rely on;
 * outlines that share corner centres (hu - r equal, hv - r equal) stay concentric.
 */
export function roundedRect(hu: number, hv: number, r: number, segs: number): OutlinePoint[] {
  const rr = Math.max(0.01, Math.min(r, hu, hv));
  const cu = hu - rr;
  const cv = hv - rr;
  const corners: Vec2[] = [[cu, cv], [-cu, cv], [-cu, -cv], [cu, -cv]];
  const out: OutlinePoint[] = [];
  const n = Math.max(1, Math.round(segs));
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k <= n; k++) {
      const a = (Math.PI / 2) * (c + k / n);
      const nrm: Vec2 = [Math.cos(a), Math.sin(a)];
      out.push({ p: [corners[c][0] + rr * nrm[0], corners[c][1] + rr * nrm[1]], n: nrm });
    }
  }
  return out;
}

function pointInTri(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
  const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
  const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** O(n^2) ear clipping for a simple polygon that is CCW in its 2D (u,v) frame. */
export function triangulate2D(poly: Vec2[]): number[] {
  const n = poly.length;
  if (n < 3) return [];
  const V: number[] = [];
  for (let i = 0; i < n; i++) V.push(i);
  const tris: number[] = [];
  let guard = 3 * n;
  let i = 0;
  while (V.length > 3 && guard-- > 0) {
    const m = V.length;
    const ia = V[(i + m - 1) % m], ib = V[i % m], ic = V[(i + 1) % m];
    const a = poly[ia], b = poly[ib], c = poly[ic];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross > 0) {
      let isEar = true;
      for (let k = 0; k < m; k++) {
        const vk = V[k];
        if (vk === ia || vk === ib || vk === ic) continue;
        if (pointInTri(poly[vk], a, b, c)) { isEar = false; break; }
      }
      if (isEar) { tris.push(ia, ib, ic); V.splice(i % m, 1); continue; }
    }
    i++;
  }
  if (V.length === 3) tris.push(V[0], V[1], V[2]);
  return tris;
}

/** Returns the polygon in CCW (u,v) order (a reversed copy when the input is CW). */
export function ccw(polyIn: Vec2[]): Vec2[] {
  let area2 = 0;
  for (let k = 0; k < polyIn.length; k++) {
    const p = polyIn[k], q = polyIn[(k + 1) % polyIn.length];
    area2 += p[0] * q[1] - q[0] * p[1];
  }
  return area2 < 0 ? polyIn.slice().reverse() : polyIn;
}

export class MeshWriter {
  readonly builder: MeshBuilder;
  private verts: number[] = [];
  private indices: number[] = [];
  private count = 0;

  constructor() {
    this.builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ]);
    this.builder.topology = MeshTopology.Triangles;
    this.builder.indexType = MeshIndexType.UInt16;
  }

  get vertexCount(): number { return this.count; }
  get triangleCount(): number { return this.indices.length / 3; }

  /** Append one vertex; returns its index. */
  vertex(p: Vec3, n: Vec3, c: RGBA): number {
    this.verts.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
    return this.count++;
  }

  private pos(i: number): Vec3 {
    const o = i * 10;
    return [this.verts[o], this.verts[o + 1], this.verts[o + 2]];
  }

  /**
   * Append triangle (a,b,c), flipping it if needed so that (b-a)x(c-a) points
   * along `outward`. This is what guarantees CCW-from-outside winding.
   */
  tri(a: number, b: number, c: number, outward: Vec3): void {
    const pa = this.pos(a), pb = this.pos(b), pc = this.pos(c);
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const d = cx * outward[0] + cy * outward[1] + cz * outward[2];
    if (d >= 0) this.indices.push(a, b, c);
    else this.indices.push(a, c, b);
  }

  /** Convex planar polygon with one flat normal and one colour (fan triangulation). */
  face(points: Vec3[], normal: Vec3, color: RGBA): void {
    const base = this.count;
    for (const p of points) this.vertex(p, normal, color);
    for (let i = 1; i + 1 < points.length; i++) this.tri(base, base + i, base + i + 1, normal);
  }

  /**
   * Quad with per-vertex normals and colours (smooth shading / colour gradients). The winding
   * is fixed against `outward` (default: the sum of the four normals).
   */
  quad(p: Vec3[], n: Vec3[], c: RGBA[], outward?: Vec3): void {
    const o: Vec3 = outward
      ? outward
      : [n[0][0] + n[1][0] + n[2][0] + n[3][0], n[0][1] + n[1][1] + n[2][1] + n[3][1], n[0][2] + n[1][2] + n[2][2] + n[3][2]];
    const base = this.count;
    for (let k = 0; k < 4; k++) this.vertex(p[k], n[k], c[k]);
    this.tri(base, base + 1, base + 2, o);
    this.tri(base, base + 2, base + 3, o);
  }

  /** Triangle with per-vertex normals and colours; winding fixed against `outward`. */
  tri3(p: Vec3[], n: Vec3[], c: RGBA[], outward: Vec3): void {
    const base = this.count;
    for (let k = 0; k < 3; k++) this.vertex(p[k], n[k], c[k]);
    this.tri(base, base + 1, base + 2, outward);
  }

  /**
   * Axis-aligned box from `min` corner to `max` corner, 24 vertices (4 per face,
   * each face carrying its own normal and tinted colour). `topColor` optionally
   * overrides the colour of the +Y face only.
   */
  box(min: Vec3, max: Vec3, color: RGBA, tint: Tint = defaultTint, topColor?: RGBA): void {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const faces: { n: Vec3; pts: Vec3[] }[] = [
      { n: [1, 0, 0],  pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
      { n: [-1, 0, 0], pts: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]] },
      { n: [0, 1, 0],  pts: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]] },
      { n: [0, -1, 0], pts: [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]] },
      { n: [0, 0, 1],  pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
      { n: [0, 0, -1], pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
    ];
    for (const f of faces) {
      const base = f.n[1] > 0.5 && topColor ? topColor : color;
      this.face(f.pts, f.n, scaleColor(base, tint(f.n)));
    }
  }

  /**
   * Flat prism: a simple polygon drawn in the XZ plane (u -> x, v -> z), extruded
   * from yBottom to yTop. Top face normal +Y, bottom -Y, side walls outward.
   * Any polygon orientation is accepted (it is normalised to CCW in (u,v) first).
   */
  prismY(polyIn: Vec2[], yBottom: number, yTop: number, color: RGBA, tint: Tint = defaultTint): void {
    this.prismYShaded(polyIn, yBottom, yTop, () => color, tint);
  }

  /**
   * Like `prismY`, but the colour is sampled per outline point through `colorAt(u, v)`, so a
   * gradient along the outline is interpolated across the top, bottom and side faces.
   */
  prismYShaded(polyIn: Vec2[], yBottom: number, yTop: number, colorAt: (u: number, v: number) => RGBA, tint: Tint = defaultTint): void {
    const poly = ccw(polyIn);
    const n = poly.length;
    const tris = triangulate2D(poly);
    const topN: Vec3 = [0, 1, 0];
    const botN: Vec3 = [0, -1, 0];
    const topK = tint(topN);
    const botK = tint(botN);

    const topBase = this.count;
    for (const p of poly) this.vertex([p[0], yTop, p[1]], topN, scaleColor(colorAt(p[0], p[1]), topK));
    for (let t = 0; t < tris.length; t += 3) {
      this.tri(topBase + tris[t], topBase + tris[t + 1], topBase + tris[t + 2], topN);
    }

    const botBase = this.count;
    for (const p of poly) this.vertex([p[0], yBottom, p[1]], botN, scaleColor(colorAt(p[0], p[1]), botK));
    for (let t = 0; t < tris.length; t += 3) {
      this.tri(botBase + tris[t], botBase + tris[t + 1], botBase + tris[t + 2], botN);
    }

    for (let k = 0; k < n; k++) {
      const p0 = poly[k], p1 = poly[(k + 1) % n];
      const du = p1[0] - p0[0], dv = p1[1] - p0[1];
      const len = Math.hypot(du, dv) || 1;
      // Right-hand perpendicular of the edge = outward for a CCW polygon in (u,v).
      const sn: Vec3 = [dv / len, 0, -du / len];
      const k0 = tint(sn);
      const c0 = scaleColor(colorAt(p0[0], p0[1]), k0);
      const c1 = scaleColor(colorAt(p1[0], p1[1]), k0);
      this.quad(
        [[p0[0], yBottom, p0[1]], [p1[0], yBottom, p1[1]], [p1[0], yTop, p1[1]], [p0[0], yTop, p0[1]]],
        [sn, sn, sn, sn],
        [c0, c1, c1, c0],
        sn,
      );
    }
  }

  /** Upload everything to a RenderMeshVisual and assign the material (if one is given). */
  commit(rmv: RenderMeshVisual, material: Material | undefined | null): void {
    this.builder.appendVerticesInterleaved(this.verts);
    this.builder.appendIndices(this.indices);
    rmv.mesh = this.builder.getMesh();
    if (material) rmv.mainMaterial = material;
    this.builder.updateMesh();
  }
}
