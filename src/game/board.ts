/**
 * 棋盘管理
 * 负责棋盘初始化、地块操作、Tag查询、工人分配
 * 4环棋盘（61格），支持人口解锁和金币解锁
 */

import { hexDistance, hexKey, hexNeighbors, hexRing } from '../core/hex';
import type { HexCoord, IAdjacencyRule, ITile, IYields } from '../core/types';
import { addYields, emptyYields, scaleYields, totalYieldValue } from '../core/yields';
import { CITY_CENTER } from '../data/terrains';

/** 最大环数 */
export const MAX_RING = 4;

/**
 * 升级收益（几何递减边际收益）
 * 早期给 +4, +2, +2, +2, 之后每级稳定 +1
 * @param level 当前等级 (>=1)
 * @returns 累计主产出加成
 */
export function upgradeYieldBonus(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) {
    total += Math.max(1, Math.floor(4 / Math.sqrt(l - 1)));
  }
  return total;
}

/**
 * 升级时该级的边际收益 (用于 UI 显示)
 * @param nextLevel 即将升到的等级
 */
export function upgradeMarginalYield(nextLevel: number): number {
  if (nextLevel <= 1) return 0;
  return Math.max(1, Math.floor(4 / Math.sqrt(nextLevel - 1)));
}

/** 获取六角格所在的环数 (距离中心的距离) */
export function getHexRing(coord: HexCoord): number {
  return hexDistance(coord, { q: 0, r: 0 });
}

/** 创建初始棋盘（4环，61格） */
export function createBoard(): Map<string, ITile> {
  const board = new Map<string, ITile>();
  const center: HexCoord = { q: 0, r: 0 };

  // Ring 0: 城市中心（始终工作，不占人口）
  board.set(hexKey(center), {
    coord: center,
    terrain: CITY_CENTER,
    feature: null,
    resource: null,
    improvement: null,
    improvementLevel: 0,
    district: null,
    districtLevel: 0,
    unlocked: true,
    isWorked: true,
    goldInvested: 0,
    productionInvested: 0,
    ring: 0,
  });

  // Ring 1: 已解锁的空格
  for (const coord of hexRing(center, 1)) {
    board.set(hexKey(coord), {
      coord,
      terrain: null,
      feature: null,
      resource: null,
      improvement: null,
      improvementLevel: 0,
      district: null,
      districtLevel: 0,
      unlocked: true,
      isWorked: false,
      goldInvested: 0,
      productionInvested: 0,
      ring: 1,
    });
  }

  // Ring 2-4: 锁定的空格
  for (let r = 2; r <= MAX_RING; r++) {
    for (const coord of hexRing(center, r)) {
      board.set(hexKey(coord), {
        coord,
        terrain: null,
        feature: null,
        resource: null,
        improvement: null,
        improvementLevel: 0,
        district: null,
        districtLevel: 0,
        unlocked: false,
        isWorked: false,
        goldInvested: 0,
        productionInvested: 0,
        ring: r,
      });
    }
  }

  return board;
}

/** 获取地块 */
export function getTile(board: Map<string, ITile>, coord: HexCoord): ITile | undefined {
  return board.get(hexKey(coord));
}

/** 获取相邻地块列表（只返回有地形的邻居） */
export function getNeighborTiles(board: Map<string, ITile>, coord: HexCoord): ITile[] {
  return hexNeighbors(coord)
    .map(c => board.get(hexKey(c)))
    .filter((t): t is ITile => t !== undefined && t.terrain !== null);
}

/** 检查地块是否拥有某个 tag */
export function tileHasTag(tile: ITile, tag: string): boolean {
  if (!tile.terrain) return false;
  if (tile.terrain.tags.includes(tag)) return true;
  if (tile.feature?.tags.includes(tag)) return true;
  if (tile.resource?.tags.includes(tag)) return true;
  if (tile.improvement?.tags.includes(tag)) return true;
  if (tile.district?.tags.includes(tag)) return true;
  return false;
}

/**
 * 带别名的 tag 检查
 * aliasReverse: Map<目标tag, 源tag[]>
 * 例如 alias "mountain→cold" 时，aliasReverse.get("cold") = ["mountain"]
 */
export function tileHasTagWithAliases(
  tile: ITile,
  tag: string,
  aliasReverse: Map<string, string[]>,
): boolean {
  if (tileHasTag(tile, tag)) return true;
  const sources = aliasReverse.get(tag);
  if (sources) {
    for (const src of sources) {
      if (tileHasTag(tile, src)) return true;
    }
  }
  return false;
}

/** 计算单条邻接规则的加成 */
export function calculateAdjacencyBonus(
  rule: IAdjacencyRule,
  neighbors: ITile[]
): IYields {
  const matchCount = neighbors.filter(n => tileHasTag(n, rule.matchTag)).length;

  switch (rule.mode) {
    case 'per_each':
      return scaleYields(rule.bonus, matchCount);
    case 'per_two':
      return scaleYields(rule.bonus, Math.floor(matchCount / 2));
    case 'flat_if_any':
      return matchCount > 0 ? { ...rule.bonus } : emptyYields();
  }
}

/** 计算单个地块的总产出（含邻接），不考虑是否工作 */
export function calculateTileYields(
  board: Map<string, ITile>,
  coord: HexCoord
): IYields {
  const tile = getTile(board, coord);
  if (!tile || !tile.terrain) return emptyYields();

  // 1. 地形基础产出
  let yields = { ...tile.terrain.baseYields };

  // 2. 地貌修正
  if (tile.feature) {
    yields = addYields(yields, tile.feature.yieldModifier);
  }

  // 3. 资源加成
  if (tile.resource) {
    yields = addYields(yields, tile.resource.yieldBonus);
  }

  // 获取邻居（用于邻接计算）
  const neighbors = getNeighborTiles(board, coord);

  // 4. 改良设施产出 + 邻接
  if (tile.improvement) {
    yields = addYields(yields, tile.improvement.yields);

    // 升级加成 (递减边际): Lv2 → +4, Lv3 → +6, Lv4 → +8, ...
    if (tile.improvementLevel > 1) {
      const bonus = emptyYields();
      bonus[tile.improvement.upgradePrimaryYield] = upgradeYieldBonus(tile.improvementLevel);
      yields = addYields(yields, bonus);
    }

    for (const rule of tile.improvement.adjacencyRules) {
      yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors));
    }
  }

  // 5. 区域产出 + 邻接 + 区域升级加成
  if (tile.district) {
    yields = addYields(yields, tile.district.baseYields);

    // 区域升级加成 (递减边际)
    if (tile.districtLevel > 1 && tile.district.upgradePrimaryYield) {
      const bonus = emptyYields();
      bonus[tile.district.upgradePrimaryYield] = upgradeYieldBonus(tile.districtLevel);
      yields = addYields(yields, bonus);
    }

    for (const rule of tile.district.adjacencyRules) {
      yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors));
    }
  }

  return yields;
}

/** 计算棋盘所有 **工作中** 地块的总产出 */
export function calculateTotalYields(board: Map<string, ITile>): IYields {
  let total = emptyYields();
  for (const [, tile] of board) {
    if (tile.terrain && tile.isWorked) {
      total = addYields(total, calculateTileYields(board, tile.coord));
    }
  }
  return total;
}

// ============ 工人管理 ============

/** 获取已分配工人数（不含城市中心） */
export function getWorkedNonCityCount(board: Map<string, ITile>): number {
  let count = 0;
  for (const [, tile] of board) {
    if (tile.isWorked && tile.terrain && tile.terrain.id !== 'city_center') {
      count++;
    }
  }
  return count;
}

/** 自动分配工人到产出最高的空闲地块（全局总值最优） */
export function autoAssignBestWorker(board: Map<string, ITile>): HexCoord | null {
  let bestCoord: HexCoord | null = null;
  let bestValue = -1;

  for (const [, tile] of board) {
    if (tile.terrain && !tile.isWorked && tile.terrain.id !== 'city_center') {
      const yields = calculateTileYields(board, tile.coord);
      const value = totalYieldValue(yields);
      if (value > bestValue) {
        bestValue = value;
        bestCoord = tile.coord;
      }
    }
  }

  if (bestCoord) {
    const tile = getTile(board, bestCoord);
    if (tile) tile.isWorked = true;
  }

  return bestCoord;
}

/** 自动分配工人到食物产出最高的空闲地块（粮食优先） */
export function autoAssignBestFoodWorker(board: Map<string, ITile>): HexCoord | null {
  let bestCoord: HexCoord | null = null;
  let bestFood = -1;
  let bestTotalTieBreak = -1;

  for (const [, tile] of board) {
    if (tile.terrain && !tile.isWorked && tile.terrain.id !== 'city_center') {
      const yields = calculateTileYields(board, tile.coord);
      // 主要按食物排序，食物相同则按总值排序
      if (yields.food > bestFood || (yields.food === bestFood && totalYieldValue(yields) > bestTotalTieBreak)) {
        bestFood = yields.food;
        bestTotalTieBreak = totalYieldValue(yields);
        bestCoord = tile.coord;
      }
    }
  }

  if (bestCoord) {
    const tile = getTile(board, bestCoord);
    if (tile) tile.isWorked = true;
  }

  return bestCoord;
}

/** 自动取消产出最低的工作地块的工人 */
export function autoUnassignWorstWorker(board: Map<string, ITile>): HexCoord | null {
  let worstCoord: HexCoord | null = null;
  let worstValue = Infinity;

  for (const [, tile] of board) {
    if (tile.isWorked && tile.terrain && tile.terrain.id !== 'city_center') {
      const yields = calculateTileYields(board, tile.coord);
      const value = totalYieldValue(yields);
      if (value < worstValue) {
        worstValue = value;
        worstCoord = tile.coord;
      }
    }
  }

  if (worstCoord) {
    const tile = getTile(board, worstCoord);
    if (tile) tile.isWorked = false;
  }

  return worstCoord;
}

// ============ 棋盘空间管理 ============

/** 解锁下一个外圈格子（优先低环数，再优先有已放置邻居的） */
export function unlockNextOuterHex(board: Map<string, ITile>): HexCoord | null {
  const center: HexCoord = { q: 0, r: 0 };

  for (let ring = 2; ring <= MAX_RING; ring++) {
    const ringHexes = hexRing(center, ring);

    let bestCoord: HexCoord | null = null;
    let bestScore = -1;

    for (const coord of ringHexes) {
      const tile = getTile(board, coord);
      if (!tile || tile.unlocked) continue;

      const neighbors = hexNeighbors(coord);
      const placedNeighborCount = neighbors.filter(n => {
        const nt = getTile(board, n);
        return nt && nt.terrain !== null;
      }).length;

      // 优先选择有相邻已放置地块的格子
      const unlockedNeighborCount = neighbors.filter(n => {
        const nt = getTile(board, n);
        return nt && nt.unlocked;
      }).length;

      const score = placedNeighborCount * 10 + unlockedNeighborCount;
      if (score > bestScore) {
        bestScore = score;
        bestCoord = coord;
      }
    }

    if (bestCoord) {
      const tile = getTile(board, bestCoord);
      if (tile) tile.unlocked = true;
      return bestCoord;
    }
  }

  return null;
}

/** 获取所有已解锁且为空的格子 */
export function getEmptyUnlockedHexes(board: Map<string, ITile>): HexCoord[] {
  const result: HexCoord[] = [];
  for (const [, tile] of board) {
    if (tile.unlocked && !tile.terrain) {
      result.push(tile.coord);
    }
  }
  return result;
}

/** 获取所有有地形且可建造的格子 */
export function getBuildableHexes(board: Map<string, ITile>): HexCoord[] {
  const result: HexCoord[] = [];
  for (const [, tile] of board) {
    if (tile.terrain && tile.terrain.buildable) {
      result.push(tile.coord);
    }
  }
  return result;
}

/** 获取指定环的已解锁数量 */
export function getRingUnlockedCount(board: Map<string, ITile>, ring: number): number {
  const center: HexCoord = { q: 0, r: 0 };
  let count = 0;
  for (const coord of hexRing(center, ring)) {
    const tile = getTile(board, coord);
    if (tile && tile.unlocked) count++;
  }
  return count;
}

/** 获取所有可金币解锁的锁定格子 (需要至少一个相邻已解锁格) */
export function getGoldUnlockableHexes(board: Map<string, ITile>): ITile[] {
  const result: ITile[] = [];
  for (const [, tile] of board) {
    if (tile.unlocked || tile.ring <= 1) continue;

    // 至少有一个相邻已解锁的格子
    const neighbors = hexNeighbors(tile.coord);
    const hasUnlockedNeighbor = neighbors.some(n => {
      const nt = getTile(board, n);
      return nt && nt.unlocked;
    });

    if (hasUnlockedNeighbor) {
      result.push(tile);
    }
  }
  return result;
}

/** 获取总外圈已解锁数量 */
export function getTotalOuterUnlockedCount(board: Map<string, ITile>): number {
  let count = 0;
  for (const [, tile] of board) {
    if (tile.ring >= 2 && tile.unlocked) count++;
  }
  return count;
}
