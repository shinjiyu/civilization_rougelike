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
};

export const LUMBER_MILL: IImprovement = {
  id: 'lumber_mill',
  name: '伐木场',
  yields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'production',
  adjacencyRules: [],
  placementRequireTags: ['vegetation'],
  tags: ['lumber_mill', 'improvement'],
  icon: '🪓',
  productionCost: 8,
  terrainHint: '需要有植被的地形（森林/老林）',
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
};

export const FISHERY: IImprovement = {
  id: 'fishery',
  name: '渔场',
  icon: '🎣',
  yields: { gold: 1, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'food',
  adjacencyRules: [
    { matchTag: 'reef', bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻珊瑚礁 +1🪙' },
  ],
  placementRequireTags: ['water'],
  tags: ['fishery', 'improvement'],
  productionCost: 8,
  terrainHint: '需要水域地形（浅海/湖泊）',
};

export const QUARRY: IImprovement = {
  id: 'quarry',
  name: '采石场',
  icon: '🪨',
  yields: { gold: 0, food: 0, production: 3, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'production',
  adjacencyRules: [
    { matchTag: 'mountain', bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻山脉 +1⚙️' },
  ],
  placementRequireTags: ['volcanic'],
  tags: ['quarry', 'improvement'],
  productionCost: 10,
  terrainHint: '需要火山岩地形或有石材资源',
};

export const LIGHTHOUSE: IImprovement = {
  id: 'lighthouse',
  name: '灯塔',
  icon: '🗼',
  yields: { gold: 1, food: 0, production: 0, science: 1, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'science',
  adjacencyRules: [
    { matchTag: 'water', bonus: { gold: 0, food: 0, production: 0, science: 1, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻水域 +1🔬' },
  ],
  placementRequireTags: ['coast'],
  tags: ['lighthouse', 'improvement'],
  productionCost: 10,
  terrainHint: '需要浅海地形',
};

export const TERRACE: IImprovement = {
  id: 'terrace',
  name: '梯田',
  icon: '🪜',
  yields: { gold: 0, food: 3, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'food',
  adjacencyRules: [
    { matchTag: 'mountain', bonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻山脉 +1🌾' },
  ],
  placementRequireTags: ['hill'],
  tags: ['terrace', 'improvement'],
  productionCost: 10,
  terrainHint: '需要丘陵地形',
};

export const OBSERVATORY: IImprovement = {
  id: 'observatory',
  name: '天文台',
  icon: '🔭',
  yields: { gold: 0, food: 0, production: 0, science: 3, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'science',
  adjacencyRules: [
    { matchTag: 'mountain', bonus: { gold: 0, food: 0, production: 0, science: 1, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻山脉 +1🔬' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['observatory', 'improvement'],
  productionCost: 12,
  terrainHint: '需可建造地形，且相邻山脉',
};

export const MONASTERY: IImprovement = {
  id: 'monastery',
  name: '修道院',
  icon: '⛪',
  yields: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 2 },
  maxLevel: 99,
  upgradePrimaryYield: 'faith',
  adjacencyRules: [
    { matchTag: 'natural', bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 1 }, mode: 'per_each', description: '每个相邻自然地貌 +1🙏' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['monastery', 'improvement'],
  productionCost: 8,
  terrainHint: '需可建造地形，且相邻自然地貌',
};

export const HOT_SPRING: IImprovement = {
  id: 'hot_spring',
  name: '温泉',
  icon: '♨️',
  yields: { gold: 0, food: 1, production: 0, science: 0, culture: 1, faith: 1 },
  maxLevel: 99,
  upgradePrimaryYield: 'faith',
  adjacencyRules: [],
  placementRequireTags: ['geothermal'],
  tags: ['hot_spring', 'improvement'],
  productionCost: 8,
  terrainHint: '需要有地热的地形',
};

export const SACRED_GROVE: IImprovement = {
  id: 'sacred_grove',
  name: '圣林',
  icon: '🌳',
  yields: { gold: 0, food: 0, production: 0, science: 1, culture: 1, faith: 1 },
  maxLevel: 99,
  upgradePrimaryYield: 'faith',
  adjacencyRules: [],
  placementRequireTags: ['vegetation'],
  tags: ['sacred_grove', 'improvement'],
  productionCost: 8,
  terrainHint: '需要有植被的地形（森林/雨林/老林）',
};

export const WINDMILL: IImprovement = {
  id: 'windmill',
  name: '风车',
  icon: '🌀',
  yields: { gold: 0, food: 1, production: 2, science: 0, culture: 0, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'production',
  adjacencyRules: [],
  placementRequireTags: ['flat'],
  tags: ['windmill', 'improvement'],
  productionCost: 8,
  terrainHint: '需要平坦地形',
};

export const VINEYARD: IImprovement = {
  id: 'vineyard',
  name: '葡萄园',
  icon: '🍷',
  yields: { gold: 2, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
  adjacencyRules: [
    { matchTag: 'luxury_resource', bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'flat_if_any', description: '若有相邻奢侈资源 +1🪙' },
  ],
  placementRequireTags: ['fertile', 'hill'],
  tags: ['vineyard', 'improvement'],
  productionCost: 10,
  terrainHint: '需要肥沃的丘陵地形',
};

export const BAZAAR: IImprovement = {
  id: 'bazaar',
  name: '集市',
  icon: '🏬',
  yields: { gold: 2, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
  adjacencyRules: [
    { matchTag: 'improvement', bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'per_two', description: '每2个相邻改良 +1🪙' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['bazaar', 'improvement'],
  productionCost: 10,
  terrainHint: '任何可建造地形',
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
  fishery: FISHERY,
  quarry: QUARRY,
  lighthouse: LIGHTHOUSE,
  terrace: TERRACE,
  observatory: OBSERVATORY,
  monastery: MONASTERY,
  hot_spring: HOT_SPRING,
  sacred_grove: SACRED_GROVE,
  windmill: WINDMILL,
  vineyard: VINEYARD,
  bazaar: BAZAAR,
};

/** 基础改良（开局可用） */
export const BASE_IMPROVEMENTS = ['farm', 'mine', 'trading_post', 'lumber_mill', 'plantation', 'solar_farm', 'hunting_ground'];

/** 需要科技树解锁的改良 */
export const UNLOCK_IMPROVEMENTS = ['fishery', 'quarry', 'lighthouse', 'terrace', 'observatory', 'monastery', 'hot_spring', 'sacred_grove', 'windmill', 'vineyard', 'bazaar'];
