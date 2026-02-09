/**
 * 六角格坐标系工具
 * 使用 Axial Coordinate (q, r)，尖顶朝上(pointy-top)
 */

import type { HexCoord } from './types';

/** 六方向偏移 */
const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },   // 右
  { q: 1, r: -1 },  // 右上
  { q: 0, r: -1 },  // 左上
  { q: -1, r: 0 },  // 左
  { q: -1, r: 1 },  // 左下
  { q: 0, r: 1 },   // 右下
];

/** 坐标→字符串 key（用于 Map 索引） */
export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/** 字符串 key→坐标 */
export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

/** 获取相邻6个坐标 */
export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

/** 两个坐标之间的距离 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/** 获取指定半径内的所有坐标（含中心） */
export function hexesInRadius(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/** 获取指定环上的坐标（距中心恰好 radius） */
export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [center];
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) === radius) {
        results.push({ q: center.q + q, r: center.r + r });
      }
    }
  }
  return results;
}

/** Axial坐标 → 像素坐标（pointy-top） */
export function hexToPixel(coord: HexCoord, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * coord.q + Math.sqrt(3) / 2 * coord.r);
  const y = size * (1.5 * coord.r);
  return { x, y };
}

/** 像素坐标 → Axial坐标（pointy-top） */
export function pixelToHex(px: number, py: number, size: number): HexCoord {
  const q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / size;
  const r = (2 / 3 * py) / size;
  return hexRound(q, r);
}

/** 浮点 Axial 坐标取整（cube round） */
function hexRound(q: number, r: number): HexCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs = -rq - rr (不需要，我们只用 q 和 r)

  return { q: rq, r: rr };
}

/** 获取六角形的6个顶点像素坐标（pointy-top） */
export function hexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: cx + size * Math.cos(angleRad),
      y: cy + size * Math.sin(angleRad),
    });
  }
  return corners;
}
