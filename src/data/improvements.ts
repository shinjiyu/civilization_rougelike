/**
 * 改良设施数据定义
 * 纯数据，不含逻辑
 * 改良设施通过消耗生产力在地块上建造
 */

import type { IImprovement } from '../core/types';

export const FARM: IImprovement = {
  id: 'farm',
  name: '农场',
  yields: { gold: 0, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'food',
  adjacencyRules: [
    {
      matchTag: 'farm',
      bonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'per_each',
      description: '每个相邻农场 +1🌾',
    },
  ],
  placementRequireTags: ['fertile'],
  tags: ['farm', 'improvement'],
  icon: '🌾',
  productionCost: 8,
  terrainHint: '需要肥沃土地（草地/平原）',
};

export const MINE: IImprovement = {
  id: 'mine',
  name: '矿山',
  yields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'production',
  adjacencyRules: [
    {
      matchTag: 'mine',
      bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻矿山 +1⚙️',
    },
  ],
  placementRequireTags: ['hill'],
  tags: ['mine', 'improvement'],
  icon: '⛏️',
  productionCost: 8,
  terrainHint: '需要丘陵地形',
};

export const TRADING_POST: IImprovement = {
  id: 'trading_post',
  name: '商站',
  yields: { gold: 3, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
  adjacencyRules: [
    {
      matchTag: 'district',
      bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'per_each',
      description: '每个相邻区域 +1🪙',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['trading_post', 'improvement'],
  icon: '🏪',
  productionCost: 8,
  terrainHint: '任何可建造地形',
  shopPool: 'gold',
};

export const LUMBER_MILL: IImprovement = {
  id: 'lumber_mill',
  name: '伐木场',
  yields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'production',
  adjacencyRules: [],
  placementRequireTags: ['forest'],
  tags: ['lumber_mill', 'improvement'],
  icon: '🪓',
  productionCost: 8,
  terrainHint: '需要森林地貌',
  shopPool: 'culture',
};

export const PLANTATION: IImprovement = {
  id: 'plantation',
  name: '种植园',
  yields: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
  adjacencyRules: [
    {
      matchTag: 'luxury_resource',
      bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'flat_if_any',
      description: '若有相邻奢侈资源 +1🪙',
    },
  ],
  placementRequireTags: ['flat', 'buildable'],
  tags: ['plantation', 'improvement'],
  icon: '🌿',
  productionCost: 8,
  terrainHint: '需要平坦且可建造的地形',
};

/** 沙漠专属: 太阳能农场 */
export const SOLAR_FARM: IImprovement = {
  id: 'solar_farm',
  name: '太阳能农场',
  yields: { gold: 1, food: 0, production: 2, science: 1, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'production',
  adjacencyRules: [
    {
      matchTag: 'arid',
      bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
      mode: 'per_each',
      description: '每个相邻沙漠 +1⚙️',
    },
  ],
  placementRequireTags: ['arid'],
  tags: ['solar_farm', 'improvement'],
  icon: '☀️',
  productionCost: 10,
  terrainHint: '需要干旱地形（沙漠）',
};

/** 冻土专属: 猎场 */
export const HUNTING_GROUND: IImprovement = {
  id: 'hunting_ground',
  name: '猎场',
  yields: { gold: 1, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'food',
  adjacencyRules: [
    {
      matchTag: 'cold',
      bonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻冻土 +1🌾',
    },
  ],
  placementRequireTags: ['cold'],
  tags: ['hunting_ground', 'improvement'],
  icon: '🏹',
  productionCost: 8,
  terrainHint: '需要寒冷地形（冻土）',
  shopPool: 'faith',
};

/** 所有改良设施 registry */
export const IMPROVEMENT_REGISTRY: Record<string, IImprovement> = {
  farm: FARM,
  mine: MINE,
  trading_post: TRADING_POST,
  lumber_mill: LUMBER_MILL,
  plantation: PLANTATION,
  solar_farm: SOLAR_FARM,
  hunting_ground: HUNTING_GROUND,
};
