/**
 * 商店逻辑
 * 根据商店等级，按等级概率生成地块卡牌
 */

import type { ICardTemplate, IShopCard } from '../core/types';
import { CARD_POOL_BY_TIER, SHOP_LEVEL_CONFIGS } from '../data/card-pool';
import { FEATURE_REGISTRY, RESOURCE_REGISTRY, TERRAIN_REGISTRY } from '../data/terrains';

let cardIdCounter = 0;

/** 生成唯一卡牌实例ID */
function nextCardId(): string {
  return `card_${++cardIdCounter}`;
}

/** 按权重从数组中随机抽取一个 */
function weightedPick<T extends { weight: number }>(pool: T[]): T {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    roll -= pool[i].weight;
    if (roll <= 0) return pool[i];
  }

  return pool[pool.length - 1];
}

/** 根据商店等级的权重配置，随机选一个等级 */
function rollTier(shopLevel: number): number {
  const config = SHOP_LEVEL_CONFIGS.find(c => c.level === shopLevel);
  if (!config) return 1;

  const [w1, w2, w3] = config.tierWeights;
  const total = w1 + w2 + w3;
  const roll = Math.random() * total;

  if (roll < w1) return 1;
  if (roll < w1 + w2) return 2;
  return 3;
}

/** 将卡牌模板解析为完整的 ShopCard */
function resolveTemplate(template: ICardTemplate): IShopCard {
  const terrain = TERRAIN_REGISTRY[template.terrainId];
  if (!terrain) {
    throw new Error(`Unknown terrain: ${template.terrainId}`);
  }

  const card: IShopCard = {
    instanceId: nextCardId(),
    name: template.name,
    description: template.description,
    cost: template.cost,
    icon: template.icon,
    tier: template.tier,
    terrain,
  };

  if (template.featureId) {
    card.feature = FEATURE_REGISTRY[template.featureId];
  }
  if (template.resourceId) {
    card.resource = RESOURCE_REGISTRY[template.resourceId];
  }

  return card;
}

/**
 * 生成本回合的商店卡牌（仅地块）
 * @param count 生成卡牌数
 * @param shopLevel 商店等级（影响等级出现概率）
 */
export function generateShopCards(
  count: number = 4,
  shopLevel: number = 1
): IShopCard[] {
  const results: IShopCard[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const tier = rollTier(shopLevel);
    let pool = (CARD_POOL_BY_TIER[tier] || CARD_POOL_BY_TIER[1])
      .filter(t => !usedNames.has(t.name));

    // 该等级没卡了，从所有等级中兜底
    if (pool.length === 0) {
      pool = Object.values(CARD_POOL_BY_TIER)
        .flat()
        .filter(t => !usedNames.has(t.name));
      if (pool.length === 0) break;
    }

    const picked = weightedPick(pool);
    usedNames.add(picked.name);
    results.push(resolveTemplate(picked));
  }

  return results;
}

/** 重置卡牌ID计数器（新游戏时调用） */
export function resetCardCounter(): void {
  cardIdCounter = 0;
}

/** 设置卡牌ID计数器（存档恢复时调用） */
export function setCardCounter(val: number): void {
  cardIdCounter = val;
}
