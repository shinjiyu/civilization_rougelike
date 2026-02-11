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
  /** 建造所需生产力 */
  productionCost: number;
  /** 适用地形说明（UI展示用） */
  terrainHint?: string;
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
  /** 建造所需生产力 */
  productionCost: number;
  /** 最大等级 (默认3) */
  maxLevel: number;
  /** 每级额外加成的主要yield key */
  upgradePrimaryYield: keyof IYields;
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
  districtLevel: number;
  unlocked: boolean;
  /** 是否有工人在此工作（只有工作中的地块才产出） */
  isWorked: boolean;
  /** 已投入的金币（购买地块时的卡牌费用） */
  goldInvested: number;
  /** 已投入的生产力（建造/升级改良与区域） */
  productionInvested: number;
  /** 所属环数 (0=中心, 1-4=外圈) */
  ring: number;
}

// ============ 商店卡牌（仅地块） ============

export interface IShopCard {
  /** 唯一实例ID（每次生成不同） */
  instanceId: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  tier: number;
  /** 地形数据 */
  terrain: ITerrain;
  feature?: IFeature;
  resource?: IResource;
}

// ============ 道具系统 ============

export type ItemPool = 'gold' | 'culture' | 'faith';

export interface IItemEffect {
  type:
  | 'flat_per_turn' | 'per_tag' | 'yield_percent' | 'instant' | 'pop_growth'
  | 'terrain_alias' | 'convert_yield' | 'per_adjacent_pair';
  /** flat_per_turn / per_tag / instant / per_adjacent_pair: 产出加成 */
  yields?: Partial<IYields>;
  /** per_tag / per_adjacent_pair: 主匹配 tag */
  matchTag?: string;
  /** yield_percent: 目标 yield */
  yieldKey?: keyof IYields;
  /** yield_percent: 百分比增幅 (8 = +8%, 叠乘) */
  percent?: number;
  /** per_tag / per_adjacent_pair: 即使地块未分配工人也生效 */
  ignoreWorked?: boolean;
  /** terrain_alias: 源地形 tag */
  fromTag?: string;
  /** terrain_alias: 视为此 tag (扩展匹配) */
  toTag?: string;
  /** per_adjacent_pair: 邻居需匹配的 tag */
  secondTag?: string;
  /** convert_yield: 来源 yield */
  fromYieldKey?: keyof IYields;
  /** convert_yield: 目标 yield */
  toYieldKey?: keyof IYields;
  /** convert_yield: 转化比例 (0~1, 如 0.2 = 20%) */
  convertRatio?: number;
}

export interface IItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  pool: ItemPool;
  rarity: 1 | 2 | 3;
  effects: IItemEffect[];
}

export interface IEurekaDef {
  id: string;
  /** 在第几回合检查 */
  checkTurn: number;
  /** 奖励的商店池 */
  pool: ItemPool;
  /** 条件描述（UI展示） */
  description: string;
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
  /** 科技：可花费（升级商店），剩余计入终分 */
  storedScience: number;

  // 累积得分（只增不减）
  accumulatedCulture: number;
  accumulatedFaith: number;

  // 每回合产出（快照，用于UI展示）
  perTurnYields: IYields;

  // 人口系统
  population: number;
  foodProgress: number;
  perTurnNetFood: number;

  // 商店等级
  shopLevel: number;

  // 商店
  shopCards: IShopCard[];
  shopCardLocks: boolean[];
  selectedCard: IShopCard | null;

  // 棋盘
  board: Map<string, ITile>;

  // 已通过人口解锁的外圈格子数
  unlockedOuterCount: number;

  // 道具系统
  items: IItemDef[];
  eurekaTriggered: string[];
  /** 可用的免费道具商店入场券 [pool名称] */
  freeItemShopEntries: ItemPool[];
}

// ============ 卡牌模板（用于卡池定义，仅地块） ============

export interface ICardTemplate {
  name: string;
  cost: number;
  icon: string;
  weight: number;
  tier: 1 | 2 | 3;
  description: string;
  terrainId: string;
  featureId?: string;
  resourceId?: string;
}

// ============ 商店等级配置 ============

export interface IShopLevelConfig {
  level: number;
  /** [tier1%, tier2%, tier3%] 概率权重 */
  tierWeights: [number, number, number];
  /** 升级到此等级的科技费用（level 1 为 0） */
  upgradeCost: number;
}
