/**
 * 科技树引擎
 * 处理科技树的解锁、选择、效果编译
 */

import { hexNeighbors, hexRing } from '../core/hex';
import type {
  AdjacencyMode,
  HexCoord,
  IAdjacencyRule,
  ITechEffect,
  ITechNode,
  ITechState,
  ITile,
  IYields,
  TechTreeId,
} from '../core/types';
import { addYields, emptyYields } from '../core/yields';
import { TECH_TREE_MAP } from '../data/tech-trees';
import { getNeighborTiles, getTile, tileHasTag } from './board';

// ============ 效果缓存 ============

export interface IPatternBonus {
  target?: string;
  patternId: string;
  patternMatchTag?: string;
  patternMinCount?: number;
  yields: IYields;
}

export interface ITechEffectCache {
  /** buff_improvement: improvementId -> 额外产出 */
  improvementBuffs: Map<string, IYields>;
  /** buff_district: districtId -> 额外产出 ('__all__' for all districts) */
  districtBuffs: Map<string, IYields>;
  /** buff_terrain: terrainId -> 额外产出 */
  terrainBuffs: Map<string, IYields>;
  /** buff_feature: featureTag -> 额外产出 (matches feature/resource tags) */
  featureBuffs: Map<string, IYields>;
  /** buff_all_improvements: 全局改良加成 */
  allImprovementBuff: IYields;
  /** add_adjacency: buildingId -> 新增邻接规则 */
  additionalAdjacency: Map<string, IAdjacencyRule[]>;
  /** modify_adjacency: `buildingId:matchTag` -> 新模式 */
  modifiedAdjacency: Map<string, AdjacencyMode>;
  /** terrain_alias: terrainId -> 新增标签 */
  terrainAliases: Map<string, string[]>;
  /** make_workable: terrainId -> 可工作产出 */
  workableTerrains: Map<string, IYields>;
  /** unlock_improvement: 已解锁的改良ID */
  unlockedImprovements: Set<string>;
  /** unlock_district: 已解锁的区域ID */
  unlockedDistricts: Set<string>;
  /** reduce_cost: category -> 总降低百分比(上限80) */
  costReductions: Map<string, number>;
  /** pattern_bonus: 图案奖励列表 */
  patternBonuses: IPatternBonus[];
}

/** 将 Partial<IYields> 归一化为完整 IYields */
function fy(y: Partial<IYields> | undefined): IYields {
  return {
    gold: y?.gold || 0, food: y?.food || 0, production: y?.production || 0,
    science: y?.science || 0, culture: y?.culture || 0, faith: y?.faith || 0,
  };
}

/** 从当前科技树状态编译效果缓存 */
export function compileTechEffects(techState: ITechState): ITechEffectCache {
  const cache: ITechEffectCache = {
    improvementBuffs: new Map(),
    districtBuffs: new Map(),
    terrainBuffs: new Map(),
    featureBuffs: new Map(),
    allImprovementBuff: emptyYields(),
    additionalAdjacency: new Map(),
    modifiedAdjacency: new Map(),
    terrainAliases: new Map(),
    workableTerrains: new Map(),
    unlockedImprovements: new Set(),
    unlockedDistricts: new Set(),
    costReductions: new Map(),
    patternBonuses: [],
  };

  // 遍历所有已选节点
  for (const treeId of ['science', 'policy', 'faith'] as TechTreeId[]) {
    const tree = TECH_TREE_MAP[treeId];
    const selectedIds = techState.selectedNodes[treeId];
    for (const nodeId of selectedIds) {
      const node = tree.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      for (const effect of node.effects) {
        applyEffectToCache(cache, effect);
      }
    }
  }

  return cache;
}

function applyEffectToCache(cache: ITechEffectCache, effect: ITechEffect): void {
  switch (effect.type) {
    case 'buff_improvement': {
      if (!effect.target) break;
      const existing = cache.improvementBuffs.get(effect.target) || emptyYields();
      cache.improvementBuffs.set(effect.target, addYields(existing, fy(effect.yields)));
      break;
    }
    case 'buff_district': {
      if (!effect.target) break;
      const existing = cache.districtBuffs.get(effect.target) || emptyYields();
      cache.districtBuffs.set(effect.target, addYields(existing, fy(effect.yields)));
      break;
    }
    case 'buff_terrain': {
      if (!effect.targetTerrain) break;
      const existing = cache.terrainBuffs.get(effect.targetTerrain) || emptyYields();
      cache.terrainBuffs.set(effect.targetTerrain, addYields(existing, fy(effect.yields)));
      break;
    }
    case 'buff_feature': {
      if (!effect.targetTag) break;
      const existing = cache.featureBuffs.get(effect.targetTag) || emptyYields();
      cache.featureBuffs.set(effect.targetTag, addYields(existing, fy(effect.yields)));
      break;
    }
    case 'buff_all_improvements': {
      cache.allImprovementBuff = addYields(cache.allImprovementBuff, fy(effect.yields));
      break;
    }
    case 'add_adjacency': {
      if (!effect.target || !effect.adjacencyRule) break;
      const existing = cache.additionalAdjacency.get(effect.target) || [];
      existing.push(effect.adjacencyRule);
      cache.additionalAdjacency.set(effect.target, existing);
      break;
    }
    case 'modify_adjacency': {
      if (!effect.target || !effect.matchTag || !effect.newMode) break;
      cache.modifiedAdjacency.set(`${effect.target}:${effect.matchTag}`, effect.newMode);
      break;
    }
    case 'terrain_alias': {
      if (!effect.targetTerrain || !effect.addTag) break;
      const existing = cache.terrainAliases.get(effect.targetTerrain) || [];
      if (!existing.includes(effect.addTag)) existing.push(effect.addTag);
      cache.terrainAliases.set(effect.targetTerrain, existing);
      break;
    }
    case 'make_workable': {
      if (!effect.targetTerrain || !effect.workableYields) break;
      // 多个 make_workable 同一地形时取最后一个（或叠加？取较高值）
      const existing = cache.workableTerrains.get(effect.targetTerrain);
      if (existing) {
        // 叠加两个 make_workable 的产出
        cache.workableTerrains.set(effect.targetTerrain, addYields(existing, effect.workableYields));
      } else {
        cache.workableTerrains.set(effect.targetTerrain, { ...effect.workableYields });
      }
      break;
    }
    case 'unlock_improvement': {
      if (effect.unlockId) cache.unlockedImprovements.add(effect.unlockId);
      break;
    }
    case 'unlock_district': {
      if (effect.unlockId) cache.unlockedDistricts.add(effect.unlockId);
      break;
    }
    case 'reduce_cost': {
      if (!effect.costCategory) break;
      const current = cache.costReductions.get(effect.costCategory) || 0;
      // 叠加但上限80%
      cache.costReductions.set(effect.costCategory, Math.min(80, current + (effect.costReduction || 0)));
      break;
    }
    case 'pattern_bonus': {
      cache.patternBonuses.push({
        target: effect.target,
        patternId: effect.patternId || '',
        patternMatchTag: effect.patternMatchTag,
        patternMinCount: effect.patternMinCount,
        yields: fy(effect.yields),
      });
      break;
    }
  }
}

// ============ 科技树查询 ============

/** 创建初始科技树状态 */
export function createInitialTechState(): ITechState {
  return {
    selectedNodes: { science: [], policy: [], faith: [] },
    triggeredEurekas: [],
    effectiveThresholds: {
      science: [...TECH_TREE_MAP.science.thresholds] as [number, number, number, number],
      policy: [...TECH_TREE_MAP.policy.thresholds] as [number, number, number, number],
      faith: [...TECH_TREE_MAP.faith.thresholds] as [number, number, number, number],
    },
  };
}

/** 获取某棵树当前已解锁的最高层级 (0=无, 1-4) */
export function getMaxSelectedLayer(techState: ITechState, treeId: TechTreeId): number {
  const tree = TECH_TREE_MAP[treeId];
  let maxLayer = 0;
  for (const nodeId of techState.selectedNodes[treeId]) {
    const node = tree.nodes.find(n => n.id === nodeId);
    if (node && node.layer > maxLayer) maxLayer = node.layer;
  }
  return maxLayer;
}

/** 获取某棵树可点亮的层级 (资源已达阈值且尚未选择) */
export function getUnlockableLayer(
  techState: ITechState,
  treeId: TechTreeId,
  accumulatedResource: number,
): number {
  const thresholds = techState.effectiveThresholds[treeId];
  let unlockableLayer = 0;
  for (let i = 0; i < 4; i++) {
    if (accumulatedResource >= thresholds[i]) {
      unlockableLayer = i + 1;
    }
  }
  return unlockableLayer;
}

/** 检查节点是否可以被选择 */
export function canSelectNode(
  techState: ITechState,
  nodeId: string,
  treeId: TechTreeId,
  accumulatedResource: number,
): boolean {
  const tree = TECH_TREE_MAP[treeId];
  const node = tree.nodes.find(n => n.id === nodeId);
  if (!node) return false;

  // 已选择则不能再选
  if (techState.selectedNodes[treeId].includes(nodeId)) return false;

  // 检查资源阈值
  const thresholds = techState.effectiveThresholds[treeId];
  if (accumulatedResource < thresholds[node.layer - 1]) return false;

  // L1 节点无需父节点
  if (node.layer === 1) {
    // 检查同层是否已选择（每层只能选一个）
    const sameLayerSelected = techState.selectedNodes[treeId].some(id => {
      const n = tree.nodes.find(nn => nn.id === id);
      return n && n.layer === node.layer;
    });
    return !sameLayerSelected;
  }

  // L2+ 需要父节点已选择
  if (!node.parentId) return false;
  if (!techState.selectedNodes[treeId].includes(node.parentId)) return false;

  // 检查同层是否已选（从同一父节点分出的二选一）
  // 实际上是检查：同一层、同一父节点的兄弟节点是否已选
  const siblingSelected = techState.selectedNodes[treeId].some(id => {
    const n = tree.nodes.find(nn => nn.id === id);
    return n && n.layer === node.layer && n.parentId === node.parentId;
  });
  return !siblingSelected;
}

/** 选择节点（不做验证，调用方需先调 canSelectNode） */
export function selectNode(techState: ITechState, nodeId: string, treeId: TechTreeId): void {
  techState.selectedNodes[treeId].push(nodeId);
}

/** 获取某棵树某层的可选节点列表 */
export function getSelectableNodes(
  techState: ITechState,
  treeId: TechTreeId,
  layer: number,
): ITechNode[] {
  const tree = TECH_TREE_MAP[treeId];
  return tree.nodes.filter(node => {
    if (node.layer !== layer) return false;
    if (techState.selectedNodes[treeId].includes(node.id)) return false;

    // L1: 同层未选即可
    if (layer === 1) {
      return !techState.selectedNodes[treeId].some(id => {
        const n = tree.nodes.find(nn => nn.id === id);
        return n && n.layer === 1;
      });
    }

    // L2+: 父节点已选，且同父兄弟未选
    if (!node.parentId || !techState.selectedNodes[treeId].includes(node.parentId)) return false;
    return !techState.selectedNodes[treeId].some(id => {
      const n = tree.nodes.find(nn => nn.id === id);
      return n && n.layer === layer && n.parentId === node.parentId;
    });
  });
}

/** 根据科技树进度计算商店等级 */
export function getShopLevelFromTech(techState: ITechState): number {
  let maxLayer = 0;
  for (const treeId of ['science', 'policy', 'faith'] as TechTreeId[]) {
    const layer = getMaxSelectedLayer(techState, treeId);
    if (layer > maxLayer) maxLayer = layer;
  }
  // L1 selected -> shop 1, L2 -> shop 2, L3 -> shop 3, L4 -> shop 4
  return Math.max(1, maxLayer);
}

// ============ 图案奖励计算 ============

/** 计算图案奖励对某个地块的加成 */
export function calculatePatternBonus(
  board: Map<string, ITile>,
  coord: HexCoord,
  tile: ITile,
  cache: ITechEffectCache,
): IYields {
  let bonus = emptyYields();

  for (const pattern of cache.patternBonuses) {
    // 'surrounded_by' pattern: target building surrounded by N+ tiles with matching tag
    if (pattern.patternId === 'surrounded_by' && pattern.target && pattern.patternMatchTag && pattern.patternMinCount) {
      const buildingId = tile.improvement?.id || tile.district?.id;
      if (buildingId !== pattern.target) continue;

      const neighbors = getNeighborTiles(board, coord);
      const matchCount = neighbors.filter(n =>
        tileHasTagWithCache(n, pattern.patternMatchTag!, cache),
      ).length;

      if (matchCount >= pattern.patternMinCount) {
        bonus = addYields(bonus, pattern.yields);
      }
    }

    // 'complete_ring' pattern: if any full ring is completed, bonus per tile in that ring
    if (pattern.patternId === 'complete_ring') {
      const center: HexCoord = { q: 0, r: 0 };
      for (let ring = 1; ring <= 4; ring++) {
        const ringCoords = hexRing(center, ring);
        const allPlaced = ringCoords.every(c => {
          const t = getTile(board, c);
          return t && t.terrain !== null;
        });
        if (allPlaced) {
          // Check if this tile is in the completed ring
          if (tile.ring === ring) {
            bonus = addYields(bonus, pattern.yields);
          }
        }
      }
    }
  }

  return bonus;
}

// ============ 带科技缓存的标签检查 ============

/** 检查地块是否有某个 tag（考虑 terrain_alias） */
export function tileHasTagWithCache(tile: ITile, tag: string, cache: ITechEffectCache): boolean {
  if (tileHasTag(tile, tag)) return true;

  // 检查 terrain_alias: 地形的新增标签
  if (tile.terrain) {
    const addedTags = cache.terrainAliases.get(tile.terrain.id);
    if (addedTags && addedTags.includes(tag)) return true;
  }

  return false;
}

// ============ 尤里卡检查 ============

/** 检查具体的尤里卡条件是否满足 */
export function checkEurekaCondition(
  id: string,
  board: Map<string, ITile>,
  population: number,
  accumulatedCulture: number,
  accumulatedFaith: number,
  accumulatedScience: number,
): boolean {
  switch (id) {
    // ---- 早期 L1 ----
    case 'eureka_first_improvement': {
      for (const [, tile] of board) {
        if (tile.improvement) return true;
      }
      return false;
    }
    case 'eureka_first_district': {
      for (const [, tile] of board) {
        if (tile.district) return true;
      }
      return false;
    }
    case 'eureka_pop_3':
      return population >= 3;

    // ---- 前中期 L2 ----
    case 'eureka_2_improvements': {
      const types = new Set<string>();
      for (const [, tile] of board) {
        if (tile.improvement) types.add(tile.improvement.id);
      }
      return types.size >= 2;
    }
    case 'eureka_farms_3': {
      let count = 0;
      for (const [, tile] of board) {
        if (tile.improvement?.id === 'farm') count++;
      }
      return count >= 3;
    }
    case 'eureka_ring_complete': {
      const center: HexCoord = { q: 0, r: 0 };
      for (let ring = 1; ring <= 4; ring++) {
        const coords = hexRing(center, ring);
        if (coords.every(c => {
          const t = getTile(board, c);
          return t && t.terrain !== null;
        })) return true;
      }
      return false;
    }
    case 'eureka_pop_5':
      return population >= 5;

    // ---- 中期 L3 ----
    case 'eureka_water_tiles_5': {
      let count = 0;
      for (const [, tile] of board) {
        if (tile.terrain && tile.terrain.tags.includes('water')) count++;
      }
      return count >= 5;
    }
    case 'eureka_mountain_adj': {
      for (const [, tile] of board) {
        if (!tile.terrain || (!tile.improvement && !tile.district)) continue;
        const neighbors = hexNeighbors(tile.coord);
        let mountainCount = 0;
        for (const nc of neighbors) {
          const nt = getTile(board, nc);
          if (nt?.terrain?.id === 'mountain') mountainCount++;
        }
        if (mountainCount >= 3) return true;
      }
      return false;
    }
    case 'eureka_3_districts': {
      const types = new Set<string>();
      for (const [, tile] of board) {
        if (tile.district) types.add(tile.district.id);
      }
      return types.size >= 3;
    }
    case 'eureka_natural_5': {
      let count = 0;
      for (const [, tile] of board) {
        if (tileHasTag(tile, 'natural')) count++;
      }
      return count >= 5;
    }
    case 'eureka_pop_10':
      return population >= 10;

    // ---- 后期 L4 ----
    case 'eureka_tiles_15': {
      let count = 0;
      for (const [, tile] of board) {
        if (tile.isWorked) count++;
      }
      return count >= 15;
    }
    case 'eureka_luxury_3': {
      const luxuries = new Set<string>();
      for (const [, tile] of board) {
        if (tile.resource?.category === 'luxury') luxuries.add(tile.resource.id);
      }
      return luxuries.size >= 3;
    }
    case 'eureka_score_200':
      return (accumulatedScience + accumulatedCulture + accumulatedFaith) >= 200;
    default:
      return false;
  }
}
