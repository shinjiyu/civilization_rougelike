/**
 * 商店逻辑
 * 从卡池中按权重随机抽取卡牌
 */

import type { ICardTemplate, IShopCard } from '../core/types';
import { DISTRICT_CARDS, IMPROVEMENT_CARDS, TERRAIN_CARDS } from '../data/card-pool';
import { DISTRICT_REGISTRY } from '../data/districts';
import { IMPROVEMENT_REGISTRY } from '../data/improvements';
import { FEATURE_REGISTRY, RESOURCE_REGISTRY, TERRAIN_REGISTRY } from '../data/terrains';

let cardIdCounter = 0;

/** 生成唯一卡牌实例ID */
function nextCardId(): string {
  return `card_${++cardIdCounter}`;
}

/** 按权重从数组中随机抽取一个（不放回） */
function weightedPick<T extends { weight: number }>(pool: T[]): { picked: T; remaining: T[] } {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    roll -= pool[i].weight;
    if (roll <= 0) {
      const picked = pool[i];
      const remaining = [...pool.slice(0, i), ...pool.slice(i + 1)];
      return { picked, remaining };
    }
  }

  // fallback
  const picked = pool[pool.length - 1];
  const remaining = pool.slice(0, -1);
  return { picked, remaining };
}

/** 从模板池中抽取N张不重复的卡 */
function drawFromPool(pool: ICardTemplate[], count: number): ICardTemplate[] {
  const result: ICardTemplate[] = [];
  let remaining = [...pool];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const { picked, remaining: newRemaining } = weightedPick(remaining);
    result.push(picked);
    remaining = newRemaining;
  }

  return result;
}

/** 将卡牌模板解析为完整的 ShopCard */
function resolveTemplate(template: ICardTemplate): IShopCard {
  const card: IShopCard = {
    instanceId: nextCardId(),
    type: template.type,
    name: template.name,
    description: template.description,
    cost: template.cost,
    icon: template.icon,
  };

  if (template.terrainId) {
    card.terrain = TERRAIN_REGISTRY[template.terrainId];
  }
  if (template.featureId) {
    card.feature = FEATURE_REGISTRY[template.featureId];
  }
  if (template.resourceId) {
    card.resource = RESOURCE_REGISTRY[template.resourceId];
  }
  if (template.improvementId) {
    card.improvement = IMPROVEMENT_REGISTRY[template.improvementId];
  }
  if (template.districtId) {
    card.district = DISTRICT_REGISTRY[template.districtId];
  }

  return card;
}

/**
 * 生成本回合的商店卡牌
 * @param terrainCount 地形卡数量
 * @param improvementCount 改良卡数量
 * @param districtCount 区域卡数量
 */
export function generateShopCards(
  terrainCount: number = 2,
  improvementCount: number = 1,
  districtCount: number = 1
): IShopCard[] {
  const terrainTemplates = drawFromPool(TERRAIN_CARDS, terrainCount);
  const improvementTemplates = drawFromPool(IMPROVEMENT_CARDS, improvementCount);
  const districtTemplates = drawFromPool(DISTRICT_CARDS, districtCount);

  const allTemplates = [...terrainTemplates, ...improvementTemplates, ...districtTemplates];
  return allTemplates.map(resolveTemplate);
}

/** 重置卡牌ID计数器（新游戏时调用） */
export function resetCardCounter(): void {
  cardIdCounter = 0;
}
