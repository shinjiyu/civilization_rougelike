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

export type ResourceCategory = 'bonus' | 'luxury' | 'strategic' | 'knowledge';

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

// ============ 科技树系统 ============

export type TechTreeId = 'science' | 'policy' | 'faith';

export type TechEffectType =
  | 'buff_improvement'
  | 'buff_district'
  | 'buff_terrain'
  | 'buff_feature'
  | 'buff_all_improvements'
  | 'add_adjacency'
  | 'modify_adjacency'
  | 'terrain_alias'
  | 'make_workable'
  | 'unlock_improvement'
  | 'unlock_district'
  | 'reduce_cost'
  | 'pattern_bonus';

export interface ITechEffect {
  type: TechEffectType;
  /** buff_improvement/buff_district: target building ID */
  target?: string;
  /** buff_terrain: target terrain ID */
  targetTerrain?: string;
  /** buff_feature/terrain_alias: target tag */
  targetTag?: string;
  /** buff yields to add */
  yields?: Partial<IYields>;
  /** add_adjacency: the new adjacency rule */
  adjacencyRule?: IAdjacencyRule;
  /** modify_adjacency: matchTag of the rule to modify */
  matchTag?: string;
  /** modify_adjacency: new mode */
  newMode?: AdjacencyMode;
  /** terrain_alias: tag to add to the terrain */
  addTag?: string;
  /** make_workable: yields when terrain becomes workable */
  workableYields?: IYields;
  /** unlock_improvement/unlock_district: ID to unlock */
  unlockId?: string;
  /** reduce_cost: category ('improvement_upgrade'|'district_build'|'all_build') */
  costCategory?: string;
  /** reduce_cost: percentage reduction (0-100) */
  costReduction?: number;
  /** pattern_bonus: pattern description key */
  patternId?: string;
  /** pattern_bonus: minimum count for pattern */
  patternMinCount?: number;
  /** pattern_bonus: match tag for pattern */
  patternMatchTag?: string;
}

export interface ITechNode {
  /** Unique ID like 'S-A', 'S-AA', 'P-BBB' etc. */
  id: string;
  /** Display name */
  name: string;
  /** Description of the effect */
  description: string;
  /** Which tree this belongs to */
  tree: TechTreeId;
  /** Layer (1-4) */
  layer: number;
  /** Parent node ID (null for L1 nodes) */
  parentId: string | null;
  /** The effect(s) when this node is selected */
  effects: ITechEffect[];
}

export interface ITechTree {
  id: TechTreeId;
  name: string;
  icon: string;
  /** Resource used for unlocking: 'science'|'culture'|'faith' */
  resource: keyof IYields;
  /** Thresholds for each layer [L1, L2, L3, L4] */
  thresholds: [number, number, number, number];
  /** All nodes in this tree */
  nodes: ITechNode[];
}

export interface IEurekaDef {
  id: string;
  /** Condition description (for UI) */
  description: string;
  /** Which tree this eureka affects */
  targetTree: TechTreeId;
  /** Which layer threshold to reduce */
  targetLayer: number;
  /** Reduction percentage (0-100) e.g. 30 = reduce threshold by 30% */
  reductionPercent: number;
}

export interface ITechState {
  /** Selected node IDs per tree */
  selectedNodes: Record<TechTreeId, string[]>;
  /** Triggered eureka IDs */
  triggeredEurekas: string[];
  /** Current effective thresholds (after eureka reductions) */
  effectiveThresholds: Record<TechTreeId, [number, number, number, number]>;
}

// ============ 游戏状态 ============

export type GamePhase = 'yielding' | 'shopping' | 'placing' | 'game_over';

export interface IGameState {
  turn: number;
  maxTurns: number;
  phase: GamePhase;

  // 可花费资源
  storedGold: number;
  storedProduction: number;

  // 累积资源（只增不减，用于科技树解锁 + 终局得分）
  accumulatedScience: number;
  accumulatedCulture: number;
  accumulatedFaith: number;

  // 每回合产出快照
  perTurnYields: IYields;

  // 人口
  population: number;
  foodProgress: number;
  perTurnNetFood: number;

  // 商店
  shopLevel: number;
  shopCards: IShopCard[];
  shopCardLocks: boolean[];
  selectedCard: IShopCard | null;
  rerollsThisTurn: number;

  // 棋盘
  board: Map<string, ITile>;
  unlockedOuterCount: number;

  // 科技树
  techState: ITechState;
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

// ============ 胜利目标 ============

export type VictoryGoalType = 'score' | 'population' | 'gold' | 'faith' | 'science' | 'culture';

export interface IVictoryGoalPreset {
  type: VictoryGoalType;
  name: string;
  icon: string;
  description: string;
  /** 默认目标值 */
  defaultTarget: number;
  minTarget: number;
  maxTarget: number;
  step: number;
}

// ============ 商店等级配置 ============

export interface IShopLevelConfig {
  level: number;
  /** [tier1%, tier2%, tier3%] 概率权重 */
  tierWeights: [number, number, number];
}
