/**
 * 卡牌池定义 (V2)
 * 商店只出售地块卡牌
 * 卡牌分三个等级：普通(T1)、加成(T2)、稀有(T3)
 * 商店等级由科技树自动升级
 */

import type { ICardTemplate, IShopLevelConfig } from '../core/types';

// ============ 商店等级配置 ============

export const SHOP_LEVEL_CONFIGS: IShopLevelConfig[] = [
  { level: 1, tierWeights: [70, 25, 5] },
  { level: 2, tierWeights: [40, 45, 15] },
  { level: 3, tierWeights: [15, 45, 40] },
  { level: 4, tierWeights: [5, 30, 65] },
];

// ============ Tier 1: 基础地块（6种） ============

const TIER1_CARDS: ICardTemplate[] = [
  { name: '草地', cost: 2, icon: '🌿', weight: 10, tier: 1, description: '肥沃的草地，适合农业', terrainId: 'grassland' },
  { name: '平原', cost: 2, icon: '🌾', weight: 10, tier: 1, description: '均衡的平原，食物和生产力', terrainId: 'plains' },
  { name: '沙漠', cost: 1, icon: '🏜️', weight: 5, tier: 1, description: '荒芜沙漠，科技树可开发', terrainId: 'desert' },
  { name: '冻土', cost: 1, icon: '❄️', weight: 4, tier: 1, description: '寒冷冻土，信仰树可增强', terrainId: 'tundra' },
  { name: '稀树草原', cost: 2, icon: '🦁', weight: 6, tier: 1, description: '粮金混合的开阔草原', terrainId: 'savanna' },
  { name: '高原', cost: 2, icon: '🏔️', weight: 5, tier: 1, description: '科技+生产的高地', terrainId: 'plateau' },
];

// ============ Tier 2: 加成地块（14种） ============

const TIER2_CARDS: ICardTemplate[] = [
  { name: '草地丘陵', cost: 3, icon: '⛰', weight: 7, tier: 2, description: '草地上的丘陵，可建矿山', terrainId: 'grassland', featureId: 'hills' },
  { name: '平原丘陵', cost: 3, icon: '⛰', weight: 7, tier: 2, description: '平原上的丘陵，高生产力', terrainId: 'plains', featureId: 'hills' },
  { name: '草地森林', cost: 3, icon: '🌲', weight: 7, tier: 2, description: '茂密森林，可建伐木场', terrainId: 'grassland', featureId: 'forest' },
  { name: '平原森林', cost: 3, icon: '🌲', weight: 5, tier: 2, description: '林间平原，均衡之选', terrainId: 'plains', featureId: 'forest' },
  { name: '雨林', cost: 3, icon: '🌴', weight: 4, tier: 2, description: '热带雨林，植被邻接', terrainId: 'grassland', featureId: 'rainforest' },
  { name: '山脉', cost: 4, icon: '⛰️', weight: 5, tier: 2, description: '不可建造，但提供强力邻接', terrainId: 'mountain' },
  { name: '湖泊', cost: 3, icon: '🌊', weight: 4, tier: 2, description: '内陆水域，商业中心邻接', terrainId: 'lake' },
  { name: '浅海', cost: 3, icon: '🏖️', weight: 4, tier: 2, description: '可建造水域，港口邻接', terrainId: 'coast' },
  { name: '火山岩', cost: 4, icon: '🌋', weight: 4, tier: 2, description: '高产能火山地形', terrainId: 'volcanic' },
  { name: '河谷', cost: 4, icon: '🏞️', weight: 3, tier: 2, description: '稀有高价值地形', terrainId: 'river_valley' },
  { name: '小麦草地', cost: 3, icon: '🌾', weight: 4, tier: 2, description: '带小麦的草地，食物充沛', terrainId: 'grassland', resourceId: 'wheat' },
  { name: '石材丘陵', cost: 4, icon: '🪨', weight: 4, tier: 2, description: '带石材的丘陵，生产力丰富', terrainId: 'plains', featureId: 'hills', resourceId: 'stone' },
  { name: '鱼群浅海', cost: 4, icon: '🐟', weight: 3, tier: 2, description: '带鱼群的浅海，食物加成', terrainId: 'coast', resourceId: 'fish' },
  { name: '马匹草原', cost: 4, icon: '🐴', weight: 3, tier: 2, description: '带马匹的草原，产能+金币', terrainId: 'savanna', resourceId: 'horses' },
];

// ============ Tier 3: 稀有地块（16种） ============

const TIER3_CARDS: ICardTemplate[] = [
  { name: '绿洲', cost: 5, icon: '🏝️', weight: 3, tier: 3, description: '沙漠中的宝地，高食物', terrainId: 'desert', featureId: 'oasis' },
  { name: '宝石丘陵', cost: 5, icon: '💎', weight: 3, tier: 3, description: '带宝石的丘陵，金币可观', terrainId: 'grassland', featureId: 'hills', resourceId: 'gems' },
  { name: '丝绸森林', cost: 5, icon: '🧶', weight: 3, tier: 3, description: '带丝绸的森林，金币+文化', terrainId: 'plains', featureId: 'forest', resourceId: 'silk' },
  { name: '乳香沙漠', cost: 4, icon: '🪔', weight: 3, tier: 3, description: '带乳香的沙漠，金币+信仰', terrainId: 'desert', resourceId: 'incense' },
  { name: '珊瑚浅海', cost: 5, icon: '🪸', weight: 3, tier: 3, description: '浅海中的珊瑚礁，科技+金币', terrainId: 'coast', featureId: 'reef' },
  { name: '地热火山', cost: 5, icon: '♨️', weight: 3, tier: 3, description: '带地热的火山岩，产能+科技', terrainId: 'volcanic', featureId: 'geothermal' },
  { name: '远古遗迹', cost: 6, icon: '🏛', weight: 2, tier: 3, description: '远古遗迹，科技加成', terrainId: 'plains', resourceId: 'ancient_ruins' },
  { name: '圣地遗址', cost: 5, icon: '✝️', weight: 2, tier: 3, description: '圣地遗址，信仰加成', terrainId: 'grassland', resourceId: 'holy_site_relic' },
  { name: '洪泛河谷', cost: 5, icon: '🌊', weight: 3, tier: 3, description: '河谷洪泛区，超高食物', terrainId: 'river_valley', featureId: 'floodplain' },
  { name: '老林', cost: 5, icon: '🌳', weight: 2, tier: 3, description: '古老森林，产能+科技', terrainId: 'grassland', featureId: 'old_growth' },
  { name: '香料雨林', cost: 5, icon: '🌶️', weight: 2, tier: 3, description: '带香料的热带雨林', terrainId: 'savanna', featureId: 'rainforest', resourceId: 'spices' },
  { name: '葡萄丘陵', cost: 5, icon: '🍇', weight: 2, tier: 3, description: '带葡萄的丘陵，高金币', terrainId: 'plains', featureId: 'hills', resourceId: 'grapes' },
  { name: '大理石高原', cost: 5, icon: '🏛', weight: 2, tier: 3, description: '带大理石的高原，产能+文化', terrainId: 'plateau', featureId: 'cliff', resourceId: 'marble' },
  { name: '珍珠浅海', cost: 6, icon: '🦪', weight: 2, tier: 3, description: '带珍珠的珊瑚海，金币+信仰', terrainId: 'coast', featureId: 'reef', resourceId: 'pearls' },
  { name: '琥珀老林', cost: 6, icon: '💛', weight: 2, tier: 3, description: '带琥珀的老林，金币+科技', terrainId: 'grassland', featureId: 'old_growth', resourceId: 'amber' },
  { name: '茶叶丘陵', cost: 6, icon: '🍵', weight: 2, tier: 3, description: '带茶叶的丘陵，文化+信仰', terrainId: 'grassland', featureId: 'hills', resourceId: 'tea' },
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
