/**
 * 游戏配置管理
 * 可配置参数定义、默认值、localStorage 持久化
 */

export interface IGameConfig {
  /** 回合数上限 */
  maxTurns: number;
  /** 初始金币 */
  initialGold: number;
  /** 每人口每回合食物消耗 */
  foodPerPop: number;
  /** 基础增长所需食物（第1→2人口） */
  baseGrowthFood: number;
  /** 每额外人口增加的增长食物需求 */
  growthFoodPerPop: number;
  /** 改良升级费用（每级） */
  productionPerUpgrade: number;
  /** 商店刷新费用 */
  rerollCost: number;
  /** 出售地块返还比例 (0~1) */
  sellRefundRatio: number;
  /** 每回合商店卡牌数 */
  shopCardCount: number;
  /** Ring 2 金币解锁费用 */
  hexUnlockCostRing2: number;
  /** Ring 3 金币解锁费用 */
  hexUnlockCostRing3: number;
  /** Ring 4 金币解锁费用 */
  hexUnlockCostRing4: number;
  /** 道具商店金币门票 */
  itemShopGoldCost: number;
  /** 道具商店文化门票 */
  itemShopCultureCost: number;
  /** 道具商店信仰门票 */
  itemShopFaithCost: number;
  /** 道具商店每次可选数量 */
  itemShopOfferingCount: number;
}

export const DEFAULT_CONFIG: IGameConfig = {
  maxTurns: 40,
  initialGold: 5,
  foodPerPop: 2,
  baseGrowthFood: 4,
  growthFoodPerPop: 4,
  productionPerUpgrade: 10,
  rerollCost: 2,
  sellRefundRatio: 0.5,
  shopCardCount: 4,
  hexUnlockCostRing2: 5,
  hexUnlockCostRing3: 10,
  hexUnlockCostRing4: 20,
  itemShopGoldCost: 20,
  itemShopCultureCost: 20,
  itemShopFaithCost: 20,
  itemShopOfferingCount: 3,
};

const STORAGE_KEY = 'civ-roguelike-config';

/** 从 localStorage 加载配置（缺失字段用默认值填充） */
export function loadConfig(): IGameConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw) as Partial<IGameConfig>;
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** 保存配置到 localStorage */
export function saveConfig(config: IGameConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 清除保存的配置（恢复默认） */
export function resetConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** 配置项元数据（UI 渲染用） */
export const CONFIG_META: { key: keyof IGameConfig; label: string; min: number; max: number; step: number }[] = [
  { key: 'maxTurns', label: '回合数上限', min: 5, max: 100, step: 1 },
  { key: 'initialGold', label: '初始金币', min: 0, max: 100, step: 1 },
  { key: 'foodPerPop', label: '每人口食物消耗', min: 1, max: 10, step: 1 },
  { key: 'baseGrowthFood', label: '基础增长食物', min: 2, max: 50, step: 1 },
  { key: 'growthFoodPerPop', label: '每人口额外增长需求', min: 0, max: 10, step: 1 },
  { key: 'productionPerUpgrade', label: '改良升级费用', min: 1, max: 50, step: 1 },
  { key: 'rerollCost', label: '商店刷新费用', min: 0, max: 20, step: 1 },
  { key: 'sellRefundRatio', label: '出售返还比例', min: 0, max: 1, step: 0.1 },
  { key: 'shopCardCount', label: '商店卡牌数', min: 2, max: 8, step: 1 },
  { key: 'hexUnlockCostRing2', label: '2环解锁费用', min: 1, max: 20, step: 1 },
  { key: 'hexUnlockCostRing3', label: '3环解锁费用', min: 1, max: 30, step: 1 },
  { key: 'hexUnlockCostRing4', label: '4环解锁费用', min: 1, max: 50, step: 1 },
  { key: 'itemShopGoldCost', label: '道具商店金币门票', min: 1, max: 30, step: 1 },
  { key: 'itemShopCultureCost', label: '道具商店文化门票', min: 1, max: 30, step: 1 },
  { key: 'itemShopFaithCost', label: '道具商店信仰门票', min: 1, max: 30, step: 1 },
  { key: 'itemShopOfferingCount', label: '道具商店可选数', min: 2, max: 6, step: 1 },
];
