/**
 * 游戏引擎
 * 管理游戏状态机和所有游戏逻辑
 * 不依赖任何 UI/DOM
 */

import type {
  HexCoord,
  IDistrict,
  IGameState, IImprovement, IShopCard, IYields
} from '../core/types';
import { emptyYields } from '../core/yields';
import {
  autoAssignBestWorker,
  autoUnassignWorstWorker,
  calculateTileYields,
  calculateTotalYields,
  createBoard,
  getEmptyUnlockedHexes,
  getTile,
  getWorkedNonCityCount,
  tileHasTag,
  unlockNextRing2Hex,
} from './board';
import { generateShopCards, resetCardCounter } from './shop';
import { IMPROVEMENT_REGISTRY } from '../data/improvements';
import { DISTRICT_REGISTRY } from '../data/districts';
import { SHOP_LEVEL_CONFIGS } from '../data/card-pool';

// ============ 常量 ============

const MAX_TURNS = 20;
const INITIAL_GOLD = 10;
const FOOD_PER_POP = 2;
const GROWTH_THRESHOLD = 8;
const PRODUCTION_PER_UPGRADE = 10;
const REROLL_COST = 2;
const MAX_RING2_UNLOCKS = 12;
const SHOP_CARD_COUNT = 4;

// ============ 事件系统 ============

export type GameEventType =
  | 'state_changed'
  | 'tile_placed'
  | 'tile_upgraded'
  | 'hex_unlocked'
  | 'turn_started'
  | 'population_changed'
  | 'shop_upgraded'
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
      storedScience: 0,
      accumulatedCulture: 0,
      accumulatedFaith: 0,
      perTurnYields: emptyYields(),
      population: 1,
      foodProgress: 0,
      perTurnNetFood: 0,
      shopLevel: 1,
      shopCards: [],
      selectedCard: null,
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

    // 1. 产出结算
    this.collectYields();

    // 2. 人口增减
    this.checkPopulationGrowth();

    // 3. 刷新商店（根据商店等级）
    this.state.shopCards = generateShopCards(SHOP_CARD_COUNT, this.state.shopLevel);
    this.state.selectedCard = null;

    // 4. 进入购物阶段
    this.state.phase = 'shopping';

    this.emit('turn_started');
    this.emit('state_changed');
  }

  /** 结算产出 */
  private collectYields(): void {
    const yields = calculateTotalYields(this.state.board);
    this.state.perTurnYields = yields;

    // 投资型
    this.state.storedGold += yields.gold;
    this.state.storedProduction += yields.production;

    // 科技（可花费型，剩余计入得分）
    this.state.storedScience += yields.science;

    // 得分型
    this.state.accumulatedCulture += yields.culture;
    this.state.accumulatedFaith += yields.faith;

    // 食物
    const grossFood = yields.food;
    const consumption = this.state.population * FOOD_PER_POP;
    const netFood = grossFood - consumption;
    this.state.perTurnNetFood = netFood;
    this.state.foodProgress += netFood;
  }

  /** 人口增减 */
  private checkPopulationGrowth(): void {
    while (this.state.foodProgress >= GROWTH_THRESHOLD) {
      this.state.foodProgress -= GROWTH_THRESHOLD;
      this.state.population++;
      autoAssignBestWorker(this.state.board);
      this.checkRing2Unlock();
      this.emit('population_changed');
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

  /** 根据人口解锁 Ring-2 格子 */
  private checkRing2Unlock(): void {
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

  /** 刷新每回合产出快照 */
  private refreshYieldSnapshot(): void {
    const yields = calculateTotalYields(this.state.board);
    this.state.perTurnYields = yields;
    const grossFood = yields.food;
    const consumption = this.state.population * FOOD_PER_POP;
    this.state.perTurnNetFood = grossFood - consumption;
  }

  // -------- 商店操作（购买地块卡牌） --------

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

  /** 获取当前选中卡牌的有效放置位置（仅空地） */
  getValidPlacements(): HexCoord[] {
    if (!this.state.selectedCard) return [];
    return getEmptyUnlockedHexes(this.state.board);
  }

  /** 放置选中的地块卡牌 */
  placeCard(coord: HexCoord): boolean {
    const card = this.state.selectedCard;
    if (!card) return false;
    if (this.state.storedGold < card.cost) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile || tile.terrain !== null || !tile.unlocked) return false;

    tile.terrain = card.terrain;
    tile.feature = card.feature || null;
    tile.resource = card.resource || null;

    // 自动分配工人
    if (this.getAvailableWorkers() > 0 && tile.terrain) {
      tile.isWorked = true;
    }

    this.state.storedGold -= card.cost;
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

  /** 刷新商店 */
  rerollShop(): boolean {
    if (this.state.phase !== 'shopping') return false;
    if (this.state.storedGold < REROLL_COST) return false;

    this.state.storedGold -= REROLL_COST;
    this.state.shopCards = generateShopCards(SHOP_CARD_COUNT, this.state.shopLevel);
    this.state.selectedCard = null;

    this.emit('state_changed');
    return true;
  }

  // -------- 建造系统（消耗生产力） --------

  /** 在指定地块建造改良设施 */
  buildImprovement(coord: HexCoord, improvementId: string): boolean {
    const improvement = IMPROVEMENT_REGISTRY[improvementId];
    if (!improvement) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain) return false;
    if (tile.district) return false;
    if (tile.terrain.id === 'city_center') return false;

    // 检查放置条件
    for (const reqTag of improvement.placementRequireTags) {
      if (!tileHasTag(tile, reqTag)) return false;
    }

    if (this.state.storedProduction < improvement.productionCost) return false;

    this.state.storedProduction -= improvement.productionCost;
    tile.improvement = improvement;
    tile.improvementLevel = 1;

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  /** 在指定地块建造区域（替换已有改良） */
  buildDistrict(coord: HexCoord, districtId: string): boolean {
    const district = DISTRICT_REGISTRY[districtId];
    if (!district) return false;

    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain) return false;
    if (tile.district) return false;
    if (tile.terrain.id === 'city_center') return false;

    for (const reqTag of district.placementRequireTags) {
      if (!tileHasTag(tile, reqTag)) return false;
    }

    if (this.state.storedProduction < district.productionCost) return false;

    this.state.storedProduction -= district.productionCost;
    tile.district = district;
    tile.improvement = null;
    tile.improvementLevel = 0;

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  /** 升级已有改良设施 */
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

  // -------- 商店升级（消耗科技） --------

  /** 升级商店等级 */
  upgradeShop(): boolean {
    const nextLevel = this.state.shopLevel + 1;
    const config = SHOP_LEVEL_CONFIGS.find(c => c.level === nextLevel);
    if (!config) return false;

    if (this.state.storedScience < config.upgradeCost) return false;

    this.state.storedScience -= config.upgradeCost;
    this.state.shopLevel = nextLevel;

    this.emit('shop_upgraded');
    this.emit('state_changed');
    return true;
  }

  /** 获取下一级商店升级费用（null表示已满级） */
  getShopUpgradeCost(): number | null {
    const nextLevel = this.state.shopLevel + 1;
    const config = SHOP_LEVEL_CONFIGS.find(c => c.level === nextLevel);
    return config ? config.upgradeCost : null;
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
    const science = this.state.storedScience;
    const culture = this.state.accumulatedCulture;
    const faith = this.state.accumulatedFaith;
    return { science, culture, faith, total: science + culture + faith };
  }

  // -------- 建造查询 --------

  /** 获取指定地块可建造的改良列表 */
  getAvailableImprovements(coord: HexCoord): IImprovement[] {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.district || tile.terrain.id === 'city_center') return [];

    return Object.values(IMPROVEMENT_REGISTRY).filter(imp => {
      for (const reqTag of imp.placementRequireTags) {
        if (!tileHasTag(tile, reqTag)) return false;
      }
      return true;
    });
  }

  /** 获取指定地块可建造的区域列表 */
  getAvailableDistricts(coord: HexCoord): IDistrict[] {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.district || tile.terrain.id === 'city_center') return [];

    return Object.values(DISTRICT_REGISTRY).filter(dist => {
      for (const reqTag of dist.placementRequireTags) {
        if (!tileHasTag(tile, reqTag)) return false;
      }
      return true;
    });
  }

  // -------- 常量访问 --------

  getRerollCost(): number { return REROLL_COST; }
  getGrowthThreshold(): number { return GROWTH_THRESHOLD; }
  getFoodPerPop(): number { return FOOD_PER_POP; }
  getProductionPerUpgrade(): number { return PRODUCTION_PER_UPGRADE; }
}
