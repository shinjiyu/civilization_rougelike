/**
 * 核心类型定义 - 数据层
 * 所有游戏实体的接口定义，不含任何逻辑
 */

// ============ 产出向量 ============

export interface IYields {
  gold: number;
  food: number;
  production: number;
  science: number;
  culture: number;
  faith: number;
}

// ============ 六角坐标 ============

export interface HexCoord {
  q: number;
  r: number;
}

// ============ 地形 ============

export interface ITerrain {
  id: string;
  name: string;
  baseYields: IYields;
  color: string;
  buildable: boolean;
  tags: string[];
  icon: string;
}

// ============ 地貌特征 ============

export interface IFeature {
  id: string;
  name: string;
  yieldModifier: IYields;
  removable: boolean;
  tags: string[];
  icon: string;
  /** 叠加在地形颜色上的修正色 */
  colorOverlay: string;
}

// ============ 资源 ============

export type ResourceCategory = 'bonus' | 'luxury' | 'knowledge';

export interface IResource {
  id: string;
  name: string;
  category: ResourceCategory;
  yieldBonus: IYields;
  tags: string[];
  icon: string;
}

// ============ 邻接规则 ============

export type AdjacencyMode = 'per_each' | 'per_two' | 'flat_if_any';

export interface IAdjacencyRule {
  /** 匹配邻居的 tag */
  matchTag: string;
  /** 每次匹配获得的加成 */
  bonus: IYields;
  /** 累积方式 */
  mode: AdjacencyMode;
  /** 规则描述（用于UI展示） */
  description: string;
}

// ============ 改良设施 ============

export interface IImprovement {
  id: string;
  name: string;
  yields: IYields;
  maxLevel: number;
  /** 每级额外加成的主要yield key */
  upgradePrimaryYield: keyof IYields;
  adjacencyRules: IAdjacencyRule[];
  /** 放置条件：地块必须包含所有这些 tag */
  placementRequireTags: string[];
  tags: string[];
  icon: string;
}

// ============ 区域 ============

export interface IDistrict {
  id: string;
  name: string;
  baseYields: IYields;
  adjacencyRules: IAdjacencyRule[];
  placementRequireTags: string[];
  tags: string[];
  icon: string;
}

// ============ 地块（棋盘格子） ============

export interface ITile {
  coord: HexCoord;
  terrain: ITerrain | null;
  feature: IFeature | null;
  resource: IResource | null;
  improvement: IImprovement | null;
  improvementLevel: number;
  district: IDistrict | null;
  unlocked: boolean;
  /** 是否有工人在此工作（只有工作中的地块才产出） */
  isWorked: boolean;
}

// ============ 商店卡牌 ============

export type CardType = 'terrain' | 'improvement' | 'district';

export interface IShopCard {
  /** 唯一实例ID（每次生成不同） */
  instanceId: string;
  type: CardType;
  name: string;
  description: string;
  cost: number;
  icon: string;
  /** 地形卡数据 */
  terrain?: ITerrain;
  feature?: IFeature;
  resource?: IResource;
  /** 改良卡数据 */
  improvement?: IImprovement;
  /** 区域卡数据 */
  district?: IDistrict;
}

// ============ 游戏状态 ============

export type GamePhase = 'yielding' | 'shopping' | 'placing' | 'game_over';

export interface IGameState {
  turn: number;
  maxTurns: number;
  phase: GamePhase;

  // 存储资源（可花费的）
  storedGold: number;
  storedProduction: number;

  // 累积得分（只增不减）
  accumulatedScience: number;
  accumulatedCulture: number;
  accumulatedFaith: number;

  // 每回合产出（快照，用于UI展示）
  perTurnYields: IYields;

  // 人口系统
  population: number;
  /** 累积的净食物（朝下一次人口增长） */
  foodProgress: number;
  /** 每回合净食物（UI展示用: 总产出 - 消耗） */
  perTurnNetFood: number;

  // 商店
  shopCards: IShopCard[];
  selectedCard: IShopCard | null;

  // 棋盘
  board: Map<string, ITile>;

  // 已解锁的 Ring-2 格子数
  unlockedRing2Count: number;
}

// ============ 卡牌模板（用于卡池定义） ============

export interface ICardTemplate {
  type: CardType;
  name: string;
  cost: number;
  icon: string;
  weight: number;
  description: string;
  terrainId?: string;
  featureId?: string;
  resourceId?: string;
  improvementId?: string;
  districtId?: string;
}
