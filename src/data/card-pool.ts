/**
 * 卡牌池定义
 * 商店只出售地块卡牌，改良和区域通过生产力建造
 * 卡牌分三个等级：普通(T1)、加成(T2)、稀有(T3)
 */

import type { ICardTemplate, IShopLevelConfig } from '../core/types';

// ============ 商店等级配置 ============

export const SHOP_LEVEL_CONFIGS: IShopLevelConfig[] = [
  { level: 1, tierWeights: [70, 25, 5], upgradeCost: 0 },
  { level: 2, tierWeights: [40, 45, 15], upgradeCost: 15 },
  { level: 3, tierWeights: [15, 45, 40], upgradeCost: 30 },
  { level: 4, tierWeights: [5, 30, 65], upgradeCost: 60 },
];

// ============ Tier 1: 普通地块 ============

const TIER1_CARDS: ICardTemplate[] = [
  {
    name: '草地',
    cost: 2,
    icon: '🌿',
    weight: 10,
    tier: 1,
    description: '肥沃的草地，适合农业发展',
    terrainId: 'grassland',
  },
  {
    name: '平原',
    cost: 2,
    icon: '🌾',
    weight: 10,
    tier: 1,
    description: '平坦的原野，食物和生产力均衡',
    terrainId: 'plains',
  },
  {
    name: '沙漠',
    cost: 1,
    icon: '🏜️',
    weight: 5,
    tier: 1,
    description: '荒芜的沙漠，便宜但产出低',
    terrainId: 'desert',
  },
  {
    name: '冻土',
    cost: 1,
    icon: '❄️',
    weight: 4,
    tier: 1,
    description: '寒冷的冻土，产出微薄',
    terrainId: 'tundra',
  },
];

// ============ Tier 2: 加成地块（含地貌或加成资源） ============

const TIER2_CARDS: ICardTemplate[] = [
  {
    name: '草地丘陵',
    cost: 3,
    icon: '⛰',
    weight: 7,
    tier: 2,
    description: '草地上的丘陵，可建矿山',
    terrainId: 'grassland',
    featureId: 'hills',
  },
  {
    name: '平原丘陵',
    cost: 3,
    icon: '⛰',
    weight: 7,
    tier: 2,
    description: '平原上的丘陵，高生产力',
    terrainId: 'plains',
    featureId: 'hills',
  },
  {
    name: '草地森林',
    cost: 3,
    icon: '🌲',
    weight: 7,
    tier: 2,
    description: '茂密的森林，可建伐木场',
    terrainId: 'grassland',
    featureId: 'forest',
  },
  {
    name: '平原森林',
    cost: 3,
    icon: '🌲',
    weight: 5,
    tier: 2,
    description: '林间平原，均衡之选',
    terrainId: 'plains',
    featureId: 'forest',
  },
  {
    name: '雨林',
    cost: 3,
    icon: '🌴',
    weight: 4,
    tier: 2,
    description: '热带雨林，学院邻接加成',
    terrainId: 'grassland',
    featureId: 'rainforest',
  },
  {
    name: '山脉',
    cost: 4,
    icon: '⛰️',
    weight: 5,
    tier: 2,
    description: '不可建造，但为学院/圣地提供强力邻接',
    terrainId: 'mountain',
  },
  {
    name: '湖泊',
    cost: 3,
    icon: '🌊',
    weight: 4,
    tier: 2,
    description: '不可建造，但为商业中心提供邻接',
    terrainId: 'lake',
  },
  {
    name: '小麦草地',
    cost: 3,
    icon: '🌾',
    weight: 4,
    tier: 2,
    description: '带小麦的草地，食物充沛',
    terrainId: 'grassland',
    resourceId: 'wheat',
  },
  {
    name: '石材丘陵',
    cost: 4,
    icon: '🪨',
    weight: 4,
    tier: 2,
    description: '带石材的丘陵，生产力丰富',
    terrainId: 'plains',
    featureId: 'hills',
    resourceId: 'stone',
  },
];

// ============ Tier 3: 稀有地块（含奢侈/知识资源） ============

const TIER3_CARDS: ICardTemplate[] = [
  {
    name: '绿洲',
    cost: 5,
    icon: '🏝️',
    weight: 3,
    tier: 3,
    description: '沙漠中的宝地，高食物高金币',
    terrainId: 'desert',
    featureId: 'oasis',
  },
  {
    name: '宝石丘陵',
    cost: 5,
    icon: '💎',
    weight: 3,
    tier: 3,
    description: '带宝石的丘陵，金币可观',
    terrainId: 'grassland',
    featureId: 'hills',
    resourceId: 'gems',
  },
  {
    name: '丝绸平原',
    cost: 5,
    icon: '🧶',
    weight: 3,
    tier: 3,
    description: '带丝绸的平原，金币+文化',
    terrainId: 'plains',
    resourceId: 'silk',
  },
  {
    name: '乳香沙漠',
    cost: 4,
    icon: '🪔',
    weight: 3,
    tier: 3,
    description: '带乳香的沙漠，金币+信仰',
    terrainId: 'desert',
    resourceId: 'incense',
  },
  {
    name: '远古遗迹',
    cost: 6,
    icon: '🏛',
    weight: 2,
    tier: 3,
    description: '带远古遗迹的平原，科技加成',
    terrainId: 'plains',
    resourceId: 'ancient_ruins',
  },
  {
    name: '圣地遗址',
    cost: 5,
    icon: '✝️',
    weight: 2,
    tier: 3,
    description: '带圣地遗址的草地，信仰加成',
    terrainId: 'grassland',
    resourceId: 'holy_site_relic',
  },
];

/** 按等级分组的卡牌池 */
export const CARD_POOL_BY_TIER: Record<number, ICardTemplate[]> = {
  1: TIER1_CARDS,
  2: TIER2_CARDS,
  3: TIER3_CARDS,
};

/** 所有地块卡牌模板 */
export const ALL_CARD_TEMPLATES: ICardTemplate[] = [
  ...TIER1_CARDS,
  ...TIER2_CARDS,
  ...TIER3_CARDS,
];
