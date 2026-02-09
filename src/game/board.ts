/**
 * 棋盘管理
 * 负责棋盘初始化、地块操作、Tag查询、工人分配
 */

import { hexKey, hexNeighbors, hexRing } from '../core/hex';
import type { HexCoord, IAdjacencyRule, ITile, IYields } from '../core/types';
import { addYields, emptyYields, scaleYields, totalYieldValue } from '../core/yields';
import { CITY_CENTER } from '../data/terrains';

/** 创建初始棋盘（2环，19格） */
export function createBoard(): Map<string, ITile> {
  const board = new Map<string, ITile>();

  // Ring 0: 城市中心（始终工作，不占人口）
  const centerCoord: HexCoord = { q: 0, r: 0 };
  board.set(hexKey(centerCoord), {
    coord: centerCoord,
    terrain: CITY_CENTER,
    feature: null,
    resource: null,
    improvement: null,
    improvementLevel: 0,
    district: null,
    unlocked: true,
    isWorked: true,
  });

  // Ring 1: 已解锁的空格
  for (const coord of hexRing(centerCoord, 1)) {
    board.set(hexKey(coord), {
      coord,
      terrain: null,
      feature: null,
      resource: null,
      improvement: null,
      improvementLevel: 0,
      district: null,
      unlocked: true,
      isWorked: false,
    });
  }

  // Ring 2: 锁定的空格（需要人口解锁）
  for (const coord of hexRing(centerCoord, 2)) {
    board.set(hexKey(coord), {
      coord,
      terrain: null,
      feature: null,
      resource: null,
      improvement: null,
      improvementLevel: 0,
      district: null,
      unlocked: false,
      isWorked: false,
    });
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

    // 升级加成：每级 +1 主要产出
    if (tile.improvementLevel > 1) {
      const upgradeBonus = emptyYields();
      upgradeBonus[tile.improvement.upgradePrimaryYield] = tile.improvementLevel - 1;
      yields = addYields(yields, upgradeBonus);
    }

    for (const rule of tile.improvement.adjacencyRules) {
      yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors));
    }
  }

  // 5. 区域产出 + 邻接
  if (tile.district) {
    yields = addYields(yields, tile.district.baseYields);

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

/** 自动分配工人到产出最高的空闲地块 */
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

/** 解锁下一个 Ring-2 格子（优先选择有已放置邻居的） */
export function unlockNextRing2Hex(board: Map<string, ITile>): HexCoord | null {
  const ring2Hexes = hexRing({ q: 0, r: 0 }, 2);

  let bestCoord: HexCoord | null = null;
  let bestScore = -1;

  for (const coord of ring2Hexes) {
    const tile = getTile(board, coord);
    if (!tile || tile.unlocked) continue;

    const neighbors = hexNeighbors(coord);
    const placedNeighborCount = neighbors.filter(n => {
      const nt = getTile(board, n);
      return nt && nt.terrain !== null;
    }).length;

    if (placedNeighborCount > bestScore) {
      bestScore = placedNeighborCount;
      bestCoord = coord;
    }
  }

  if (bestCoord) {
    const tile = getTile(board, bestCoord);
    if (tile) {
      tile.unlocked = true;
    }
  }

  return bestCoord;
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

/** 获取 Ring-2 已解锁数量 */
export function getRing2UnlockedCount(board: Map<string, ITile>): number {
  let count = 0;
  for (const coord of hexRing({ q: 0, r: 0 }, 2)) {
    const tile = getTile(board, coord);
    if (tile && tile.unlocked) count++;
  }
  return count;
}
