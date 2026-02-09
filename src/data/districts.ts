/**
 * 区域数据定义
 * 纯数据，不含逻辑
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
      description: '每个相邻山脉 +1⛪',
    },
    {
      matchTag: 'natural',
      bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 1 },
      mode: 'per_each',
      description: '每个相邻自然地貌 +1⛪',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['holy_site', 'district', 'faith_district'],
  icon: '⛪',
};

export const THEATER_SQUARE: IDistrict = {
  id: 'theater_square',
  name: '剧院广场',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 2, faith: 0 },
  adjacencyRules: [
    {
      matchTag: 'district',
      bonus: { gold: 0, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
      mode: 'per_each',
      description: '每个相邻区域 +1🎭',
    },
  ],
  placementRequireTags: ['buildable'],
  tags: ['theater_square', 'district', 'culture_district'],
  icon: '🎭',
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
};

/** 所有区域 registry */
export const DISTRICT_REGISTRY: Record<string, IDistrict> = {
  campus: CAMPUS,
  commercial_hub: COMMERCIAL_HUB,
  holy_site: HOLY_SITE,
  theater_square: THEATER_SQUARE,
  industrial_zone: INDUSTRIAL_ZONE,
};
