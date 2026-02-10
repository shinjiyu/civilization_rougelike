/**
 * 地形数据定义
 * 纯数据，不含逻辑
 */

import type { IFeature, IResource, ITerrain } from '../core/types';

// ============ 地形 ============

export const CITY_CENTER: ITerrain = {
  id: 'city_center',
  name: '城市中心',
  baseYields: { gold: 2, food: 2, production: 1, science: 0, culture: 0, faith: 0 },
  color: '#B89868',
  buildable: false,
  tags: ['city_center'],
  icon: '🏛️',
};

export const GRASSLAND: ITerrain = {
  id: 'grassland',
  name: '草地',
  baseYields: { gold: 0, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#6BA842',
  buildable: true,
  tags: ['grassland', 'flat', 'buildable', 'fertile'],
  icon: '🌿',
};

export const PLAINS: ITerrain = {
  id: 'plains',
  name: '平原',
  baseYields: { gold: 0, food: 1, production: 1, science: 0, culture: 0, faith: 0 },
  color: '#D8C44A',
  buildable: true,
  tags: ['plains', 'flat', 'buildable', 'fertile'],
  icon: '🌾',
};

export const DESERT: ITerrain = {
  id: 'desert',
  name: '沙漠',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#F0E0B0',
  buildable: true,
  tags: ['desert', 'flat', 'buildable', 'arid'],
  icon: '🏜️',
};

export const TUNDRA: ITerrain = {
  id: 'tundra',
  name: '冻土',
  baseYields: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#B8CCD8',
  buildable: true,
  tags: ['tundra', 'flat', 'buildable', 'cold'],
  icon: '❄️',
};

export const MOUNTAIN: ITerrain = {
  id: 'mountain',
  name: '山脉',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#9A9A9A',
  buildable: false,
  tags: ['mountain', 'natural'],
  icon: '⛰️',
};

export const LAKE: ITerrain = {
  id: 'lake',
  name: '湖泊',
  baseYields: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#5AA0E8',
  buildable: false,
  tags: ['water', 'lake', 'natural'],
  icon: '🌊',
};

/** 所有地形 registry */
export const TERRAIN_REGISTRY: Record<string, ITerrain> = {
  city_center: CITY_CENTER,
  grassland: GRASSLAND,
  plains: PLAINS,
  desert: DESERT,
  tundra: TUNDRA,
  mountain: MOUNTAIN,
  lake: LAKE,
};

// ============ 地貌特征 ============

export const HILLS: IFeature = {
  id: 'hills',
  name: '丘陵',
  yieldModifier: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
  removable: false,
  tags: ['hill'],
  icon: '⛰',
  colorOverlay: '#B8996A',
};

export const FOREST: IFeature = {
  id: 'forest',
  name: '森林',
  yieldModifier: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
  removable: true,
  tags: ['forest', 'vegetation'],
  icon: '🌲',
  colorOverlay: '#3A9040',
};

export const RAINFOREST: IFeature = {
  id: 'rainforest',
  name: '雨林',
  yieldModifier: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  removable: true,
  tags: ['rainforest', 'vegetation'],
  icon: '🌴',
  colorOverlay: '#2A7030',
};

export const OASIS: IFeature = {
  id: 'oasis',
  name: '绿洲',
  yieldModifier: { gold: 1, food: 3, production: 0, science: 0, culture: 0, faith: 0 },
  removable: false,
  tags: ['oasis', 'natural'],
  icon: '🏝️',
  colorOverlay: '#40DD85',
};

export const MARSH: IFeature = {
  id: 'marsh',
  name: '沼泽',
  yieldModifier: { gold: 0, food: 1, production: -1, science: 0, culture: 0, faith: 0 },
  removable: true,
  tags: ['marsh'],
  icon: '🌿',
  colorOverlay: '#5A7A52',
};

export const FEATURE_REGISTRY: Record<string, IFeature> = {
  hills: HILLS,
  forest: FOREST,
  rainforest: RAINFOREST,
  oasis: OASIS,
  marsh: MARSH,
};

// ============ 资源 ============

export const WHEAT: IResource = {
  id: 'wheat',
  name: '小麦',
  category: 'bonus',
  yieldBonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  tags: ['bonus_resource', 'wheat'],
  icon: '🌾',
};

export const STONE: IResource = {
  id: 'stone',
  name: '石材',
  category: 'bonus',
  yieldBonus: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
  tags: ['bonus_resource', 'stone'],
  icon: '🪨',
};

export const GEMS: IResource = {
  id: 'gems',
  name: '宝石',
  category: 'luxury',
  yieldBonus: { gold: 2, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  tags: ['luxury_resource', 'gems'],
  icon: '💎',
};

export const SILK: IResource = {
  id: 'silk',
  name: '丝绸',
  category: 'luxury',
  yieldBonus: { gold: 1, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
  tags: ['luxury_resource', 'silk'],
  icon: '🧶',
};

export const INCENSE: IResource = {
  id: 'incense',
  name: '乳香',
  category: 'luxury',
  yieldBonus: { gold: 1, food: 0, production: 0, science: 0, culture: 0, faith: 1 },
  tags: ['luxury_resource', 'incense'],
  icon: '🪔',
};

export const ANCIENT_RUINS: IResource = {
  id: 'ancient_ruins',
  name: '远古遗迹',
  category: 'knowledge',
  yieldBonus: { gold: 0, food: 0, production: 0, science: 2, culture: 0, faith: 0 },
  tags: ['knowledge_resource', 'ruins'],
  icon: '🏛',
};

export const HOLY_SITE_RELIC: IResource = {
  id: 'holy_site_relic',
  name: '圣地遗址',
  category: 'knowledge',
  yieldBonus: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 2 },
  tags: ['knowledge_resource', 'holy'],
  icon: '✝️',
};

export const RESOURCE_REGISTRY: Record<string, IResource> = {
  wheat: WHEAT,
  stone: STONE,
  gems: GEMS,
  silk: SILK,
  incense: INCENSE,
  ancient_ruins: ANCIENT_RUINS,
  holy_site_relic: HOLY_SITE_RELIC,
};
