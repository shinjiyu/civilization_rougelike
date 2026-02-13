/**
 * 游戏引擎
 * 管理游戏状态机和所有游戏逻辑
 * 不依赖任何 UI/DOM
 */

import type { IGameConfig } from '../core/config';
import { DEFAULT_CONFIG, VICTORY_GOAL_PRESETS } from '../core/config';
import { hexNeighbors } from '../core/hex';
import type {
  HexCoord,
  IDistrict,
  IGameState, IImprovement, IItemDef, IShopCard, ItemPool, IYields,
  VictoryGoalType
} from '../core/types';
import { addYields, emptyYields, scaleYields } from '../core/yields';
import { SHOP_LEVEL_CONFIGS } from '../data/card-pool';
import { DISTRICT_REGISTRY } from '../data/districts';
import { IMPROVEMENT_REGISTRY } from '../data/improvements';
import { ALL_ITEMS, EUREKA_DEFS, ITEM_POOL } from '../data/items';
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
  tileHasTagWithAliases,
  unlockNextOuterHex,
} from './board';
import { generateShopCards, resetCardCounter, setCardCounter } from './shop';

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
  | 'item_acquired'
  | 'game_over';

export type GameEventListener = (event: GameEventType, data?: unknown) => void;

// ============ 游戏引擎 ============

export class GameEngine {
  private state: IGameState;
  private config: IGameConfig;
  private listeners: GameEventListener[] = [];

  constructor(config?: Partial<IGameConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

  getConfig(): Readonly<IGameConfig> {
    return this.config;
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

    // 序列化道具 (保存 id 列表，可能重复)
    const itemIds = s.items.map(item => item.id);

    return JSON.stringify({
      version: 1,
      turn: s.turn,
      maxTurns: s.maxTurns,
      phase: s.phase,
      storedGold: s.storedGold,
      storedProduction: s.storedProduction,
      storedScience: s.storedScience,
      accumulatedCulture: s.accumulatedCulture,
      accumulatedFaith: s.accumulatedFaith,
      perTurnYields: s.perTurnYields,
      population: s.population,
      foodProgress: s.foodProgress,
      perTurnNetFood: s.perTurnNetFood,
      shopLevel: s.shopLevel,
      shopCards,
      shopCardLocks: s.shopCardLocks,
      board: boardArr,
      unlockedOuterCount: s.unlockedOuterCount,
      itemIds,
      eurekaTriggered: s.eurekaTriggered,
      freeItemShopEntries: s.freeItemShopEntries,
      itemShopUsed: s.itemShopUsed,
      config: this.config,
    });
  }

  /** 从 JSON 恢复游戏状态，成功返回 true */
  restoreFromSave(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data || data.version !== 1) return false;

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
      }).filter((c: IShopCard) => c.terrain); // 过滤掉无法解析的卡
      setCardCounter(maxCardId);

      // 恢复道具
      const itemMap = new Map<string, IItemDef>();
      for (const item of ALL_ITEMS) {
        itemMap.set(item.id, item);
      }
      const items: IItemDef[] = (data.itemIds || [])
        .map((id: string) => itemMap.get(id))
        .filter(Boolean) as IItemDef[];

      // 组装状态
      this.state = {
        turn: data.turn,
        maxTurns: data.maxTurns,
        phase: data.phase,
        storedGold: data.storedGold,
        storedProduction: data.storedProduction,
        storedScience: data.storedScience,
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
        board,
        unlockedOuterCount: data.unlockedOuterCount || 0,
        items,
        eurekaTriggered: data.eurekaTriggered || [],
        freeItemShopEntries: data.freeItemShopEntries || [],
        itemShopUsed: data.itemShopUsed || { gold: 0, culture: 0, faith: 0 },
      };

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
    return calculateTileYields(this.state.board, coord);
  }

  // ---- 道具别名系统 ----

  /** 从已持有道具构建反向别名表: toTag → fromTag[] */
  private buildAliasMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'terrain_alias' && effect.fromTag && effect.toTag) {
          const list = map.get(effect.toTag) || [];
          if (!list.includes(effect.fromTag)) list.push(effect.fromTag);
          map.set(effect.toTag, list);
        }
      }
    }
    return map;
  }

  /** 将 Partial<IYields> 归一化为完整 IYields */
  private static fy(y: Partial<IYields> | undefined): IYields {
    return {
      gold: y?.gold || 0, food: y?.food || 0, production: y?.production || 0,
      science: y?.science || 0, culture: y?.culture || 0, faith: y?.faith || 0,
    };
  }

  /**
   * 计算道具对单个地块的加成
   * - per_tag (含 ignoreWorked / 别名): 匹配地块获得加成
   * - per_adjacent_pair: 与特定邻居相邻时获得加成
   * - yield_percent: 叠乘作用于此地块基础+平坦加成
   */
  getItemBonusForTile(coord: HexCoord): IYields {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain) return emptyYields();

    const aliases = this.buildAliasMap();
    let bonus = emptyYields();

    // Pass 1: per_tag
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'per_tag' && effect.matchTag && effect.yields) {
          if (!tile.isWorked && !effect.ignoreWorked) continue;
          if (tileHasTagWithAliases(tile, effect.matchTag, aliases)) {
            bonus = addYields(bonus, GameEngine.fy(effect.yields));
          }
        }
      }
    }

    // Pass 2: per_adjacent_pair
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'per_adjacent_pair' && effect.matchTag && effect.secondTag && effect.yields) {
          if (!tile.isWorked && !effect.ignoreWorked) continue;
          if (tileHasTagWithAliases(tile, effect.matchTag, aliases)) {
            const hasNeighbor = hexNeighbors(coord).some(n => {
              const nt = getTile(this.state.board, n);
              return nt && nt.terrain && tileHasTagWithAliases(nt, effect.secondTag!, aliases);
            });
            if (hasNeighbor) {
              bonus = addYields(bonus, GameEngine.fy(effect.yields));
            }
          }
        }
      }
    }

    // Pass 3: yield_percent (叠乘) — 仅工作地块
    if (tile.isWorked) {
      const baseYields = calculateTileYields(this.state.board, coord);
      let withBonus = addYields(baseYields, bonus);
      for (const item of this.state.items) {
        for (const effect of item.effects) {
          if (effect.type === 'yield_percent' && effect.yieldKey && effect.percent) {
            const k = effect.yieldKey;
            withBonus[k] = Math.floor(withBonus[k] * (1 + effect.percent / 100));
          }
        }
      }
      // 返回: 最终 - 基础 = 道具总加成
      return {
        gold: withBonus.gold - baseYields.gold,
        food: withBonus.food - baseYields.food,
        production: withBonus.production - baseYields.production,
        science: withBonus.science - baseYields.science,
        culture: withBonus.culture - baseYields.culture,
        faith: withBonus.faith - baseYields.faith,
      };
    }

    return bonus;
  }

  /**
   * 获取全局道具加成（flat_per_turn，不归属于单个地块）
   */
  getGlobalItemBonus(): IYields {
    let bonus = emptyYields();
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'flat_per_turn' && effect.yields) {
          const ey = effect.yields;
          bonus = addYields(bonus, {
            gold: ey.gold || 0,
            food: ey.food || 0,
            production: ey.production || 0,
            science: ey.science || 0,
            culture: ey.culture || 0,
            faith: ey.faith || 0,
          });
        }
      }
    }
    return bonus;
  }

  /** 获取地块总有效产出（基础 + 道具加成） */
  getTileEffectiveYields(coord: HexCoord): IYields {
    const base = calculateTileYields(this.state.board, coord);
    const itemBonus = this.getItemBonusForTile(coord);
    return addYields(base, itemBonus);
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
      storedScience: 0,
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
      board: createBoard(),
      unlockedOuterCount: 0,
      items: [],
      eurekaTriggered: [],
      freeItemShopEntries: [],
      itemShopUsed: { gold: 0, culture: 0, faith: 0 },
    };
  }

  /** 开始新游戏（可选传入新配置，用于设置面板更新后重新开始） */
  startNewGame(newConfig?: Partial<IGameConfig>): void {
    if (newConfig) {
      this.config = { ...DEFAULT_CONFIG, ...newConfig };
    }
    this.state = this.createInitialState();
    this.startTurn();
  }

  // -------- 回合流程 --------

  /** 开始新回合 */
  private startTurn(): void {
    this.state.turn++;

    // 1. 产出结算（含道具效果）
    this.collectYields();

    // 2. 人口增减
    this.checkPopulationGrowth();

    // 3. 刷新商店（保留锁定的卡牌）
    this.refreshShop();

    // 4. 检查尤里卡时刻
    this.checkEurekas();

    // 5. 进入购物阶段
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

    // 计算需要刷新的槽位数
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

    // 生成新卡填入空槽位
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

  /** 结算产出（含道具效果） */
  private collectYields(): void {
    // 基础产出
    const baseYields = calculateTotalYields(this.state.board);

    // 应用道具效果
    const yields = this.applyItemEffects(baseYields);
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
    const consumption = this.state.population * this.config.foodPerPop;
    const netFood = grossFood - consumption;
    this.state.perTurnNetFood = netFood;
    this.state.foodProgress += netFood;
  }

  /** 应用道具被动效果到产出 */
  private applyItemEffects(baseYields: IYields): IYields {
    const aliases = this.buildAliasMap();
    let yields = { ...baseYields };

    // 1. flat_per_turn
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'flat_per_turn' && effect.yields) {
          yields = addYields(yields, GameEngine.fy(effect.yields));
        }
      }
    }

    // 2. per_tag (含 ignoreWorked 和别名)
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'per_tag' && effect.matchTag && effect.yields) {
          let count = 0;
          for (const [, tile] of this.state.board) {
            if (!tile.terrain) continue;
            if (!tile.isWorked && !effect.ignoreWorked) continue;
            if (tileHasTagWithAliases(tile, effect.matchTag, aliases)) count++;
          }
          yields = addYields(yields, scaleYields(GameEngine.fy(effect.yields), count));
        }
      }
    }

    // 3. per_adjacent_pair
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'per_adjacent_pair' && effect.matchTag && effect.secondTag && effect.yields) {
          let count = 0;
          for (const [, tile] of this.state.board) {
            if (!tile.terrain) continue;
            if (!tile.isWorked && !effect.ignoreWorked) continue;
            if (tileHasTagWithAliases(tile, effect.matchTag, aliases)) {
              const hasMatch = hexNeighbors(tile.coord).some(n => {
                const nt = getTile(this.state.board, n);
                return nt && nt.terrain && tileHasTagWithAliases(nt, effect.secondTag!, aliases);
              });
              if (hasMatch) count++;
            }
          }
          yields = addYields(yields, scaleYields(GameEngine.fy(effect.yields), count));
        }
      }
    }

    // 4. yield_percent (叠乘: 每个效果独立乘算)
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'yield_percent' && effect.yieldKey && effect.percent) {
          yields[effect.yieldKey] = Math.floor(
            yields[effect.yieldKey] * (1 + effect.percent / 100),
          );
        }
      }
    }

    // 5. convert_yield (从一种产出转化为另一种, 源减少)
    for (const item of this.state.items) {
      for (const effect of item.effects) {
        if (effect.type === 'convert_yield' && effect.fromYieldKey && effect.toYieldKey && effect.convertRatio) {
          const amount = Math.floor(yields[effect.fromYieldKey] * effect.convertRatio);
          yields[effect.fromYieldKey] -= amount;
          yields[effect.toYieldKey] += amount;
        }
      }
    }

    return yields;
  }

  // -------- 非线性人口增长 --------

  /** 获取指定人口数下的增长阈值（非线性：随人口递增） */
  getGrowthThresholdForPop(pop: number): number {
    return this.config.baseGrowthFood + Math.max(0, pop - 1) * this.config.growthFoodPerPop;
  }

  /** 获取当前人口的增长阈值 */
  getGrowthThreshold(): number {
    return this.getGrowthThresholdForPop(this.state.population);
  }

  /** 人口增减 */
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

  /** 根据人口解锁外圈格子（优先低环数） */
  private checkOuterUnlock(): void {
    const shouldUnlock = Math.max(0, this.state.population - 1);
    while (this.state.unlockedOuterCount < shouldUnlock) {
      const unlocked = unlockNextOuterHex(this.state.board);
      if (!unlocked) break; // 没有更多可解锁
      this.state.unlockedOuterCount++;
      this.emit('hex_unlocked');
    }
  }

  // -------- 金币解锁格子 --------

  /** 获取解锁指定格子所需的金币 */
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

  /** 金币解锁指定格子 */
  unlockHexByGold(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile || tile.unlocked || tile.ring <= 1) return false;

    const cost = this.getHexUnlockCost(coord);
    if (this.state.storedGold < cost) return false;

    // 检查是否有已解锁的邻居
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

  /** 撤回所有工人（城市中心除外） */
  private clearAllWorkers(): void {
    for (const [, tile] of this.state.board) {
      if (tile.isWorked && tile.terrain && tile.terrain.id !== 'city_center') {
        tile.isWorked = false;
      }
    }
  }

  /** 一键重新分配：全局最优（总产出价值最大化） */
  reassignAllWorkers(): void {
    this.clearAllWorkers();
    for (let i = 0; i < this.state.population; i++) {
      autoAssignBestWorker(this.state.board);
    }
    this.refreshYieldSnapshot();
    this.emit('state_changed');
  }

  /** 一键重新分配：粮食优先（食物产出最大化） */
  reassignWorkersFoodPriority(): void {
    this.clearAllWorkers();
    for (let i = 0; i < this.state.population; i++) {
      autoAssignBestFoodWorker(this.state.board);
    }
    this.refreshYieldSnapshot();
    this.emit('state_changed');
  }

  /** 刷新每回合产出快照（含道具效果） */
  private refreshYieldSnapshot(): void {
    const baseYields = calculateTotalYields(this.state.board);
    const yields = this.applyItemEffects(baseYields);
    this.state.perTurnYields = yields;
    const grossFood = yields.food;
    const consumption = this.state.population * this.config.foodPerPop;
    this.state.perTurnNetFood = grossFood - consumption;
  }

  // -------- 商店操作（购买地块卡牌） --------

  /** 切换商店卡牌锁定状态 */
  toggleShopLock(index: number): void {
    while (this.state.shopCardLocks.length < this.state.shopCards.length) {
      this.state.shopCardLocks.push(false);
    }
    if (index >= 0 && index < this.state.shopCardLocks.length) {
      this.state.shopCardLocks[index] = !this.state.shopCardLocks[index];
      this.emit('state_changed');
    }
  }

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
    tile.goldInvested = card.cost;

    // 自动分配工人
    if (this.getAvailableWorkers() > 0 && tile.terrain) {
      tile.isWorked = true;
    }

    this.state.storedGold -= card.cost;

    // 从商店移除并清除对应锁
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

  /** 刷新商店 */
  rerollShop(): boolean {
    if (this.state.phase !== 'shopping') return false;
    if (this.state.storedGold < this.config.rerollCost) return false;

    this.state.storedGold -= this.config.rerollCost;

    // 锁定的卡保留
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
    tile.productionInvested += improvement.productionCost;

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
    tile.districtLevel = 1;
    tile.improvement = null;
    tile.improvementLevel = 0;
    tile.productionInvested += district.productionCost;

    this.refreshYieldSnapshot();
    this.emit('tile_placed', coord);
    this.emit('state_changed');
    return true;
  }

  /** 升级已有改良设施或区域 (几何倍率费用) */
  upgradeTile(coord: HexCoord): boolean {
    const tile = getTile(this.state.board, coord);
    if (!tile) return false;

    // 优先尝试改良升级
    if (tile.improvement) {
      if (tile.improvementLevel >= tile.improvement.maxLevel) return false;
      const cost = this.getImprovementUpgradeCost(tile.improvementLevel);
      if (this.state.storedProduction < cost) return false;
      this.state.storedProduction -= cost;
      tile.improvementLevel++;
      tile.productionInvested += cost;
    } else if (tile.district) {
      // 区域升级
      if (tile.districtLevel >= tile.district.maxLevel) return false;
      const cost = this.getDistrictLevelUpCost(tile.districtLevel);
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

  // -------- 出售地块 --------

  /** 出售地块，返还部分金币和生产力 */
  sellTile(coord: HexCoord): { goldRefund: number; productionRefund: number } | null {
    const tile = getTile(this.state.board, coord);
    if (!tile || !tile.terrain || tile.terrain.id === 'city_center') return null;

    const ratio = this.config.sellRefundRatio;
    const goldRefund = Math.floor(tile.goldInvested * ratio);
    const productionRefund = Math.floor(tile.productionInvested * ratio);

    // 重置地块
    tile.terrain = null;
    tile.feature = null;
    tile.resource = null;
    tile.improvement = null;
    tile.improvementLevel = 0;
    tile.district = null;
    tile.isWorked = false;
    tile.goldInvested = 0;
    tile.productionInvested = 0;

    // 返还资源
    this.state.storedGold += goldRefund;
    this.state.storedProduction += productionRefund;

    this.refreshYieldSnapshot();
    this.emit('state_changed');
    return { goldRefund, productionRefund };
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

  // -------- 道具系统（建筑入场券机制） --------

  /**
   * 计算指定池的最大入场券数（来自建筑）。
   * - 区域：每级 +1（Lv1=+1, Lv2=+2, ...）
   * - 改良：Lv2+ 时 +1（不随级别增长）
   */
  getItemShopMaxEntries(pool: ItemPool): number {
    let total = 0;
    for (const tile of this.state.board.values()) {
      // 区域：shopPool 匹配时，加上区域等级
      if (tile.district && tile.district.shopPool === pool) {
        total += tile.districtLevel;
      }
      // 改良：shopPool 匹配且 Lv2+ 时 +1
      if (tile.improvement && tile.improvement.shopPool === pool && tile.improvementLevel >= 2) {
        total += 1;
      }
    }
    return total;
  }

  /** 获取指定池的剩余入场次数（建筑配额 - 已使用） */
  getItemShopRemainingEntries(pool: ItemPool): number {
    return Math.max(0, this.getItemShopMaxEntries(pool) - this.state.itemShopUsed[pool]);
  }

  /** 能否进入指定道具商店（有免费券 或 有剩余建筑配额） */
  canEnterItemShop(pool: ItemPool): boolean {
    if (this.state.freeItemShopEntries.includes(pool)) return true;
    return this.getItemShopRemainingEntries(pool) > 0;
  }

  /** 消耗入场券并生成道具选项 */
  enterItemShop(pool: ItemPool): IItemDef[] | null {
    // 优先消耗免费券
    const freeIdx = this.state.freeItemShopEntries.indexOf(pool);
    if (freeIdx >= 0) {
      this.state.freeItemShopEntries.splice(freeIdx, 1);
    } else {
      // 消耗建筑配额
      if (this.getItemShopRemainingEntries(pool) <= 0) return null;
      this.state.itemShopUsed[pool]++;
    }

    // 从池中随机抽取
    const poolItems = ITEM_POOL[pool] || [];
    const offerings = this.randomPickItems(poolItems, this.config.itemShopOfferingCount);

    this.emit('state_changed');
    return offerings;
  }

  /** 从池中随机不重复抽取N个道具 */
  private randomPickItems(pool: IItemDef[], count: number): IItemDef[] {
    // 加权抽取（rarity越高权重越低）
    const weighted = pool.map(item => ({
      item,
      weight: item.rarity === 1 ? 10 : item.rarity === 2 ? 5 : 2,
    }));

    const result: IItemDef[] = [];
    const available = [...weighted];

    for (let i = 0; i < count && available.length > 0; i++) {
      const totalWeight = available.reduce((s, w) => s + w.weight, 0);
      let roll = Math.random() * totalWeight;
      let picked = available[0];
      for (const w of available) {
        roll -= w.weight;
        if (roll <= 0) {
          picked = w;
          break;
        }
      }
      result.push(picked.item);
      const idx = available.indexOf(picked);
      if (idx >= 0) available.splice(idx, 1);
    }

    return result;
  }

  /** 玩家选择一个道具并获得 */
  claimItem(item: IItemDef): void {
    this.state.items.push(item);

    // 处理即时效果
    for (const effect of item.effects) {
      switch (effect.type) {
        case 'instant': {
          if (effect.yields) {
            if (effect.yields.gold) this.state.storedGold += effect.yields.gold;
            if (effect.yields.production) this.state.storedProduction += effect.yields.production;
            if (effect.yields.science) this.state.storedScience += effect.yields.science;
            if (effect.yields.culture) this.state.accumulatedCulture += effect.yields.culture;
            if (effect.yields.faith) this.state.accumulatedFaith += effect.yields.faith;
            if (effect.yields.food) this.state.foodProgress += effect.yields.food;
          }
          break;
        }
        case 'pop_growth': {
          this.state.population++;
          autoAssignBestWorker(this.state.board);
          this.checkOuterUnlock();
          break;
        }
      }
    }

    this.refreshYieldSnapshot();
    this.emit('item_acquired', item);
    this.emit('state_changed');
  }

  // -------- 尤里卡时刻 --------

  /** 检查尤里卡条件 */
  private checkEurekas(): void {
    for (const eureka of EUREKA_DEFS) {
      if (this.state.eurekaTriggered.includes(eureka.id)) continue;
      if (this.state.turn !== eureka.checkTurn) continue;

      if (this.checkEurekaCondition(eureka.id)) {
        this.state.eurekaTriggered.push(eureka.id);
        this.state.freeItemShopEntries.push(eureka.pool);
        this.emit('eureka_triggered', eureka);
      }
    }
  }

  /** 检查具体的尤里卡条件 */
  private checkEurekaCondition(id: string): boolean {
    const s = this.state;
    switch (id) {
      case 'eureka_pop3_t5':
        return s.population >= 3;
      case 'eureka_prod15_t5':
        return s.storedProduction >= 15;
      case 'eureka_district_t8': {
        for (const [, tile] of s.board) {
          if (tile.district) return true;
        }
        return false;
      }
      case 'eureka_pop5_t12':
        return s.population >= 5;
      case 'eureka_culture20_t10':
        return s.accumulatedCulture >= 20;
      case 'eureka_tiles8_t15': {
        let workedCount = 0;
        for (const [, tile] of s.board) {
          if (tile.isWorked) workedCount++;
        }
        return workedCount >= 8;
      }
      default:
        return false;
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
    const science = this.state.storedScience;
    const culture = this.state.accumulatedCulture;
    const faith = this.state.accumulatedFaith;
    return { science, culture, faith, total: science + culture + faith };
  }

  // -------- 胜利目标 --------

  /** 获取当前目标类型对应的资源值 */
  getGoalCurrentValue(goalType?: VictoryGoalType): number {
    const type = goalType ?? this.config.victoryGoalType;
    switch (type) {
      case 'score': return this.getFinalScore().total;
      case 'population': return this.state.population;
      case 'gold': return this.state.storedGold;
      case 'faith': return this.state.accumulatedFaith;
      case 'science': return this.state.storedScience;
      case 'culture': return this.state.accumulatedCulture;
      default: return 0;
    }
  }

  /** 获取当前目标进度 */
  getGoalProgress(): { type: VictoryGoalType; current: number; target: number; ratio: number; achieved: boolean } {
    const type = this.config.victoryGoalType;
    const target = this.config.victoryGoalTarget;
    const current = this.getGoalCurrentValue(type);
    const ratio = target > 0 ? Math.min(current / target, 1) : 1;
    return { type, current, target, ratio, achieved: current >= target };
  }

  /** 获取目标预设信息 */
  getGoalPreset(): { name: string; icon: string; description: string } {
    const preset = VICTORY_GOAL_PRESETS.find(p => p.type === this.config.victoryGoalType);
    return preset
      ? { name: preset.name, icon: preset.icon, description: preset.description }
      : { name: '综合得分', icon: '🏆', description: '' };
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

  getRerollCost(): number { return this.config.rerollCost; }
  getFoodPerPop(): number { return this.config.foodPerPop; }
  getProductionPerUpgrade(): number { return this.config.productionPerUpgrade; }
  getDistrictUpgradeCost(): number { return this.config.districtUpgradeCost; }
}
