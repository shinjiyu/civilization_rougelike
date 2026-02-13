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
  tags: ['mountain'],
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

export const COAST: ITerrain = {
  id: 'coast',
  name: '浅海',
  icon: '🏖️',
  baseYields: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#5AC8E8',
  buildable: true,
  tags: ['water', 'coast', 'buildable'],
};

export const OCEAN: ITerrain = {
  id: 'ocean',
  name: '深海',
  icon: '🌏',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#2A4A88',
  buildable: false,
  tags: ['water', 'ocean'],
};

export const VOLCANIC: ITerrain = {
  id: 'volcanic',
  name: '火山岩',
  icon: '🌋',
  baseYields: { gold: 0, food: 0, production: 2, science: 0, culture: 0, faith: 0 },
  color: '#4A3030',
  buildable: true,
  tags: ['volcanic', 'buildable', 'hill'],
};

export const SAVANNA: ITerrain = {
  id: 'savanna',
  name: '稀树草原',
  icon: '🦁',
  baseYields: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#C8B848',
  buildable: true,
  tags: ['savanna', 'flat', 'buildable'],
};

export const SNOW: ITerrain = {
  id: 'snow',
  name: '冰原',
  icon: '🧊',
  baseYields: { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#E8F0F8',
  buildable: false,
  tags: ['snow', 'frozen', 'cold'],
};

export const RIVER_VALLEY: ITerrain = {
  id: 'river_valley',
  name: '河谷',
  icon: '🏞️',
  baseYields: { gold: 1, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  color: '#4A8A50',
  buildable: true,
  tags: ['river_valley', 'flat', 'buildable', 'fertile'],
};

export const PLATEAU: ITerrain = {
  id: 'plateau',
  name: '高原',
  icon: '🏔️',
  baseYields: { gold: 0, food: 0, production: 1, science: 1, culture: 0, faith: 0 },
  color: '#B89868',
  buildable: true,
  tags: ['plateau', 'flat', 'buildable'],
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
  coast: COAST,
  ocean: OCEAN,
  volcanic: VOLCANIC,
  savanna: SAVANNA,
  snow: SNOW,
  river_valley: RIVER_VALLEY,
  plateau: PLATEAU,
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

export const RIVER: IFeature = {
  id: 'river',
  name: '河流',
  icon: '💧',
  yieldModifier: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  removable: false,
  tags: ['river'],
  colorOverlay: '#4A90D0',
};

export const REEF: IFeature = {
  id: 'reef',
  name: '珊瑚礁',
  icon: '🪸',
  yieldModifier: { gold: 1, food: 0, production: 0, science: 1, culture: 0, faith: 0 },
  removable: false,
  tags: ['reef', 'natural'],
  colorOverlay: '#FF7070',
};

export const GEOTHERMAL: IFeature = {
  id: 'geothermal',
  name: '地热',
  icon: '♨️',
  yieldModifier: { gold: 0, food: 0, production: 1, science: 1, culture: 0, faith: 0 },
  removable: false,
  tags: ['geothermal', 'natural'],
  colorOverlay: '#D04040',
};

export const CLIFF: IFeature = {
  id: 'cliff',
  name: '悬崖',
  icon: '🧗',
  yieldModifier: { gold: 0, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
  removable: false,
  tags: ['cliff'],
  colorOverlay: '#7A6A5A',
};

export const FLOODPLAIN: IFeature = {
  id: 'floodplain',
  name: '洪泛平原',
  icon: '🌊',
  yieldModifier: { gold: 0, food: 2, production: 0, science: 0, culture: 0, faith: 0 },
  removable: false,
  tags: ['floodplain'],
  colorOverlay: '#6AAA60',
};

export const OLD_GROWTH: IFeature = {
  id: 'old_growth',
  name: '老林',
  icon: '🌳',
  yieldModifier: { gold: 0, food: 0, production: 2, science: 1, culture: 0, faith: 0 },
  removable: false,
  tags: ['old_growth', 'vegetation', 'natural'],
  colorOverlay: '#1A5020',
};

export const VOLCANIC_SOIL: IFeature = {
  id: 'volcanic_soil',
  name: '火山灰土',
  icon: '🟤',
  yieldModifier: { gold: 0, food: 1, production: 1, science: 0, culture: 0, faith: 0 },
  removable: false,
  tags: ['volcanic_soil'],
  colorOverlay: '#5A4A3A',
};

export const FEATURE_REGISTRY: Record<string, IFeature> = {
  hills: HILLS,
  forest: FOREST,
  rainforest: RAINFOREST,
  oasis: OASIS,
  marsh: MARSH,
  river: RIVER,
  reef: REEF,
  geothermal: GEOTHERMAL,
  cliff: CLIFF,
  floodplain: FLOODPLAIN,
  old_growth: OLD_GROWTH,
  volcanic_soil: VOLCANIC_SOIL,
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

export const FISH: IResource = {
  id: 'fish',
  name: '鱼群',
  icon: '🐟',
  category: 'bonus',
  yieldBonus: { gold: 0, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  tags: ['bonus_resource', 'fish'],
};

export const SALT: IResource = {
  id: 'salt',
  name: '盐',
  icon: '🧂',
  category: 'bonus',
  yieldBonus: { gold: 1, food: 1, production: 0, science: 0, culture: 0, faith: 0 },
  tags: ['bonus_resource', 'salt'],
};

export const IRON: IResource = {
  id: 'iron',
  name: '铁矿',
  icon: '⛓️',
  category: 'strategic',
  yieldBonus: { gold: 0, food: 0, production: 1, science: 1, culture: 0, faith: 0 },
  tags: ['strategic_resource', 'iron'],
};

export const HORSES: IResource = {
  id: 'horses',
  name: '马匹',
  icon: '🐴',
  category: 'strategic',
  yieldBonus: { gold: 1, food: 0, production: 1, science: 0, culture: 0, faith: 0 },
  tags: ['strategic_resource', 'horses'],
};

export const SPICES: IResource = {
  id: 'spices',
  name: '香料',
  icon: '🌶️',
  category: 'luxury',
  yieldBonus: { gold: 1, food: 0, production: 0, science: 0, culture: 1, faith: 0 },
  tags: ['luxury_resource', 'spices'],
};

export const GRAPES: IResource = {
  id: 'grapes',
  name: '葡萄',
  icon: '🍇',
  category: 'luxury',
  yieldBonus: { gold: 2, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  tags: ['luxury_resource', 'grapes'],
};

export const MARBLE: IResource = {
  id: 'marble',
  name: '大理石',
  icon: '🏛',
  category: 'luxury',
  yieldBonus: { gold: 0, food: 0, production: 1, science: 0, culture: 1, faith: 0 },
  tags: ['luxury_resource', 'marble'],
};

export const PEARLS: IResource = {
  id: 'pearls',
  name: '珍珠',
  icon: '🦪',
  category: 'luxury',
  yieldBonus: { gold: 2, food: 0, production: 0, science: 0, culture: 0, faith: 1 },
  tags: ['luxury_resource', 'pearls'],
};

export const AMBER: IResource = {
  id: 'amber',
  name: '琥珀',
  icon: '💛',
  category: 'luxury',
  yieldBonus: { gold: 1, food: 0, production: 0, science: 1, culture: 0, faith: 0 },
  tags: ['luxury_resource', 'amber'],
};

export const IVORY: IResource = {
  id: 'ivory',
  name: '象牙',
  icon: '🐘',
  category: 'luxury',
  yieldBonus: { gold: 2, food: 0, production: 0, science: 0, culture: 0, faith: 0 },
  tags: ['luxury_resource', 'ivory'],
};

export const TEA: IResource = {
  id: 'tea',
  name: '茶叶',
  icon: '🍵',
  category: 'luxury',
  yieldBonus: { gold: 1, food: 0, production: 0, science: 0, culture: 1, faith: 1 },
  tags: ['luxury_resource', 'tea'],
};

export const RESOURCE_REGISTRY: Record<string, IResource> = {
  wheat: WHEAT,
  stone: STONE,
  gems: GEMS,
  silk: SILK,
  incense: INCENSE,
  ancient_ruins: ANCIENT_RUINS,
  holy_site_relic: HOLY_SITE_RELIC,
  fish: FISH,
  salt: SALT,
  iron: IRON,
  horses: HORSES,
  spices: SPICES,
  grapes: GRAPES,
  marble: MARBLE,
  pearls: PEARLS,
  amber: AMBER,
  ivory: IVORY,
  tea: TEA,
};
