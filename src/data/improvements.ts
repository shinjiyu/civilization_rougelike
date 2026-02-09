/**
 * 改良设施数据定义
 * 纯数据，不含逻辑
 */

import type { IImprovement } from '../core/types';

export const FARM: IImprovement = {
  id: 'farm',
  name: '农场',
  yields: { gold: 0, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 3,
  upgradePrimaryYield: 'food',
  adjacencyRules: [
    {
      matchTag: 'farm',
      bonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'per_each',
      description: '每个相邻农场 +1🌾',
    },
  ],
  placementRequireTags: ['flat', 'buildable'],
  tags: ['farm', 'improvement'],
  icon: '🌾',
};

export const MINE: IImprovement = {
  id: 'mine',
  name: '矿山',
  yields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  maxLevel: 3,
  upgradePrimaryYield: 'production',
  adjacencyRules: [
    {
      matchTag: 'mine',
      bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻矿山 +1⚙️',
    },
  ],
  placementRequireTags: ['hill', 'buildable'],
  tags: ['mine', 'improvement'],
  icon: '⛏️',
};

export const TRADING_POST: IImprovement = {
  id: 'trading_post',
  name: '商站',
  yields: { gold: 3, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 3,
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
};

export const LUMBER_MILL: IImprovement = {
  id: 'lumber_mill',
  name: '伐木场',
  yields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  maxLevel: 3,
  upgradePrimaryYield: 'production',
  adjacencyRules: [],
  placementRequireTags: ['forest', 'buildable'],
  tags: ['lumber_mill', 'improvement'],
  icon: '🪓',
};

export const PLANTATION: IImprovement = {
  id: 'plantation',
  name: '种植园',
  yields: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  maxLevel: 3,
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
};

/** 所有改良设施 registry */
export const IMPROVEMENT_REGISTRY: Record<string, IImprovement> = {
  farm: FARM,
  mine: MINE,
  trading_post: TRADING_POST,
  lumber_mill: LUMBER_MILL,
  plantation: PLANTATION,
};
