/**
 * 棋盘管理
 * 负责棋盘初始化、地块操作、Tag查询、工人分配
 * 4环棋盘（61格），支持人口解锁和金币解锁
 */

import { hexDistance, hexKey, hexNeighbors, hexRing } from '../core/hex';
import type { AdjacencyMode, HexCoord, IAdjacencyRule, ITile, IYields } from '../core/types';
import { addYields, emptyYields, scaleYields, totalYieldValue } from '../core/yields';
import { CITY_CENTER } from '../data/terrains';
import type { ITechEffectCache } from './tech-engine';

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
  neighbors: ITile[],
  modeOverride?: AdjacencyMode,
  techCache?: ITechEffectCache,
): IYields {
  const mode = modeOverride || rule.mode;
  // 如果有科技缓存，使用带别名的标签匹配
  const matchCount = techCache
    ? neighbors.filter(n => tileHasTagWithCache(n, rule.matchTag, techCache)).length
    : neighbors.filter(n => tileHasTag(n, rule.matchTag)).length;

  switch (mode) {
    case 'per_each':
      return scaleYields(rule.bonus, matchCount);
    case 'per_two':
      return scaleYields(rule.bonus, Math.floor(matchCount / 2));
    case 'flat_if_any':
      return matchCount > 0 ? { ...rule.bonus } : emptyYields();
  }
}

/** 检查地块是否有某个 tag（考虑 terrain_alias） */
function tileHasTagWithCache(tile: ITile, tag: string, cache: ITechEffectCache): boolean {
  if (tileHasTag(tile, tag)) return true;
  if (tile.terrain) {
    const addedTags = cache.terrainAliases.get(tile.terrain.id);
    if (addedTags && addedTags.includes(tag)) return true;
  }
  return false;
}

/** 计算单个地块的总产出（含邻接+科技树效果），不考虑是否工作 */
export function calculateTileYields(
  board: Map<string, ITile>,
  coord: HexCoord,
  techCache?: ITechEffectCache,
): IYields {
  const tile = getTile(board, coord);
  if (!tile || !tile.terrain) return emptyYields();

  // make_workable: 不可建造地形的基础产出可能被科技树替换
  let isWorkable = true;
  let baseTerrainYields = { ...tile.terrain.baseYields };
  if (!tile.terrain.buildable && tile.terrain.id !== 'city_center') {
    if (techCache) {
      const workableYields = techCache.workableTerrains.get(tile.terrain.id);
      if (workableYields) {
        baseTerrainYields = { ...workableYields };
      } else {
        isWorkable = false;
      }
    } else {
      // 无科技缓存时，lake 等自带产出的保持
      if (tile.terrain.tags.includes('water') && tile.terrain.id === 'lake') {
        // lake is workable by default
      } else if (tile.terrain.baseYields.gold === 0 && tile.terrain.baseYields.food === 0 &&
        tile.terrain.baseYields.production === 0 && tile.terrain.baseYields.science === 0 &&
        tile.terrain.baseYields.culture === 0 && tile.terrain.baseYields.faith === 0) {
        isWorkable = false;
      }
    }
  }

  // 1. 地形基础产出
  let yields = baseTerrainYields;

  // 1b. 科技树地形加成
  if (techCache) {
    const terrainBuff = techCache.terrainBuffs.get(tile.terrain.id);
    if (terrainBuff) yields = addYields(yields, terrainBuff);
  }

  // 2. 地貌修正
  if (tile.feature) {
    yields = addYields(yields, tile.feature.yieldModifier);

    // 2b. 科技树地貌加成 (匹配 feature 的任意 tag)
    if (techCache) {
      for (const tag of tile.feature.tags) {
        const featureBuff = techCache.featureBuffs.get(tag);
        if (featureBuff) yields = addYields(yields, featureBuff);
      }
    }
  }

  // 3. 资源加成
  if (tile.resource) {
    yields = addYields(yields, tile.resource.yieldBonus);

    // 3b. 科技树资源标签加成 (如 luxury_resource 的 buff)
    if (techCache) {
      for (const tag of tile.resource.tags) {
        const resourceBuff = techCache.featureBuffs.get(tag);
        if (resourceBuff) yields = addYields(yields, resourceBuff);
      }
    }
  }

  // 如果地形不可工作且未被科技树解锁，只返回基础（不含建筑）
  if (!isWorkable && !tile.improvement && !tile.district) {
    return yields;
  }

  // 获取邻居（用于邻接计算）
  const neighbors = getNeighborTiles(board, coord);

  // 4. 改良设施产出 + 邻接
  if (tile.improvement) {
    yields = addYields(yields, tile.improvement.yields);

    // 科技树改良加成
    if (techCache) {
      const impBuff = techCache.improvementBuffs.get(tile.improvement.id);
      if (impBuff) yields = addYields(yields, impBuff);
      // 全局改良加成
      yields = addYields(yields, techCache.allImprovementBuff);
    }

    // 升级加成 (递减边际)
    if (tile.improvementLevel > 1) {
      const bonus = emptyYields();
      bonus[tile.improvement.upgradePrimaryYield] = upgradeYieldBonus(tile.improvementLevel);
      yields = addYields(yields, bonus);
    }

    // 原有邻接规则（可能被科技树修改模式）
    for (const rule of tile.improvement.adjacencyRules) {
      const modeKey = `${tile.improvement.id}:${rule.matchTag}`;
      const overrideMode = techCache?.modifiedAdjacency.get(modeKey);
      yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors, overrideMode, techCache));
    }

    // 科技树新增邻接规则
    if (techCache) {
      const extraRules = techCache.additionalAdjacency.get(tile.improvement.id);
      if (extraRules) {
        for (const rule of extraRules) {
          yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors, undefined, techCache));
        }
      }
    }
  }

  // 5. 区域产出 + 邻接 + 区域升级加成
  if (tile.district) {
    yields = addYields(yields, tile.district.baseYields);

    // 科技树区域加成
    if (techCache) {
      const distBuff = techCache.districtBuffs.get(tile.district.id);
      if (distBuff) yields = addYields(yields, distBuff);
      // '__all__' 全区域加成
      const allDistBuff = techCache.districtBuffs.get('__all__');
      if (allDistBuff) yields = addYields(yields, allDistBuff);
    }

    // 区域升级加成 (递减边际)
    if (tile.districtLevel > 1 && tile.district.upgradePrimaryYield) {
      const bonus = emptyYields();
      bonus[tile.district.upgradePrimaryYield] = upgradeYieldBonus(tile.districtLevel);
      yields = addYields(yields, bonus);
    }

    // 原有邻接规则（可能被修改）
    for (const rule of tile.district.adjacencyRules) {
      const modeKey = `${tile.district.id}:${rule.matchTag}`;
      const overrideMode = techCache?.modifiedAdjacency.get(modeKey);
      yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors, overrideMode, techCache));
    }

    // 科技树新增邻接规则
    if (techCache) {
      const extraRules = techCache.additionalAdjacency.get(tile.district.id);
      if (extraRules) {
        for (const rule of extraRules) {
          yields = addYields(yields, calculateAdjacencyBonus(rule, neighbors, undefined, techCache));
        }
      }
    }
  }

  // 6. 图案奖励
  if (techCache && techCache.patternBonuses.length > 0) {
    // Import dynamically to avoid circular deps - inline implementation
    for (const pattern of techCache.patternBonuses) {
      if (pattern.patternId === 'surrounded_by' && pattern.target && pattern.patternMatchTag && pattern.patternMinCount) {
        const buildingId = tile.improvement?.id || tile.district?.id;
        if (buildingId !== pattern.target) continue;
        const matchCount = neighbors.filter(n =>
          tileHasTagWithCache(n, pattern.patternMatchTag!, techCache),
        ).length;
        if (matchCount >= pattern.patternMinCount) {
          yields = addYields(yields, pattern.yields);
        }
      }
      if (pattern.patternId === 'complete_ring') {
        const center: HexCoord = { q: 0, r: 0 };
        for (let ring = 1; ring <= MAX_RING; ring++) {
          const ringCoords = hexRing(center, ring);
          if (tile.ring === ring && ringCoords.every(c => {
            const t = getTile(board, c);
            return t && t.terrain !== null;
          })) {
            yields = addYields(yields, pattern.yields);
          }
        }
      }
    }
  }

  return yields;
}

/** 计算棋盘所有 **工作中** 地块的总产出 */
export function calculateTotalYields(
  board: Map<string, ITile>,
  techCache?: ITechEffectCache,
): IYields {
  let total = emptyYields();
  for (const [, tile] of board) {
    if (tile.terrain && tile.isWorked) {
      total = addYields(total, calculateTileYields(board, tile.coord, techCache));
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
