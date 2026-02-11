/**
 * 模型映射配置
 * 将游戏实体 (地形/地物/改良/区域) 映射到 Kenney Hexagon Kit GLB 文件名
 *
 * Kenney 模型特点：
 * - 每个 building-*.glb 是完整的六角地块 + 建筑
 * - 地形 *.glb 是纯六角地块
 * - 模型原始方向为 flat-top，需旋转 π/6 适配 pointy-top
 */

import type { ITile } from '../core/types';

// ---- 基础地形 → 模型 ----
const TERRAIN_MODELS: Record<string, string> = {
  city_center: 'building-castle.glb',
  grassland: 'grass.glb',
  plains: 'dirt.glb',
  desert: 'sand.glb',
  tundra: 'stone.glb',
  mountain: 'stone-mountain.glb',
  lake: 'water.glb',
};

// ---- 地形 + 地物组合 → 模型 (优先使用) ----
const TERRAIN_FEATURE_MODELS: Record<string, Record<string, string>> = {
  grassland: {
    hills: 'grass-hill.glb',
    forest: 'grass-forest.glb',
    rainforest: 'grass-forest.glb',
    marsh: 'water-rocks.glb',
    oasis: 'water-island.glb',
  },
  plains: {
    hills: 'stone-hill.glb',
    forest: 'grass-forest.glb',
    rainforest: 'grass-forest.glb',
    marsh: 'water-rocks.glb',
    oasis: 'water-island.glb',
  },
  desert: {
    hills: 'sand-rocks.glb',
    forest: 'sand-desert.glb',
    rainforest: 'sand-desert.glb',
    marsh: 'sand-rocks.glb',
    oasis: 'water-island.glb',
  },
  tundra: {
    hills: 'stone-hill.glb',
    forest: 'stone-rocks.glb',
    rainforest: 'stone-rocks.glb',
    marsh: 'water-rocks.glb',
    oasis: 'water-island.glb',
  },
};

// ---- 改良设施 → 模型 (完整六角 + 建筑) ----
const IMPROVEMENT_MODELS: Record<string, string> = {
  farm: 'building-farm.glb',
  mine: 'building-mine.glb',
  trading_post: 'building-market.glb',
  lumber_mill: 'building-mill.glb',
  plantation: 'building-sheep.glb',
  solar_farm: 'building-watermill.glb',
  hunting_ground: 'building-archery.glb',
};

// ---- 区域 → 模型 (完整六角 + 建筑) ----
const DISTRICT_MODELS: Record<string, string> = {
  campus: 'building-wizard-tower.glb',
  commercial_hub: 'building-port.glb',
  holy_site: 'building-tower.glb',
  theater_square: 'building-village.glb',
  industrial_zone: 'building-smelter.glb',
};

/**
 * 根据地块当前状态，返回应使用的 GLB 文件名
 * 优先级: 区域 > 改良 > 地形+地物 > 纯地形
 * 返回 null 表示该地块无可用模型 (未解锁/空地)
 */
export function getModelForTile(tile: ITile): string | null {
  if (!tile.unlocked || !tile.terrain) return null;

  // 区域
  if (tile.district) {
    return DISTRICT_MODELS[tile.district.id] ?? null;
  }

  // 改良
  if (tile.improvement) {
    return IMPROVEMENT_MODELS[tile.improvement.id] ?? null;
  }

  // 地形 + 地物
  if (tile.feature) {
    const combo = TERRAIN_FEATURE_MODELS[tile.terrain.id]?.[tile.feature.id];
    if (combo) return combo;
  }

  // 纯地形
  return TERRAIN_MODELS[tile.terrain.id] ?? null;
}

/**
 * 获取所有可能用到的模型文件名列表 (用于预加载)
 */
export function getAllModelFileNames(): string[] {
  const set = new Set<string>();
  for (const v of Object.values(TERRAIN_MODELS)) set.add(v);
  for (const m of Object.values(TERRAIN_FEATURE_MODELS)) {
    for (const v of Object.values(m)) set.add(v);
  }
  for (const v of Object.values(IMPROVEMENT_MODELS)) set.add(v);
  for (const v of Object.values(DISTRICT_MODELS)) set.add(v);
  return [...set];
}
