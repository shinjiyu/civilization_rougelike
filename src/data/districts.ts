/**
 * 区域数据定义
 * 纯数据，不含逻辑
 * 区域通过消耗生产力在地块上建造
 */

import type { IDistrict } from '../core/types';

export const CAMPUS: IDistrict = {
  id: 'campus',
  name: '学院',
  baseYields: { gold: 0, food: 0, production: 0, science: 2, culture: 0, faith: 0 },
  adjacencyRules: [
    {
      matchTag: 'mountain',
      bonus: { gold: 0, food: 0, production: 0, science: 1, culture: 0, faith: 0 },
      mode: 'per_each',
      description: '每个相邻山脉 +1🔬',
    },
    {
      matchTag: 'vegetation',
      bonus: { gold: 0, food: 0, production: 0, science: 1, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻植被 +1🔬',
    },
    {
      matchTag: 'district',
      bonus: { gold: 0, food: 0, production: 0, science: 1, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻区域 +1🔬',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['campus', 'district', 'science_district'],
  icon: '🔬',
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'science',
};

export const COMMERCIAL_HUB: IDistrict = {
  id: 'commercial_hub',
  name: '商业中心',
  baseYields: { gold: 3, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  adjacencyRules: [
    {
      matchTag: 'water',
      bonus: { gold: 2, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'flat_if_any',
      description: '若相邻水域 +2🪙',
    },
    {
      matchTag: 'district',
      bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻区域 +1🪙',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['commercial_hub', 'district', 'gold_district'],
  icon: '💰',
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
};

export const HOLY_SITE: IDistrict = {
  id: 'holy_site',
  name: '圣地',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 2 },
  adjacencyRules: [
    {
      matchTag: 'mountain',
      bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 1 },
      mode: 'per_each',
      description: '每个相邻山脉 +1🙏',
    },
    {
      matchTag: 'natural',
      bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 1 },
      mode: 'per_each',
      description: '每个相邻自然地貌 +1🙏',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['holy_site', 'district', 'faith_district'],
  icon: '🙏',
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'faith',
};

export const THEATER_SQUARE: IDistrict = {
  id: 'theater_square',
  name: '剧院广场',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 2, faith: 0 },
  adjacencyRules: [
    {
      matchTag: 'district',
      bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻区域 +1🎭',
    },
    {
      matchTag: 'natural',
      bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
      mode: 'per_each',
      description: '每个相邻自然地貌 +1🎭',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['theater_square', 'district', 'culture_district'],
  icon: '🎭',
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'culture',
};

export const INDUSTRIAL_ZONE: IDistrict = {
  id: 'industrial_zone',
  name: '工业区',
  baseYields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  adjacencyRules: [
    {
      matchTag: 'mine',
      bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
      mode: 'per_each',
      description: '每个相邻矿山 +1⚙️',
    },
    {
      matchTag: 'district',
      bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
      mode: 'per_two',
      description: '每2个相邻区域 +1⚙️',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['industrial_zone', 'district', 'production_district'],
  icon: '🏭',
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'production',
};

export const HARBOR: IDistrict = {
  id: 'harbor',
  name: '港口',
  icon: '⚓',
  baseYields: { gold: 3, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  adjacencyRules: [
    { matchTag: 'water', bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻水域 +1🪙' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['harbor', 'district', 'gold_district'],
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
};

export const AQUEDUCT: IDistrict = {
  id: 'aqueduct',
  name: '水渠',
  icon: '🚰',
  baseYields: { gold: 0, food: 1, production: 1, science: 0, culture: 0, faith: 0 },
  adjacencyRules: [
    { matchTag: 'farm', bonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻农田 +1🌾' },
    { matchTag: 'water', bonus: { gold: 0, food: 2, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'flat_if_any', description: '若相邻水域 +2🌾' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['aqueduct', 'district'],
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'food',
};

export const BARRACKS: IDistrict = {
  id: 'barracks',
  name: '军营',
  icon: '⚔️',
  baseYields: { gold: 0, food: 0, production: 2, science: 1, culture: 0, faith: 0 },
  adjacencyRules: [
    { matchTag: 'industrial_zone', bonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻工业区 +1⚙️' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['barracks', 'district', 'production_district'],
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'production',
};

export const ENTERTAINMENT: IDistrict = {
  id: 'entertainment',
  name: '娱乐中心',
  icon: '🎪',
  baseYields: { gold: 1, food: 0, production: 0, science: 0, culture: 2, faith: 0 },
  adjacencyRules: [
    { matchTag: 'district', bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 0 }, mode: 'per_two', description: '每2个相邻区域 +1🎭' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['entertainment', 'district', 'culture_district'],
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'culture',
};

export const GOVERNMENT_PLAZA: IDistrict = {
  id: 'government_plaza',
  name: '政府广场',
  icon: '🏛️',
  baseYields: { gold: 1, food: 0, production: 0, science: 1, culture: 1, faith: 0 },
  adjacencyRules: [
    { matchTag: 'district', bonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻区域 +1🪙' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['government_plaza', 'district'],
  productionCost: 20,
  maxLevel: 99,
  upgradePrimaryYield: 'gold',
};

export const MONASTERY_DISTRICT: IDistrict = {
  id: 'monastery_district',
  name: '修道院区',
  icon: '📿',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 2 },
  adjacencyRules: [
    { matchTag: 'natural', bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 1 }, mode: 'per_each', description: '每个相邻自然地貌 +1🙏' },
    { matchTag: 'district', bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 0 }, mode: 'per_two', description: '每2个相邻区域 +1🎭' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['monastery_district', 'district', 'faith_district'],
  productionCost: 15,
  maxLevel: 99,
  upgradePrimaryYield: 'faith',
};

export const UNIVERSITY: IDistrict = {
  id: 'university',
  name: '大学城',
  icon: '🎓',
  baseYields: { gold: 0, food: 0, production: 0, science: 3, culture: 1, faith: 0 },
  adjacencyRules: [
    { matchTag: 'campus', bonus: { gold: 0, food: 0, production: 0, science: 2, culture: 0, faith: 0 }, mode: 'per_each', description: '每个相邻学院 +2🔬' },
  ],
  placementRequireTags: ['buildable'],
  tags: ['university', 'district', 'science_district'],
  productionCost: 20,
  maxLevel: 99,
  upgradePrimaryYield: 'science',
};

/** 所有区域 registry */
export const DISTRICT_REGISTRY: Record<string, IDistrict> = {
  campus: CAMPUS,
  commercial_hub: COMMERCIAL_HUB,
  holy_site: HOLY_SITE,
  theater_square: THEATER_SQUARE,
  industrial_zone: INDUSTRIAL_ZONE,
  harbor: HARBOR,
  aqueduct: AQUEDUCT,
  barracks: BARRACKS,
  entertainment: ENTERTAINMENT,
  government_plaza: GOVERNMENT_PLAZA,
  monastery_district: MONASTERY_DISTRICT,
  university: UNIVERSITY,
};

/** 基础区域（开局可用） */
export const BASE_DISTRICTS = ['campus', 'commercial_hub', 'holy_site', 'theater_square', 'industrial_zone'];

/** 需要科技树解锁的区域 */
export const UNLOCK_DISTRICTS = ['harbor', 'aqueduct', 'barracks', 'entertainment', 'government_plaza', 'monastery_district', 'university'];
