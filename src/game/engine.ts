/**
 * 游戏引擎 (V2)
 * 管理游戏状态机和所有游戏逻辑
 * 不依赖任何 UI/DOM
 *
 * V2 变更:
 * - 移除道具系统，替换为科技树
 * - 商店等级由科技树自动升级
 * - 科技/文化/信仰改为累积型（不消耗）
 * - 每回合刷新上限
 */

import type { IGameConfig } from '../core/config';
import { DEFAULT_CONFIG, VICTORY_GOAL_PRESETS } from '../core/config';
import { hexNeighbors } from '../core/hex';
import type {
  HexCoord,
  IDistrict,
  IGameState, IImprovement, IShopCard, ITechState, IYields,
  TechTreeId,
  VictoryGoalType,
} from '../core/types';
import { emptyYields } from '../core/yields';
import { BASE_DISTRICTS, DISTRICT_REGISTRY } from '../data/districts';
import { BASE_IMPROVEMENTS, IMPROVEMENT_REGISTRY } from '../data/improvements';
import { EUREKA_DEFS, TECH_TREE_MAP } from '../data/tech-trees';
import { FEATURE_REGISTRY, RESOURCE_REGISTRY, TERRAIN_REGISTRY } from '../data/terrains';
import {
  autoAssignBestFoodWorker,
  autoAssignBestWorker,
  autoUnassignWorstWorker,
  calculateTileYields,
  calculateTotalYields,
  createBoard,
  getEmptyUnlockedHexes,
  getTile,
  getWorkedNonCityCount,
  tileHasTag,
  unlockNextOuterHex,
} from './board';
import { generateShopCards, resetCardCounter, setCardCounter } from './shop';
import {
  canSelectNode,
  checkEurekaCondition,
  compileTechEffects,
  createInitialTechState,
  getMaxSelectedLayer,
  getSelectableNodes,
  getShopLevelFromTech,
  getUnlockableLayer,
  selectNode,
  type ITechEffectCache,
} from './tech-engine';

// ============ 事件系统 ============

export type GameEventType =
  | 'state_changed'
  | 'tile_placed'
  | 'tile_upgraded'
  | 'hex_unlocked'
  | 'turn_started'
  | 'population_changed'
  | 'shop_upgraded'
  | 'eureka_triggered'
  | 'tech_selected'
  | 'game_over';

export type GameEventListener = (event: GameEventType, data?: unknown) => void;

// ============ 游戏引擎 ============

export class GameEngine {
  private state: IGameState;
  private config: IGameConfig;
  private listeners: GameEventListener[] = [];
  /** 科技效果缓存，选择节点后重新编译 */
  private techCache: ITechEffectCache;

  constructor(config?: Partial<IGameConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
    this.techCache = compileTechEffects(this.state.techState);
  }

  // -------- 事件 --------

  on(listener: GameEventListener): void {
    this.listeners.push(listener);
  }

  off(listener: GameEventListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private emit(event: GameEventType, data?: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  // -------- 状态访问 --------

  getState(): Readonly<IGameState> {
    return this.state;
  }

  getConfig(): Readonly<IGameConfig> {
    return this.config;
  }

  getTechCache(): Readonly<ITechEffectCache> {
    return this.techCache;
  }

  // -------- 存档系统 --------

  private static readonly SAVE_KEY = 'civ6_roguelike_save';

  /** 序列化当前游戏状态为 JSON 字符串 */
  serializeState(): string {
    const s = this.state;

    // 序列化棋盘: Map → Array<[key, serialized tile]>
    const boardArr: [string, {
      q: number; r: number;
      terrainId: string | null; featureId: string | null; resourceId: string | null;
      improvementId: string | null; improvementLevel: number;
      districtId: string | null; districtLevel: number;
      unlocked: boolean; isWorked: boolean;
      goldInvested: number; productionInvested: number; ring: number;
    }][] = [];

    for (const [key, tile] of s.board) {
      boardArr.push([key, {
        q: tile.coord.q, r: tile.coord.r,
        terrainId: tile.terrain?.id ?? null,
        featureId: tile.feature?.id ?? null,
        resourceId: tile.resource?.id ?? null,
        improvementId: tile.improvement?.id ?? null,
        improvementLevel: tile.improvementLevel,
        districtId: tile.district?.id ?? null,
        districtLevel: tile.districtLevel,
        unlocked: tile.unlocked,
        isWorked: tile.isWorked,
        goldInvested: tile.goldInvested,
        productionInvested: tile.productionInvested,
        ring: tile.ring,
      }]);
    }

    // 序列化商店卡牌
    const shopCards = s.shopCards.map(c => ({
      instanceId: c.instanceId,
      name: c.name,
      description: c.description,
      cost: c.cost,
      icon: c.icon,
      tier: c.tier,
      terrainId: c.terrain.id,
      featureId: c.feature?.id,
      resourceId: c.resource?.id,
    }));

    return JSON.stringify({
      version: 2,
      turn: s.turn,
      maxTurns: s.maxTurns,
      phase: s.phase,
      storedGold: s.storedGold,
      storedProduction: s.storedProduction,
      accumulatedScience: s.accumulatedScience,
      accumulatedCulture: s.accumulatedCulture,
      accumulatedFaith: s.accumulatedFaith,
      perTurnYields: s.perTurnYields,
      population: s.population,
      foodProgress: s.foodProgress,
      perTurnNetFood: s.perTurnNetFood,
      shopLevel: s.shopLevel,
      shopCards,
      shopCardLocks: s.shopCardLocks,
      rerollsThisTurn: s.rerollsThisTurn,
      board: boardArr,
      unlockedOuterCount: s.unlockedOuterCount,
      techState: s.techState,
      config: this.config,
    });
  }

  /** 从 JSON 恢复游戏状态，成功返回 true */
  restoreFromSave(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data || (data.version !== 2 && data.version !== 1)) return false;

      // 恢复配置
      if (data.config) {
        this.config = { ...DEFAULT_CONFIG, ...data.config };
      }

      // 恢复棋盘
      const board = new Map<string, import('../core/types').ITile>();
      for (const [key, st] of data.board as [string, any][]) {
        board.set(key, {
          coord: { q: st.q, r: st.r },
          terrain: st.terrainId ? TERRAIN_REGISTRY[st.terrainId] ?? null : null,
          feature: st.featureId ? FEATURE_REGISTRY[st.featureId] ?? null : null,
          resource: st.resourceId ? RESOURCE_REGISTRY[st.resourceId] ?? null : null,
          improvement: st.improvementId ? IMPROVEMENT_REGISTRY[st.improvementId] ?? null : null,
          improvementLevel: st.improvementLevel || 0,
          district: st.districtId ? DISTRICT_REGISTRY[st.districtId] ?? null : null,
          districtLevel: st.districtLevel || 0,
          unlocked: st.unlocked,
          isWorked: st.isWorked,
          goldInvested: st.goldInvested || 0,
          productionInvested: st.productionInvested || 0,
          ring: st.ring || 0,
        });
      }

      // 恢复商店卡牌
      let maxCardId = 0;
      const shopCards: IShopCard[] = (data.shopCards || []).map((sc: any) => {
        const num = parseInt(sc.instanceId?.replace('card_', '') || '0');
        if (num > maxCardId) maxCardId = num;
        return {
          instanceId: sc.instanceId,
          name: sc.name,
          description: sc.description,
          cost: sc.cost,
          icon: sc.icon,
          tier: sc.tier,
          terrain: TERRAIN_REGISTRY[sc.terrainId],
          feature: sc.featureId ? FEATURE_REGISTRY[sc.featureId] : undefined,
          resource: sc.resourceId ? RESOURCE_REGISTRY[sc.resourceId] : undefined,
        } as IShopCard;
      }).filter((c: IShopCard) => c.terrain);
      setCardCounter(maxCardId);

      // 恢复科技树状态 (v1 存档无此字段)
      const techState: ITechState = data.techState || createInitialTechState();

      // 组装状态
      this.state = {
        turn: data.turn,
        maxTurns: data.maxTurns,
        phase: data.phase,
        storedGold: data.storedGold,
        storedProduction: data.storedProduction,
        accumulatedScience: data.accumulatedScience ?? data.storedScience ?? 0,
        accumulatedCulture: data.accumulatedCulture,
        accumulatedFaith: data.accumulatedFaith,
        perTurnYields: data.perTurnYields || emptyYields(),
        population: data.population,
        foodProgress: data.foodProgress,
        perTurnNetFood: data.perTurnNetFood || 0,
        shopLevel: data.shopLevel,
        shopCards,
        shopCardLocks: data.shopCardLocks || [],
        selectedCard: null,
        rerollsThisTurn: data.rerollsThisTurn || 0,
        board,
        unlockedOuterCount: data.unlockedOuterCount || 0,
        techState,
      };

      this.techCache = compileTechEffects(this.state.techState);
      this.refreshYieldSnapshot();
      this.emit('state_changed');
      return true;
    } catch (e) {
      console.warn('Failed to restore save:', e);
      return false;
    }
  }

  /** 保存到 localStorage */
  saveToStorage(): void {
    try {
      localStorage.setItem(GameEngine.SAVE_KEY, this.serializeState());
    } catch (e) {
      console.warn('Failed to save game:', e);
    }
  }

  /** 从 localStorage 加载并恢复 */
  loadFromStorage(): boolean {
    try {
      const json = localStorage.getItem(GameEngine.SAVE_KEY);
      if (!json) return false;
      return this.restoreFromSave(json);
    } catch (e) {
      console.warn('Failed to load save:', e);
      return false;
    }
  }

  /** 清除 localStorage 存档 */
  static clearSave(): void {
    try {
      localStorage.removeItem(GameEngine.SAVE_KEY);
    } catch (_) { /* ignore */ }
  }

  getTileAt(coord: HexCoord) {
    return getTile(this.state.board, coord);
  }

  getTileYields(coord: HexCoord): IYields {
    return calculateTileYields(this.state.board, coord, this.techCache);
  }

  /** 获取地块总有效产出 */
  getTileEffectiveYields(coord: HexCoord): IYields {
    return calculateTileYields(this.state.board, coord, this.techCache);
  }

  // -------- 游戏初始化 --------

  private createInitialState(): IGameState {
    resetCardCounter();
    return {
      turn: 0,
      maxTurns: this.config.maxTurns,
      phase: 'shopping',
      storedGold: this.config.initialGold,
      storedProduction: 0,
      accumulatedScience: 0,
      accumulatedCulture: 0,
      accumulatedFaith: 0,
      perTurnYields: emptyYields(),
      population: 1,
      foodProgress: 0,
      perTurnNetFood: 0,
      shopLevel: 1,
      shopCards: [],
      shopCardLocks: [],
      selectedCard: null,
      rerollsThisTurn: 0,
      board: createBoard(),
      unlockedOuterCount: 0,
      techState: createInitialTechState(),
    };
  }

  /** 开始新游戏 */
  startNewGame(newConfig?: Partial<IGameConfig>): void {
    if (newConfig) {
      this.config = { ...DEFAULT_CONFIG, ...newConfig };
    }
    this.state = this.createInitialState();
    this.techCache = compileTechEffects(this.state.techState);
    this.startTurn();
  }

  // -------- 回合流程 --------

  /** 开始新回合 */
  private startTurn(): void {
    this.state.turn++;

    // 1. 产出结算
    this.collectYields();

    // 2. 人口增减
    this.checkPopulationGrowth();

    // 3. 刷新商店
    this.refreshShop();

    // 4. 重置每回合刷新计数
    this.state.rerollsThisTurn = 0;

    // 5. 检查尤里卡
    this.checkEurekas();

    // 6. 检查科技树商店升级
    this.updateShopLevel();

    // 7. 进入购物阶段
    this.state.phase = 'shopping';
    this.state.selectedCard = null;

    this.emit('turn_started');
    this.emit('state_changed');
  }

  /** 刷新商店（保留锁定的卡牌） */
  private refreshShop(): void {
    const locks = this.state.shopCardLocks;
    const oldCards = this.state.shopCards;
    const count = this.config.shopCardCount;

    const lockedCards: (IShopCard | null)[] = [];
    let refreshCount = 0;
    for (let i = 0; i < count; i++) {
      if (locks[i] && oldCards[i]) {
        lockedCards.push(oldCards[i]);
      } else {
        lockedCards.push(null);
        refreshCount++;
      }
    }

    const newCards = generateShopCards(refreshCount, this.state.shopLevel);
    let newIdx = 0;
    const result: IShopCard[] = [];
    const newLocks: boolean[] = [];

    for (let i = 0; i < count; i++) {
      if (lockedCards[i]) {
        result.push(lockedCards[i]!);
        newLocks.push(true);
      } else if (newIdx < newCards.length) {
        result.push(newCards[newIdx++]);
        newLocks.push(false);
      }
    }

    this.state.shopCards = result;
    this.state.shopCardLocks = newLocks;
  }

  /** 结算产出 */
  private collectYields(): void {
    const yields = calculateTotalYields(this.state.board, this.techCache);
    this.state.perTurnYields = yields;

    // 投资型
    this.state.storedGold += yields.gold;
    this.state.storedProduction += yields.production;

    // 累积型（不消耗，用于科技树解锁 + 终局得分）
    this.state.accumulatedScience += yields.science;
    this.state.accumulatedCulture += yields.culture;
    this.state.accumulatedFaith += yields.faith;

    // 食物
    const grossFood = yields.food;
    const consumption = this.state.population * this.config.foodPerPop;
    const netFood = grossFood - consumption;
    this.state.perTurnNetFood = netFood;
    this.state.foodProgress += netFood;
  }

  // -------- 非线性人口增长 --------

  getGrowthThresholdForPop(pop: number): number {
    return this.config.baseGrowthFood + Math.max(0, pop - 1) * this.config.growthFoodPerPop;
  }

  getGrowthThreshold(): number {
    return this.getGrowthThresholdForPop(this.state.population);
  }

  private checkPopulationGrowth(): void {
    let threshold = this.getGrowthThresholdForPop(this.state.population);
    while (this.state.foodProgress >= threshold) {
      this.state.foodProgress -= threshold;
      this.state.population++;
      autoAssignBestWorker(this.state.board);
      this.checkOuterUnlock();
      this.emit('population_changed');
      threshold = this.getGrowthThresholdForPop(this.state.population);
    }

    while (this.state.foodProgress < 0 && this.state.population > 1) {
      this.state.population--;
      this.state.foodProgress = 0;
      autoUnassignWorstWorker(this.state.board);
      this.emit('population_changed');
    }

    if (this.state.foodProgress < 0) {
      this.state.foodProgress = 0;
    }
  }

  private checkOuterUnlock(): void {
    const shouldUnlock = Math.max(0, this.state.population - 1);
    while (this.state.unlockedOuterCount < shouldUnlock) {
      const unlocked = unlockNextOuterHex(this.state.board);
      if (!unlocked) break;
      this.state.unlockedOuterCount++;
      this.emit('hex_unlocked');
    }
  }

  // -------- 金币解锁格子 --------

  getHexUnlockCost(coord: HexCoord): number {
    const tile = getTile(this.state.board, coord);
    if (!tile) return Infinity;
    switch (tile.ring) {
      case 2: return this.config.hexUnlockCostRing2;
      case 3: return this.config.hexUnlockCostRing3;
      case 4: return this.config.hexUnlockCostRing4;
      default: return Infinity;
    }
  }

  unlockHexByGold(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || tile.unlocked || tile.ring <= 1) return false;

    const cost = this.getHexUnlockCost(coord);
    if (this.state.storedGold < cost) return false;

    const neighbors: HexCoord[] = hexNeighbors(coord);
    const hasUnlockedNeighbor = neighbors.some((n: HexCoord) => {
      const nt = getTile(this.state.board, n);
      return nt && nt.unlocked;
    });
    if (!hasUnlockedNeighbor) return false;

    this.state.storedGold -= cost;
    tile.unlocked = true;

    this.emit('hex_unlocked');
    this.emit('state_changed');
    return true;
  }

  // -------- 工人管理 --------

  getAvailableWorkers(): number {
    const workedNonCity = getWorkedNonCityCount(this.state.board);
    return Math.max(0, this.state.population - workedNonCity);
  }

  assignWorker(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.isWorked) return false;
    if (tile.terrain.id === 'city_center') return false;
    if (this.getAvailableWorkers() <= 0) return false;

    tile.isWorked = true;
    this.refreshYieldSnapshot();
    this.emit('state_changed');
    return true;
  }

  unassignWorker(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || !tile.isWorked) return false;
    if (tile.terrain.id === 'city_center') return false;

    tile.isWorked = false;
    this.refreshYieldSnapshot();
    this.emit('state_changed');
    return true;
  }

  private clearAllWorkers(): void {
    for (const [, tile] of this.state.board) {
      if (tile.isWorked && tile.terrain && tile.terrain.id !== 'city_center') {
        tile.isWorked = false;
      }
    }
  }

  reassignAllWorkers(): void {
    this.clearAllWorkers();
    for (let i = 0; i < this.state.population; i++) {
      autoAssignBestWorker(this.state.board);
    }
    this.refreshYieldSnapshot();
    this.emit('state_changed');
  }

  reassignWorkersFoodPriority(): void {
    this.clearAllWorkers();
    for (let i = 0; i < this.state.population; i++) {
      autoAssignBestFoodWorker(this.state.board);
    }
    this.refreshYieldSnapshot();
    this.emit('state_changed');
  }

  private refreshYieldSnapshot(): void {
    const yields = calculateTotalYields(this.state.board, this.techCache);
    this.state.perTurnYields = yields;
    const grossFood = yields.food;
    const consumption = this.state.population * this.config.foodPerPop;
    this.state.perTurnNetFood = grossFood - consumption;
  }

  // -------- 商店操作 --------

  toggleShopLock(index: number): void {
    while (this.state.shopCardLocks.length < this.state.shopCards.length) {
      this.state.shopCardLocks.push(false);
    }
    if (index >= 0 && index < this.state.shopCardLocks.length) {
      this.state.shopCardLocks[index] = !this.state.shopCardLocks[index];
      this.emit('state_changed');
    }
  }

  selectCard(card: IShopCard): boolean {
    if (this.state.phase !== 'shopping' && this.state.phase !== 'placing') return false;
    if (this.state.storedGold < card.cost) return false;

    this.state.selectedCard = card;
    this.state.phase = 'placing';
    this.emit('state_changed');
    return true;
  }

  deselectCard(): void {
    this.state.selectedCard = null;
    this.state.phase = 'shopping';
    this.emit('state_changed');
  }

  getValidPlacements(): HexCoord[] {
    if (!this.state.selectedCard) return [];
    return getEmptyUnlockedHexes(this.state.board);
  }

  placeCard(coord: HexCoord): boolean {
    const card = this.state.selectedCard;
    if (!card) return false;
    if (this.state.storedGold < card.cost) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile || tile.terrain !== null || !tile.unlocked) return false;

    tile.terrain = card.terrain;
    tile.feature = card.feature || null;
    tile.resource = card.resource || null;
    tile.goldInvested = card.cost;

    if (this.getAvailableWorkers() > 0 && tile.terrain) {
      tile.isWorked = true;
    }

    this.state.storedGold -= card.cost;

    const idx = this.state.shopCards.findIndex(c => c.instanceId === card.instanceId);
    if (idx >= 0) {
      this.state.shopCards.splice(idx, 1);
      this.state.shopCardLocks.splice(idx, 1);
    }

    this.state.selectedCard = null;
    this.state.phase = 'shopping';

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  /** 刷新商店（每回合限制次数） */
  rerollShop(): boolean {
    if (this.state.phase !== 'shopping') return false;
    if (this.state.storedGold < this.config.rerollCost) return false;
    if (this.state.rerollsThisTurn >= this.config.maxRerollsPerTurn) return false;

    this.state.storedGold -= this.config.rerollCost;
    this.state.rerollsThisTurn++;

    const locks = this.state.shopCardLocks;
    const oldCards = this.state.shopCards;
    const count = this.config.shopCardCount;
    let refreshCount = 0;
    const lockedCards: (IShopCard | null)[] = [];

    for (let i = 0; i < count; i++) {
      if (locks[i] && oldCards[i]) {
        lockedCards.push(oldCards[i]);
      } else {
        lockedCards.push(null);
        refreshCount++;
      }
    }

    const newCards = generateShopCards(refreshCount, this.state.shopLevel);
    let newIdx = 0;
    const result: IShopCard[] = [];
    const newLocks: boolean[] = [];

    for (let i = 0; i < count; i++) {
      if (lockedCards[i]) {
        result.push(lockedCards[i]!);
        newLocks.push(true);
      } else if (newIdx < newCards.length) {
        result.push(newCards[newIdx++]);
        newLocks.push(false);
      }
    }

    this.state.shopCards = result;
    this.state.shopCardLocks = newLocks;
    this.state.selectedCard = null;

    this.emit('state_changed');
    return true;
  }

  /** 获取本回合剩余刷新次数 */
  getRemainingRerolls(): number {
    return Math.max(0, this.config.maxRerollsPerTurn - this.state.rerollsThisTurn);
  }

  // -------- 建造系统 --------

  buildImprovement(coord: HexCoord, improvementId: string): boolean {
    const improvement = IMPROVEMENT_REGISTRY[improvementId];
    if (!improvement) return false;

    // 检查是否已解锁
    if (!this.isImprovementAvailable(improvementId)) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain) return false;
    if (tile.district) return false;
    if (tile.terrain.id === 'city_center') return false;

    // 检查放置条件（含科技树带来的标签变化）
    for (const reqTag of improvement.placementRequireTags) {
      if (!this.tileHasTagWithTech(tile, reqTag)) return false;
    }

    const cost = this.getEffectiveBuildCost(improvement.productionCost, 'improvement');
    if (this.state.storedProduction < cost) return false;

    this.state.storedProduction -= cost;
    tile.improvement = improvement;
    tile.improvementLevel = 1;
    tile.productionInvested += cost;

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  buildDistrict(coord: HexCoord, districtId: string): boolean {
    const district = DISTRICT_REGISTRY[districtId];
    if (!district) return false;

    // 检查是否已解锁
    if (!this.isDistrictAvailable(districtId)) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain) return false;
    if (tile.district) return false;
    if (tile.terrain.id === 'city_center') return false;

    for (const reqTag of district.placementRequireTags) {
      if (!this.tileHasTagWithTech(tile, reqTag)) return false;
    }

    const cost = this.getEffectiveBuildCost(district.productionCost, 'district');
    if (this.state.storedProduction < cost) return false;

    this.state.storedProduction -= cost;
    tile.district = district;
    tile.districtLevel = 1;
    tile.improvement = null;
    tile.improvementLevel = 0;
    tile.productionInvested += cost;

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  /** 升级已有改良设施或区域 */
  upgradeTile(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile) return false;

    if (tile.improvement) {
      if (tile.improvementLevel >= tile.improvement.maxLevel) return false;
      const baseCost = this.getImprovementUpgradeCost(tile.improvementLevel);
      const cost = this.getEffectiveUpgradeCost(baseCost, 'improvement');
      if (this.state.storedProduction < cost) return false;
      this.state.storedProduction -= cost;
      tile.improvementLevel++;
      tile.productionInvested += cost;
    } else if (tile.district) {
      if (tile.districtLevel >= tile.district.maxLevel) return false;
      const baseCost = this.getDistrictLevelUpCost(tile.districtLevel);
      const cost = this.getEffectiveUpgradeCost(baseCost, 'district');
      if (this.state.storedProduction < cost) return false;
      this.state.storedProduction -= cost;
      tile.districtLevel++;
      tile.productionInvested += cost;
    } else {
      return false;
    }

    this.refreshYieldSnapshot();
    this.emit('tile_upgraded', coord);
    this.emit('state_changed');
    return true;
  }

  /** 改良升级费用: baseCost × 2^(currentLevel-1) */
  getImprovementUpgradeCost(currentLevel: number): number {
    return this.config.productionPerUpgrade * Math.pow(2, currentLevel - 1);
  }

  /** 区域升级费用: baseCost × 2^(currentLevel-1) */
  getDistrictLevelUpCost(currentLevel: number): number {
    return this.config.districtUpgradeCost * Math.pow(2, currentLevel - 1);
  }

  /** 应用科技树费用减免 */
  private getEffectiveBuildCost(baseCost: number, category: 'improvement' | 'district'): number {
    let reduction = 0;
    if (category === 'district') {
      reduction += this.techCache.costReductions.get('district_build') || 0;
    }
    reduction += this.techCache.costReductions.get('all_build') || 0;
    reduction = Math.min(80, reduction);
    return Math.max(1, Math.floor(baseCost * (1 - reduction / 100)));
  }

  /** 应用科技树升级费用减免 */
  private getEffectiveUpgradeCost(baseCost: number, category: 'improvement' | 'district'): number {
    let reduction = 0;
    if (category === 'improvement') {
      reduction += this.techCache.costReductions.get('improvement_upgrade') || 0;
    }
    reduction += this.techCache.costReductions.get('all_build') || 0;
    reduction = Math.min(80, reduction);
    return Math.max(1, Math.floor(baseCost * (1 - reduction / 100)));
  }

  /** 带科技树别名的 tag 检查 */
  private tileHasTagWithTech(tile: import('../core/types').ITile, tag: string): boolean {
    if (tileHasTag(tile, tag)) return true;
    if (tile.terrain) {
      const addedTags = this.techCache.terrainAliases.get(tile.terrain.id);
      if (addedTags && addedTags.includes(tag)) return true;
    }
    return false;
  }

  // -------- 出售地块 --------

  sellTile(coord: HexCoord): { goldRefund: number; productionRefund: number } | null {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.terrain.id === 'city_center') return null;

    const ratio = this.config.sellRefundRatio;
    const goldRefund = Math.floor(tile.goldInvested * ratio);
    const productionRefund = Math.floor(tile.productionInvested * ratio);

    tile.terrain = null;
    tile.feature = null;
    tile.resource = null;
    tile.improvement = null;
    tile.improvementLevel = 0;
    tile.district = null;
    tile.districtLevel = 0;
    tile.isWorked = false;
    tile.goldInvested = 0;
    tile.productionInvested = 0;

    this.state.storedGold += goldRefund;
    this.state.storedProduction += productionRefund;

    this.refreshYieldSnapshot();
    this.emit('state_changed');
    return { goldRefund, productionRefund };
  }

  // -------- 商店升级（V2: 由科技树自动触发） --------

  upgradeShop(): boolean {
    return false; // V2: 不支持手动升级
  }

  getShopUpgradeCost(): number | null {
    return null; // V2: 无手动升级费用
  }

  private updateShopLevel(): void {
    const newLevel = getShopLevelFromTech(this.state.techState);
    if (newLevel > this.state.shopLevel) {
      this.state.shopLevel = newLevel;
      this.emit('shop_upgraded');
    }
  }

  // -------- 科技树系统 --------

  /** 获取某棵科技树对应的累积资源值 */
  getAccumulatedForTree(treeId: TechTreeId): number {
    const tree = TECH_TREE_MAP[treeId];
    switch (tree.resource) {
      case 'science': return this.state.accumulatedScience;
      case 'culture': return this.state.accumulatedCulture;
      case 'faith': return this.state.accumulatedFaith;
      default: return 0;
    }
  }

  /** 检查是否可以选择某个节点 */
  canSelectTechNode(nodeId: string, treeId: TechTreeId): boolean {
    return canSelectNode(
      this.state.techState,
      nodeId,
      treeId,
      this.getAccumulatedForTree(treeId),
    );
  }

  /** 选择科技树节点 */
  selectTechNode(nodeId: string, treeId: TechTreeId): boolean {
    if (!this.canSelectTechNode(nodeId, treeId)) return false;

    selectNode(this.state.techState, nodeId, treeId);

    // 重新编译科技效果
    this.techCache = compileTechEffects(this.state.techState);

    // 检查商店升级
    this.updateShopLevel();

    // 重新计算产出
    this.refreshYieldSnapshot();

    this.emit('tech_selected', { nodeId, treeId });
    this.emit('state_changed');
    return true;
  }

  /** 获取某棵树可解锁的层级 */
  getTreeUnlockableLayer(treeId: TechTreeId): number {
    return getUnlockableLayer(
      this.state.techState,
      treeId,
      this.getAccumulatedForTree(treeId),
    );
  }

  /** 获取某棵树已选的最高层级 */
  getTreeMaxSelectedLayer(treeId: TechTreeId): number {
    return getMaxSelectedLayer(this.state.techState, treeId);
  }

  /** 获取某棵树某层的可选节点 */
  getTreeSelectableNodes(treeId: TechTreeId, layer: number) {
    return getSelectableNodes(this.state.techState, treeId, layer);
  }

  // -------- 尤里卡系统 --------

  private checkEurekas(): void {
    for (const eureka of EUREKA_DEFS) {
      if (this.state.techState.triggeredEurekas.includes(eureka.id)) continue;

      if (checkEurekaCondition(
        eureka.id,
        this.state.board,
        this.state.population,
        this.state.accumulatedCulture,
        this.state.accumulatedFaith,
        this.state.accumulatedScience,
      )) {
        this.state.techState.triggeredEurekas.push(eureka.id);

        // 应用阈值减免
        this.applyEurekaReduction(eureka.targetTree, eureka.targetLayer, eureka.reductionPercent, eureka.id);

        this.emit('eureka_triggered', eureka);
      }
    }
  }

  private applyEurekaReduction(targetTree: TechTreeId, targetLayer: number, percent: number, _eurekaId: string): void {
    const thresholds = this.state.techState.effectiveThresholds[targetTree];
    const baseThresholds = TECH_TREE_MAP[targetTree].thresholds;

    const idx = targetLayer - 1;
    if (idx >= 0 && idx < 4) {
      // 只能减免到原始值的20%
      const minThreshold = Math.max(1, Math.floor(baseThresholds[idx] * 0.2));
      thresholds[idx] = Math.max(minThreshold, Math.floor(thresholds[idx] * (1 - percent / 100)));
    }
  }

  /** 结束回合 */
  endTurn(): void {
    if (this.state.phase === 'game_over') return;

    this.state.selectedCard = null;

    if (this.state.turn >= this.state.maxTurns) {
      this.state.phase = 'game_over';
      this.emit('game_over');
      this.emit('state_changed');
      return;
    }

    this.startTurn();
  }

  // -------- 得分 --------

  getFinalScore(): { science: number; culture: number; faith: number; total: number } {
    const science = this.state.accumulatedScience;
    const culture = this.state.accumulatedCulture;
    const faith = this.state.accumulatedFaith;
    return { science, culture, faith, total: science + culture + faith };
  }

  // -------- 胜利目标 --------

  getGoalCurrentValue(goalType?: VictoryGoalType): number {
    const type = goalType ?? this.config.victoryGoalType;
    switch (type) {
      case 'score': return this.getFinalScore().total;
      case 'population': return this.state.population;
      case 'gold': return this.state.storedGold;
      case 'faith': return this.state.accumulatedFaith;
      case 'science': return this.state.accumulatedScience;
      case 'culture': return this.state.accumulatedCulture;
      default: return 0;
    }
  }

  getGoalProgress(): { type: VictoryGoalType; current: number; target: number; ratio: number; achieved: boolean } {
    const type = this.config.victoryGoalType;
    const target = this.config.victoryGoalTarget;
    const current = this.getGoalCurrentValue(type);
    const ratio = target > 0 ? Math.min(current / target, 1) : 1;
    return { type, current, target, ratio, achieved: current >= target };
  }

  getGoalPreset(): { name: string; icon: string; description: string } {
    const preset = VICTORY_GOAL_PRESETS.find(p => p.type === this.config.victoryGoalType);
    return preset
      ? { name: preset.name, icon: preset.icon, description: preset.description }
      : { name: '综合得分', icon: '🏆', description: '' };
  }

  // -------- 建造查询 --------

  /** 检查改良是否可用（基础 + 科技树解锁） */
  isImprovementAvailable(improvementId: string): boolean {
    if (BASE_IMPROVEMENTS.includes(improvementId)) return true;
    return this.techCache.unlockedImprovements.has(improvementId);
  }

  /** 检查区域是否可用（基础 + 科技树解锁） */
  isDistrictAvailable(districtId: string): boolean {
    if (BASE_DISTRICTS.includes(districtId)) return true;
    return this.techCache.unlockedDistricts.has(districtId);
  }

  /** 获取指定地块可建造的改良列表（含科技树解锁检查） */
  getAvailableImprovements(coord: HexCoord): IImprovement[] {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.district || tile.terrain.id === 'city_center') return [];

    return Object.values(IMPROVEMENT_REGISTRY).filter(imp => {
      if (!this.isImprovementAvailable(imp.id)) return false;
      for (const reqTag of imp.placementRequireTags) {
        if (!this.tileHasTagWithTech(tile, reqTag)) return false;
      }
      return true;
    });
  }

  /** 获取指定地块可建造的区域列表（含科技树解锁检查） */
  getAvailableDistricts(coord: HexCoord): IDistrict[] {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.district || tile.terrain.id === 'city_center') return [];

    return Object.values(DISTRICT_REGISTRY).filter(dist => {
      if (!this.isDistrictAvailable(dist.id)) return false;
      for (const reqTag of dist.placementRequireTags) {
        if (!this.tileHasTagWithTech(tile, reqTag)) return false;
      }
      return true;
    });
  }

  // -------- 常量访问 --------

  getRerollCost(): number { return this.config.rerollCost; }
  getFoodPerPop(): number { return this.config.foodPerPop; }
  getProductionPerUpgrade(): number { return this.config.productionPerUpgrade; }
  getDistrictUpgradeCost(): number { return this.config.districtUpgradeCost; }
}
