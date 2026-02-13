/**
 * 游戏配置管理
 * 可配置参数定义、默认值、localStorage 持久化
 */

import type { IVictoryGoalPreset, VictoryGoalType } from './types';

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
  /** 区域升级费用（每级） */
  districtUpgradeCost: number;
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
  /** 道具商店每次可选数量 */
  itemShopOfferingCount: number;
  /** 胜利目标类型 */
  victoryGoalType: VictoryGoalType;
  /** 胜利目标数值 */
  victoryGoalTarget: number;
}

export const DEFAULT_CONFIG: IGameConfig = {
  maxTurns: 40,
  initialGold: 5,
  foodPerPop: 2,
  baseGrowthFood: 4,
  growthFoodPerPop: 4,
  productionPerUpgrade: 10,
  districtUpgradeCost: 20,
  rerollCost: 2,
  sellRefundRatio: 0.5,
  shopCardCount: 4,
  hexUnlockCostRing2: 5,
  hexUnlockCostRing3: 10,
  hexUnlockCostRing4: 20,
  itemShopOfferingCount: 3,
  victoryGoalType: 'score',
  victoryGoalTarget: 3000,
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

// ============ 挑战分享 ============

export interface IChallengeData {
  /** 发起者名称 */
  from: string;
  /** 发起者的实际得分 (作为挑战目标) */
  score: number;
  /** 胜利目标类型 */
  goalType: VictoryGoalType;
  /** 游戏配置 (只存与默认值不同的字段, 缩短 URL) */
  config: Partial<IGameConfig>;
}

/** 将挑战数据编码为 URL 安全字符串 */
export function encodeChallengeData(data: IChallengeData): string {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(data.config) as (keyof IGameConfig)[]) {
    if (data.config[key] !== DEFAULT_CONFIG[key]) {
      diff[key] = data.config[key];
    }
  }
  const compact = { f: data.from, s: data.score, g: data.goalType, c: diff };
  const json = JSON.stringify(compact);
  return btoa(unescape(encodeURIComponent(json)));
}

/** 从 URL 字符串解码挑战数据, 失败返回 null */
export function decodeChallengeData(encoded: string): IChallengeData | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const compact = JSON.parse(json);
    return {
      from: compact.f || '???',
      score: compact.s || 0,
      goalType: compact.g || 'score',
      config: compact.c || {},
    };
  } catch {
    return null;
  }
}

/** 从当前页面 URL 提取挑战数据 */
export function getChallengeFromURL(): IChallengeData | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('challenge');
  if (!encoded) return null;
  return decodeChallengeData(encoded);
}

/** 生成挑战分享链接 */
export function buildChallengeURL(data: IChallengeData): string {
  const encoded = encodeChallengeData(data);
  const base = window.location.origin + window.location.pathname;
  return `${base}?challenge=${encoded}`;
}

/** 配置项元数据（UI 渲染用） */
export const CONFIG_META: { key: keyof IGameConfig; label: string; min: number; max: number; step: number }[] = [
  { key: 'maxTurns', label: '回合数上限', min: 5, max: 100, step: 1 },
  { key: 'initialGold', label: '初始金币', min: 0, max: 100, step: 1 },
  { key: 'foodPerPop', label: '每人口食物消耗', min: 1, max: 10, step: 1 },
  { key: 'baseGrowthFood', label: '基础增长食物', min: 2, max: 50, step: 1 },
  { key: 'growthFoodPerPop', label: '每人口额外增长需求', min: 0, max: 10, step: 1 },
  { key: 'productionPerUpgrade', label: '改良升级费用', min: 1, max: 50, step: 1 },
  { key: 'districtUpgradeCost', label: '区域升级费用', min: 5, max: 80, step: 5 },
  { key: 'rerollCost', label: '商店刷新费用', min: 0, max: 20, step: 1 },
  { key: 'sellRefundRatio', label: '出售返还比例', min: 0, max: 1, step: 0.1 },
  { key: 'shopCardCount', label: '商店卡牌数', min: 2, max: 8, step: 1 },
  { key: 'hexUnlockCostRing2', label: '2环解锁费用', min: 1, max: 20, step: 1 },
  { key: 'hexUnlockCostRing3', label: '3环解锁费用', min: 1, max: 30, step: 1 },
  { key: 'hexUnlockCostRing4', label: '4环解锁费用', min: 1, max: 50, step: 1 },
  { key: 'itemShopOfferingCount', label: '道具商店可选数', min: 2, max: 6, step: 1 },
];

/** 胜利目标预设列表 */
export const VICTORY_GOAL_PRESETS: IVictoryGoalPreset[] = [
  {
    type: 'score',
    name: '综合得分',
    icon: '🏆',
    description: '终局得分（科技+文化+信仰余额）达到目标',
    defaultTarget: 3000,
    minTarget: 100,
    maxTarget: 5000,
    step: 50,
  },
  {
    type: 'population',
    name: '人口繁荣',
    icon: '👥',
    description: '人口数量达到目标',
    defaultTarget: 30,
    minTarget: 5,
    maxTarget: 60,
    step: 1,
  },
  {
    type: 'gold',
    name: '黄金帝国',
    icon: '💰',
    description: '终局金币储备达到目标',
    defaultTarget: 2000,
    minTarget: 100,
    maxTarget: 10000,
    step: 100,
  },
  {
    type: 'faith',
    name: '信仰之巅',
    icon: '🙏',
    description: '终局信仰余额达到目标',
    defaultTarget: 1000,
    minTarget: 100,
    maxTarget: 5000,
    step: 50,
  },
  {
    type: 'science',
    name: '科技飞跃',
    icon: '🔬',
    description: '终局科技储备达到目标',
    defaultTarget: 500,
    minTarget: 50,
    maxTarget: 3000,
    step: 50,
  },
  {
    type: 'culture',
    name: '文化盛世',
    icon: '🎭',
    description: '终局文化余额达到目标',
    defaultTarget: 1000,
    minTarget: 100,
    maxTarget: 5000,
    step: 50,
  },
];
