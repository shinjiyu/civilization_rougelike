/**
 * 游戏引擎
 * 管理游戏状态机和所有游戏逻辑
 * 不依赖任何 UI/DOM
 */

import type {
  HexCoord,
  IGameState, IShopCard, IYields
} from '../core/types';
import { emptyYields } from '../core/yields';
import {
  autoAssignBestWorker,
  autoUnassignWorstWorker,
  calculateTileYields,
  calculateTotalYields,
  createBoard,
  getBuildableHexes,
  getEmptyUnlockedHexes,
  getTile,
  getWorkedNonCityCount,
  tileHasTag,
  unlockNextRing2Hex,
} from './board';
import { generateShopCards, resetCardCounter } from './shop';

// ============ 常量 ============

const MAX_TURNS = 20;
const INITIAL_GOLD = 10;
const FOOD_PER_POP = 2;          // 每人口每回合消耗食物
const GROWTH_THRESHOLD = 8;       // 食物积累到此值增加人口
const PRODUCTION_PER_UPGRADE = 10;
const REROLL_COST = 2;
const MAX_RING2_UNLOCKS = 12;

// ============ 事件系统 ============

export type GameEventType =
  | 'state_changed'
  | 'tile_placed'
  | 'tile_upgraded'
  | 'hex_unlocked'
  | 'turn_started'
  | 'population_changed'
  | 'game_over';

export type GameEventListener = (event: GameEventType, data?: unknown) => void;

// ============ 游戏引擎 ============

export class GameEngine {
  private state: IGameState;
  private listeners: GameEventListener[] = [];

  constructor() {
    this.state = this.createInitialState();
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

  getTileAt(coord: HexCoord) {
    return getTile(this.state.board, coord);
  }

  getTileYields(coord: HexCoord): IYields {
    return calculateTileYields(this.state.board, coord);
  }

  // -------- 游戏初始化 --------

  private createInitialState(): IGameState {
    resetCardCounter();
    return {
      turn: 0,
      maxTurns: MAX_TURNS,
      phase: 'shopping',
      storedGold: INITIAL_GOLD,
      storedProduction: 0,
      accumulatedScience: 0,
      accumulatedCulture: 0,
      accumulatedFaith: 0,
      perTurnYields: emptyYields(),
      // 人口系统
      population: 1,
      foodProgress: 0,
      perTurnNetFood: 0,
      // 商店
      shopCards: [],
      selectedCard: null,
      // 棋盘
      board: createBoard(),
      unlockedRing2Count: 0,
    };
  }

  /** 开始新游戏 */
  startNewGame(): void {
    this.state = this.createInitialState();
    this.startTurn();
  }

  // -------- 回合流程 --------

  /** 开始新回合 */
  private startTurn(): void {
    this.state.turn++;

    // 1. 产出结算（只计算工作中的地块）
    this.collectYields();

    // 2. 人口增减检查
    this.checkPopulationGrowth();

    // 3. 刷新商店
    this.state.shopCards = generateShopCards(2, 1, 1);
    this.state.selectedCard = null;

    // 4. 进入购物阶段
    this.state.phase = 'shopping';

    this.emit('turn_started');
    this.emit('state_changed');
  }

  /** 结算产出（只有工作中的地块贡献） */
  private collectYields(): void {
    const yields = calculateTotalYields(this.state.board);
    this.state.perTurnYields = yields;

    // 投资型
    this.state.storedGold += yields.gold;
    this.state.storedProduction += yields.production;

    // 得分型
    this.state.accumulatedScience += yields.science;
    this.state.accumulatedCulture += yields.culture;
    this.state.accumulatedFaith += yields.faith;

    // 食物: 总产出 - 人口消耗
    const grossFood = yields.food;
    const consumption = this.state.population * FOOD_PER_POP;
    const netFood = grossFood - consumption;
    this.state.perTurnNetFood = netFood;
    this.state.foodProgress += netFood;
  }

  /** 人口增减 */
  private checkPopulationGrowth(): void {
    // 增长: 食物盈余达到阈值
    while (this.state.foodProgress >= GROWTH_THRESHOLD) {
      this.state.foodProgress -= GROWTH_THRESHOLD;
      this.state.population++;
      // 新人口自动分配到最佳地块
      autoAssignBestWorker(this.state.board);
      // 人口增长可能解锁 Ring-2
      this.checkRing2Unlock();
      this.emit('population_changed');
    }

    // 饥荒: 食物赤字时减少人口
    while (this.state.foodProgress < 0 && this.state.population > 1) {
      this.state.population--;
      this.state.foodProgress = 0; // 重置，不累积负值
      // 自动撤回最差地块的工人
      autoUnassignWorstWorker(this.state.board);
      this.emit('population_changed');
    }

    // 最低人口1，不再扣食物
    if (this.state.foodProgress < 0) {
      this.state.foodProgress = 0;
    }
  }

  /** 根据人口解锁 Ring-2 格子 */
  private checkRing2Unlock(): void {
    // 每增加1人口(超过初始1)，解锁1个 Ring-2 格子
    const shouldUnlock = Math.max(0, this.state.population - 1);
    while (
      this.state.unlockedRing2Count < shouldUnlock &&
      this.state.unlockedRing2Count < MAX_RING2_UNLOCKS
    ) {
      unlockNextRing2Hex(this.state.board);
      this.state.unlockedRing2Count++;
      this.emit('hex_unlocked');
    }
  }

  // -------- 工人管理 --------

  /** 获取可用工人数 */
  getAvailableWorkers(): number {
    const workedNonCity = getWorkedNonCityCount(this.state.board);
    return Math.max(0, this.state.population - workedNonCity);
  }

  /** 手动分配工人到指定地块 */
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

  /** 手动取消工人分配 */
  unassignWorker(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || !tile.isWorked) return false;
    if (tile.terrain.id === 'city_center') return false;

    tile.isWorked = false;
    this.refreshYieldSnapshot();
    this.emit('state_changed');
    return true;
  }

  /** 刷新每回合产出快照（用于UI展示） */
  private refreshYieldSnapshot(): void {
    const yields = calculateTotalYields(this.state.board);
    this.state.perTurnYields = yields;
    const grossFood = yields.food;
    const consumption = this.state.population * FOOD_PER_POP;
    this.state.perTurnNetFood = grossFood - consumption;
  }

  // -------- 商店操作 --------

  /** 选择一张商店卡牌 */
  selectCard(card: IShopCard): boolean {
    if (this.state.phase !== 'shopping' && this.state.phase !== 'placing') return false;
    if (this.state.storedGold < card.cost) return false;

    this.state.selectedCard = card;
    this.state.phase = 'placing';
    this.emit('state_changed');
    return true;
  }

  /** 取消选择 */
  deselectCard(): void {
    this.state.selectedCard = null;
    this.state.phase = 'shopping';
    this.emit('state_changed');
  }

  /** 获取当前选中卡牌的有效放置位置 */
  getValidPlacements(): HexCoord[] {
    const card = this.state.selectedCard;
    if (!card) return [];

    if (card.type === 'terrain') {
      return getEmptyUnlockedHexes(this.state.board);
    }

    const buildable = getBuildableHexes(this.state.board);
    return buildable.filter(coord => this.canPlaceOnTile(card, coord));
  }

  /** 检查卡牌是否能放在指定格子 */
  private canPlaceOnTile(card: IShopCard, coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain) return false;

    if (card.type === 'terrain') {
      return tile.terrain === null && tile.unlocked;
    }

    if (card.type === 'improvement' && card.improvement) {
      for (const reqTag of card.improvement.placementRequireTags) {
        if (!tileHasTag(tile, reqTag)) return false;
      }
      return true;
    }

    if (card.type === 'district' && card.district) {
      for (const reqTag of card.district.placementRequireTags) {
        if (!tileHasTag(tile, reqTag)) return false;
      }
      return true;
    }

    return false;
  }

  /** 在指定位置放置选中的卡牌 */
  placeCard(coord: HexCoord): boolean {
    const card = this.state.selectedCard;
    if (!card) return false;
    if (this.state.storedGold < card.cost) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile) return false;

    if (card.type === 'terrain') {
      if (tile.terrain !== null || !tile.unlocked) return false;

      tile.terrain = card.terrain || null;
      tile.feature = card.feature || null;
      tile.resource = card.resource || null;

      // 如果有可用工人，自动分配到新地块
      if (this.getAvailableWorkers() > 0 && tile.terrain) {
        tile.isWorked = true;
      }
    } else if (card.type === 'improvement' && card.improvement) {
      if (!this.canPlaceOnTile(card, coord)) return false;
      tile.improvement = card.improvement;
      tile.improvementLevel = 1;
      tile.district = null;
    } else if (card.type === 'district' && card.district) {
      if (!this.canPlaceOnTile(card, coord)) return false;
      tile.district = card.district;
      tile.improvement = null;
      tile.improvementLevel = 0;
    } else {
      return false;
    }

    // 扣除金币
    this.state.storedGold -= card.cost;

    // 从商店移除
    this.state.shopCards = this.state.shopCards.filter(
      c => c.instanceId !== card.instanceId
    );
    this.state.selectedCard = null;
    this.state.phase = 'shopping';

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  /** 刷新商店（花费金币） */
  rerollShop(): boolean {
    if (this.state.phase !== 'shopping') return false;
    if (this.state.storedGold < REROLL_COST) return false;

    this.state.storedGold -= REROLL_COST;
    this.state.shopCards = generateShopCards(2, 1, 1);
    this.state.selectedCard = null;

    this.emit('state_changed');
    return true;
  }

  /** 升级地块改良设施 */
  upgradeTile(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.improvement) return false;
    if (tile.improvementLevel >= tile.improvement.maxLevel) return false;
    if (this.state.storedProduction < PRODUCTION_PER_UPGRADE) return false;

    this.state.storedProduction -= PRODUCTION_PER_UPGRADE;
    tile.improvementLevel++;

    this.refreshYieldSnapshot();
    this.emit('tile_upgraded', coord);
    this.emit('state_changed');
    return true;
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

  // -------- 常量访问 --------

  getRerollCost(): number { return REROLL_COST; }
  getGrowthThreshold(): number { return GROWTH_THRESHOLD; }
  getFoodPerPop(): number { return FOOD_PER_POP; }
  getProductionPerUpgrade(): number { return PRODUCTION_PER_UPGRADE; }
}
