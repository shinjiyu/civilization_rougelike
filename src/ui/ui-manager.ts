/**
 * UI 管理器
 * 负责所有 DOM UI 的更新和事件绑定
 * 与 Canvas 渲染器协作
 */

import type { IGameConfig } from '../core/config';
import { CONFIG_META, DEFAULT_CONFIG, loadConfig, resetConfig, saveConfig } from '../core/config';
import type { HexCoord, IAdjacencyRule, IShopCard, ItemPool, IYields } from '../core/types';
import { addYields, emptyYields, yieldColor, yieldIcon, yieldsToString } from '../core/yields';
import { DISTRICT_REGISTRY } from '../data/districts';
import { IMPROVEMENT_REGISTRY } from '../data/improvements';
import { EUREKA_DEFS } from '../data/items';
import { calculateAdjacencyBonus, getNeighborTiles, tileHasTag, upgradeMarginalYield } from '../game/board';
import { GameEngine } from '../game/engine';
/** 渲染器接口 - 2D和3D渲染器都实现此接口 */
interface IHexRenderer {
  onHexClick: ((coord: HexCoord) => void) | null;
  onHexHover: ((coord: HexCoord | null) => void) | null;
  setValidPlacements(coords: HexCoord[]): void;
  clearValidPlacements(): void;
  setSelectedHex(coord: HexCoord | null): void;
  draw(): void;
  toggleYieldLabels(): void;
  getYieldLabelsVisible(): boolean;
}

export class UIManager {
  private engine: GameEngine;
  private renderer: IHexRenderer;

  private hudTurn!: HTMLElement;
  private hudYields!: HTMLElement;
  private hudScore!: HTMLElement;
  private shopCards!: HTMLElement;
  private tileInfo!: HTMLElement;
  private gameOverOverlay!: HTMLElement;
  private gameOverContent!: HTMLElement;
  private toast!: HTMLElement;

  private toastTimer: number | null = null;
  /** 当前选中的地块坐标 */
  private selectedTileCoord: HexCoord | null = null;
  /** 待确认的操作（二次确认） */
  private pendingConfirm: {
    action: string;
    id?: string;
    coord: HexCoord;
    description: string;
  } | null = null;

  /** 是否为移动端布局 */
  private isMobile = false;
  private mobileQuery: MediaQueryList;

  constructor(engine: GameEngine, renderer: IHexRenderer) {
    this.engine = engine;
    this.renderer = renderer;
    this.mobileQuery = window.matchMedia('(max-width: 768px)');
    this.isMobile = this.mobileQuery.matches;
    this.mobileQuery.addEventListener('change', (e) => {
      this.isMobile = e.matches;
      if (!this.isMobile) {
        // 桌面端恢复两个面板都展开
        document.getElementById('left-panel')?.classList.remove('collapsed');
        document.getElementById('right-panel')?.classList.remove('collapsed');
      }
    });
    this.cacheElements();
    this.bindActions();
    this.bindRendererCallbacks();
    this.bindEngineEvents();
    this.bindInfoPanelActions();
    this.bindSettingsActions();
    this.bindItemShopActions();
    this.bindPanelToggles();
    this.createYieldToggleButton();
  }

  private cacheElements(): void {
    this.hudTurn = document.getElementById('hud-turn')!;
    this.hudYields = document.getElementById('hud-yields')!;
    this.hudScore = document.getElementById('hud-score')!;
    this.shopCards = document.getElementById('shop-cards')!;
    this.tileInfo = document.getElementById('tile-info')!;
    this.gameOverOverlay = document.getElementById('game-over-overlay')!;
    this.gameOverContent = document.getElementById('game-over-content')!;
    this.toast = document.getElementById('toast')!;
  }

  private bindActions(): void {
    document.getElementById('btn-end-turn')!.addEventListener('click', () => {
      this.engine.endTurn();
      // 移动端：结束回合后自动展开商店区
      if (this.isMobile) {
        document.getElementById('left-panel')?.classList.remove('collapsed');
        document.getElementById('right-panel')?.classList.add('collapsed');
      }
    });
    document.getElementById('btn-reroll')!.addEventListener('click', () => {
      if (!this.engine.rerollShop()) {
        this.showToast('金币不足，无法刷新商店');
      }
    });
    document.getElementById('btn-new-game')!.addEventListener('click', () => {
      this.selectedTileCoord = null;
      this.pendingConfirm = null;
      this.renderer.setSelectedHex(null);
      GameEngine.clearSave();
      const config = loadConfig();
      this.engine.startNewGame(config);
      this.gameOverOverlay.classList.remove('visible');
    });

    document.getElementById('btn-reassign-food')!.addEventListener('click', () => {
      this.engine.reassignWorkersFoodPriority();
      this.showToast('已按粮食优先重新分配');
    });
    document.getElementById('btn-reassign-all')!.addEventListener('click', () => {
      this.engine.reassignAllWorkers();
      this.showToast('已按全局最优重新分配');
    });

    document.getElementById('btn-rules')!.addEventListener('click', () => {
      this.openRules();
    });
    document.getElementById('btn-close-rules')!.addEventListener('click', () => {
      document.getElementById('rules-overlay')!.classList.remove('visible');
    });

    document.getElementById('btn-settings')!.addEventListener('click', () => {
      this.openSettings();
    });

    // 商店升级
    document.getElementById('shop-panel')!.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('#btn-upgrade-shop')) {
        if (this.engine.upgradeShop()) {
          this.showToast('商店已升级！');
        } else {
          this.showToast('科技不足');
        }
      }
    });
  }

  /** 信息面板操作按钮的事件委托 */
  private bindInfoPanelActions(): void {
    this.tileInfo.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.build-action-btn') as HTMLElement | null;
      if (!btn) return;

      const action = btn.dataset.action!;
      const coord = this.selectedTileCoord;

      switch (action) {
        case 'assign-worker':
          if (coord && this.engine.assignWorker(coord)) this.showToast('工人已分配');
          else this.showToast('无法分配工人');
          break;
        case 'unassign-worker':
          if (coord && this.engine.unassignWorker(coord)) this.showToast('工人已撤回');
          else this.showToast('无法撤回');
          break;
        case 'build-improvement': {
          if (!coord) break;
          const impId = btn.dataset.id!;
          const tile = this.engine.getTileAt(coord);
          if (tile && tile.improvement && tile.improvement.id !== impId) {
            this.pendingConfirm = {
              action: 'build-improvement', id: impId, coord,
              description: `将替换当前改良「${tile.improvement.name}」，是否继续？`,
            };
            this.updateTileInfo(coord);
            return;
          }
          if (this.engine.buildImprovement(coord, impId)) this.showToast('建造成功！');
          else this.showToast('生产力不足');
          break;
        }
        case 'build-district': {
          if (!coord) break;
          const distId = btn.dataset.id!;
          const tile = this.engine.getTileAt(coord);
          if (tile && tile.improvement) {
            this.pendingConfirm = {
              action: 'build-district', id: distId, coord,
              description: `建造区域将替换当前改良「${tile.improvement.name}」，是否继续？`,
            };
            this.updateTileInfo(coord);
            return;
          }
          if (this.engine.buildDistrict(coord, distId)) this.showToast('建造成功！');
          else this.showToast('生产力不足');
          break;
        }
        case 'upgrade-improvement':
          if (coord && this.engine.upgradeTile(coord)) this.showToast('升级成功！');
          else this.showToast('生产力不足');
          break;
        case 'sell-tile': {
          if (!coord) break;
          this.pendingConfirm = {
            action: 'sell-tile', coord,
            description: '确认出售此地块？投入的资源将按比例返还。',
          };
          this.updateTileInfo(coord);
          break;
        }
        case 'unlock-hex': {
          const q = parseInt(btn.dataset.q!);
          const r = parseInt(btn.dataset.r!);
          const c = { q, r };
          if (this.engine.unlockHexByGold(c)) {
            this.showToast('格子已解锁！');
            this.selectedTileCoord = c;
            this.renderer.setSelectedHex(c);
          } else {
            this.showToast('金币不足或无法解锁');
          }
          break;
        }
        case 'confirm-action': {
          if (!this.pendingConfirm) break;
          const pending = this.pendingConfirm;
          this.pendingConfirm = null;
          this.executePendingAction(pending);
          break;
        }
        case 'cancel-action': {
          this.pendingConfirm = null;
          if (this.selectedTileCoord) this.updateTileInfo(this.selectedTileCoord);
          break;
        }
      }
    });
  }

  /** 执行待确认的操作 */
  private executePendingAction(pending: { action: string; id?: string; coord: HexCoord }): void {
    switch (pending.action) {
      case 'build-improvement':
        if (this.engine.buildImprovement(pending.coord, pending.id!)) this.showToast('建造成功！');
        else this.showToast('生产力不足');
        break;
      case 'build-district':
        if (this.engine.buildDistrict(pending.coord, pending.id!)) this.showToast('建造成功！');
        else this.showToast('生产力不足');
        break;
      case 'sell-tile': {
        const result = this.engine.sellTile(pending.coord);
        if (result) {
          const parts: string[] = [];
          if (result.goldRefund > 0) parts.push(`${result.goldRefund}🪙`);
          if (result.productionRefund > 0) parts.push(`${result.productionRefund}⚙️`);
          this.showToast(`已出售！${parts.length > 0 ? '返还 ' + parts.join(' ') : ''}`);
          this.selectedTileCoord = null;
          this.renderer.setSelectedHex(null);
        }
        break;
      }
    }
  }

  // -------- 道具商店 --------

  private bindItemShopActions(): void {
    // 道具商店入口按钮（事件委托）
    document.getElementById('item-shop-entries')!.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.item-shop-entry-btn') as HTMLElement | null;
      if (!btn || btn.hasAttribute('disabled')) return;
      const pool = btn.dataset.pool as ItemPool;
      this.openItemShop(pool);
    });

    // 关闭道具商店
    document.getElementById('btn-close-item-shop')!.addEventListener('click', () => {
      document.getElementById('item-shop-overlay')!.classList.remove('visible');
    });
  }

  private openItemShop(pool: ItemPool): void {
    const offerings = this.engine.enterItemShop(pool);
    if (!offerings) {
      this.showToast('资源不足');
      return;
    }

    const poolNames: Record<ItemPool, string> = { gold: '🪙 金币', culture: '🎭 文化', faith: '🙏 信仰' };
    const title = document.getElementById('item-shop-title')!;
    title.textContent = `🎁 ${poolNames[pool]}道具商店`;

    const container = document.getElementById('item-shop-offerings')!;
    container.innerHTML = '';

    for (const item of offerings) {
      const rarityStars = '★'.repeat(item.rarity);
      const rarityColor = item.rarity === 3 ? 'var(--accent-purple)' : item.rarity === 2 ? 'var(--accent-blue)' : 'var(--text-muted)';

      const card = document.createElement('div');
      card.className = 'item-offering-card';
      card.innerHTML = `
        <div class="item-offering-header">
          <span class="item-offering-icon">${item.icon}</span>
          <span class="item-offering-name">${item.name}</span>
          <span class="item-offering-rarity" style="color:${rarityColor}">${rarityStars}</span>
        </div>
        <div class="item-offering-desc">${item.description}</div>
      `;
      card.addEventListener('click', () => {
        this.engine.claimItem(item);
        document.getElementById('item-shop-overlay')!.classList.remove('visible');
        this.showToast(`获得道具「${item.name}」！`);
      });
      container.appendChild(card);
    }

    document.getElementById('item-shop-overlay')!.classList.add('visible');
  }

  // -------- 面板折叠 --------

  private bindPanelToggles(): void {
    document.getElementById('toggle-left')?.addEventListener('click', () => {
      this.expandPanel('left');
    });
    document.getElementById('toggle-right')?.addEventListener('click', () => {
      this.expandPanel('right');
    });
  }

  /** 移动端面板互斥展开 */
  private expandPanel(panel: 'left' | 'right'): void {
    if (!this.isMobile) return;
    const leftPanel = document.getElementById('left-panel')!;
    const rightPanel = document.getElementById('right-panel')!;
    if (panel === 'left') {
      const wasCollapsed = leftPanel.classList.contains('collapsed');
      leftPanel.classList.toggle('collapsed', !wasCollapsed);
      if (wasCollapsed) rightPanel.classList.add('collapsed');
    } else {
      const wasCollapsed = rightPanel.classList.contains('collapsed');
      rightPanel.classList.toggle('collapsed', !wasCollapsed);
      if (wasCollapsed) leftPanel.classList.add('collapsed');
    }
  }

  // -------- 收益标签显隐按钮 --------

  private createYieldToggleButton(): void {
    const container = document.getElementById('board-container')!;
    const btn = document.createElement('button');
    btn.id = 'btn-toggle-yields';
    btn.className = 'yield-toggle-btn';
    btn.textContent = '📊';
    btn.title = '显示/隐藏收益标签';
    btn.addEventListener('click', () => {
      this.renderer.toggleYieldLabels();
      const visible = this.renderer.getYieldLabelsVisible();
      btn.classList.toggle('off', !visible);
      btn.title = visible ? '隐藏收益标签' : '显示收益标签';
    });
    container.appendChild(btn);
  }

  private updateItemShopPanel(): void {
    const state = this.engine.getState();
    const entries = document.getElementById('item-shop-entries')!;
    const config = this.engine.getConfig();

    const pools: { pool: ItemPool; icon: string; name: string; cost: number; currency: string }[] = [
      { pool: 'gold', icon: '🪙', name: '金币池', cost: config.itemShopGoldCost, currency: '🪙' },
      { pool: 'culture', icon: '🎭', name: '文化池', cost: config.itemShopCultureCost, currency: '🎭' },
      { pool: 'faith', icon: '🙏', name: '信仰池', cost: config.itemShopFaithCost, currency: '🙏' },
    ];

    entries.innerHTML = '';
    for (const p of pools) {
      const canEnter = this.engine.canEnterItemShop(p.pool);
      const hasFree = state.freeItemShopEntries.includes(p.pool);
      const btn = document.createElement('button');
      btn.className = `item-shop-entry-btn${hasFree ? ' has-free' : ''}`;
      btn.dataset.pool = p.pool;
      if (!canEnter || state.phase === 'game_over') btn.setAttribute('disabled', '');
      btn.innerHTML = `
        <span class="entry-pool">${p.icon} ${p.name}</span>
        <span class="entry-cost">${hasFree ? '🎫 免费券' : `${p.cost}${p.currency}`}</span>
      `;
      entries.appendChild(btn);
    }

    // 尤里卡徽章
    const eurekaBadges = document.getElementById('eureka-badges')!;
    const badgesHtml: string[] = [];
    for (const eureka of EUREKA_DEFS) {
      const triggered = state.eurekaTriggered.includes(eureka.id);
      const cls = triggered ? 'triggered' : 'pending';
      badgesHtml.push(`<span class="eureka-badge ${cls}" title="${eureka.description}">${triggered ? '✅' : '⏳'} T${eureka.checkTurn}</span>`);
    }
    eurekaBadges.innerHTML = badgesHtml.length > 0 ? `<span style="font-size:10px;color:var(--text-muted)">尤里卡: </span>${badgesHtml.join('')}` : '';

    // 道具背包
    const invPanel = document.getElementById('item-inventory-panel')!;
    const invContainer = document.getElementById('item-inventory')!;
    if (state.items.length > 0) {
      invPanel.style.display = '';
      invContainer.innerHTML = state.items.map(item =>
        `<span class="inventory-item" title="${item.description}">${item.icon} ${item.name}<span class="inventory-tooltip">${item.description}</span></span>`
      ).join('');
    } else {
      invPanel.style.display = 'none';
    }
  }

  // -------- 设置面板 --------

  private bindSettingsActions(): void {
    document.getElementById('btn-save-settings')!.addEventListener('click', () => {
      this.saveSettings();
    });
    document.getElementById('btn-reset-settings')!.addEventListener('click', () => {
      resetConfig();
      this.fillSettingsForm({ ...DEFAULT_CONFIG });
      this.showToast('已恢复默认设置');
    });
    document.getElementById('btn-close-settings')!.addEventListener('click', () => {
      document.getElementById('settings-overlay')!.classList.remove('visible');
    });
  }

  // -------- 规则说明 --------

  private openRules(): void {
    const body = document.getElementById('rules-body')!;
    // 生成地形-改良绑定表
    const impRows = Object.values(IMPROVEMENT_REGISTRY).map(imp =>
      `<tr><td>${imp.icon} ${imp.name}</td><td>${imp.terrainHint || imp.placementRequireTags.join(', ')}</td><td>${imp.productionCost}⚙️</td></tr>`
    ).join('');
    const distRows = Object.values(DISTRICT_REGISTRY).map(dist =>
      `<tr><td>${dist.icon} ${dist.name}</td><td>${dist.placementRequireTags.join(', ')}</td><td>${dist.productionCost}⚙️</td></tr>`
    ).join('');

    // 邻接加成表
    const adjRows: string[] = [];
    for (const imp of Object.values(IMPROVEMENT_REGISTRY)) {
      for (const rule of imp.adjacencyRules) {
        adjRows.push(`<tr><td>${imp.icon} ${imp.name}</td><td>${rule.description}</td></tr>`);
      }
    }
    for (const dist of Object.values(DISTRICT_REGISTRY)) {
      for (const rule of dist.adjacencyRules) {
        adjRows.push(`<tr><td>${dist.icon} ${dist.name}</td><td>${rule.description}</td></tr>`);
      }
    }

    body.innerHTML = `
      <h2>📖 游戏规则</h2>

      <h3>🎯 目标</h3>
      <p>在有限回合内，购买地块、建造设施、分配工人，最大化 <b>科技+文化+信仰</b> 得分。</p>

      <h3>🔄 回合流程</h3>
      <ul>
        <li>每回合开始自动结算产出、人口增减</li>
        <li>商店刷新地块卡牌（锁定的卡保留）</li>
        <li>自动检查尤里卡时刻触发</li>
        <li>可随时建造改良/区域、进入道具商店</li>
        <li>点击「结束回合」进入下一回合</li>
      </ul>

      <h3>💰 六种产出</h3>
      <table class="rules-table">
        <tr><th>产出</th><th>用途</th><th>计分</th></tr>
        <tr><td>🪙 金币</td><td>购买地块、刷新商店、解锁格子、道具门票</td><td>❌</td></tr>
        <tr><td>🌾 食物</td><td>人口增长（净食物累积达阈值→+1人口）</td><td>❌</td></tr>
        <tr><td>⚙️ 生产力</td><td>建造改良/区域/升级</td><td>❌</td></tr>
        <tr><td>🔬 科技</td><td>升级商店等级（花费），剩余计入得分</td><td>✅</td></tr>
        <tr><td>🎭 文化</td><td>道具商店门票 + 累积得分</td><td>✅</td></tr>
        <tr><td>🙏 信仰</td><td>道具商店门票 + 累积得分</td><td>✅</td></tr>
      </table>

      <h3>🗺️ 地图系统</h3>
      <ul>
        <li>地图共<b>4环</b>，中心为主城，第1环自动解锁</li>
        <li>人口增长自动解锁外圈格子（优先低环数）</li>
        <li>也可花费金币手动解锁相邻的锁定格子：
          <ul>
            <li>2环: ${this.engine.getConfig().hexUnlockCostRing2}🪙</li>
            <li>3环: ${this.engine.getConfig().hexUnlockCostRing3}🪙</li>
            <li>4环: ${this.engine.getConfig().hexUnlockCostRing4}🪙</li>
          </ul>
        </li>
      </ul>

      <h3>👥 人口系统</h3>
      <ul>
        <li>人口 = 可分配工人数（主城免费不占人口）</li>
        <li>只有分配了工人的地块才产出</li>
        <li>增长需求随人口递增（非线性）</li>
        <li>净食物为负时人口减少（最低1）</li>
      </ul>

      <h3>🏪 地块商店</h3>
      <ul>
        <li>商店只出售地块卡牌（★/★★/★★★ 三档）</li>
        <li>可锁定卡牌，锁定后回合结束不刷新</li>
        <li>花费🔬升级商店→提高稀有地块概率</li>
        <li>花费🪙可手动刷新卡牌</li>
      </ul>

      <h3>🔨 建造系统 - 地形限制</h3>
      <table class="rules-table">
        <tr><th>改良</th><th>适用地形</th><th>费用</th></tr>
        ${impRows}
      </table>
      <table class="rules-table" style="margin-top:8px">
        <tr><th>区域</th><th>适用地形</th><th>费用</th></tr>
        ${distRows}
      </table>

      <h3>🔗 邻接加成一览</h3>
      <table class="rules-table">
        <tr><th>设施</th><th>加成规则</th></tr>
        ${adjRows.join('')}
      </table>

      <h3>🎁 道具系统</h3>
      <ul>
        <li>支付门票（🪙/🎭/🙏）进入对应池的道具商店</li>
        <li>每次从池中随机展示${this.engine.getConfig().itemShopOfferingCount}个道具，选择1个获得</li>
        <li>道具提供持续加成（每回合加成/百分比提升等）</li>
        <li>持有数量无上限，随时可进入商店</li>
        <li>部分道具有即时效果（如立即获得资源、+1人口）</li>
      </ul>

      <h3>⚡ 尤里卡时刻</h3>
      <p>达到特定里程碑可获得免费道具商店入场券：</p>
      <table class="rules-table">
        <tr><th>条件</th><th>奖励</th></tr>
        ${EUREKA_DEFS.map(e => `<tr><td>${e.description}</td><td>免费${e.pool === 'gold' ? '🪙' : e.pool === 'culture' ? '🎭' : '🙏'}商店</td></tr>`).join('')}
      </table>

      <h3>💡 出售地块</h3>
      <p>选中地块后可出售，返还已投入金币和生产力的一定比例。</p>

      <h3>🏆 终局得分</h3>
      <p><b>总分 = 剩余科技 + 累积文化 + 累积信仰</b></p>

      <div class="rules-footer">
        <p>文明精铺 Roguelike v2.0</p>
        <p class="dev-contact">开发者 QQ: 1806153872</p>
      </div>
    `;
    document.getElementById('rules-overlay')!.classList.add('visible');
  }

  private openSettings(): void {
    const config = loadConfig();
    this.fillSettingsForm(config);
    document.getElementById('settings-overlay')!.classList.add('visible');
  }

  private fillSettingsForm(config: IGameConfig): void {
    const grid = document.getElementById('settings-grid')!;
    grid.innerHTML = '';
    for (const meta of CONFIG_META) {
      const label = document.createElement('label');
      label.textContent = meta.label;
      label.setAttribute('for', `cfg-${meta.key}`);

      const input = document.createElement('input');
      input.type = 'number';
      input.id = `cfg-${meta.key}`;
      input.min = String(meta.min);
      input.max = String(meta.max);
      input.step = String(meta.step);
      input.value = String(config[meta.key]);

      grid.appendChild(label);
      grid.appendChild(input);
    }
  }

  private saveSettings(): void {
    const config: IGameConfig = { ...DEFAULT_CONFIG };
    for (const meta of CONFIG_META) {
      const input = document.getElementById(`cfg-${meta.key}`) as HTMLInputElement;
      if (input) {
        let val = parseFloat(input.value);
        if (val < meta.min) val = meta.min;
        if (val > meta.max) val = meta.max;
        (config as any)[meta.key] = meta.step < 1 ? val : Math.round(val);
      }
    }
    saveConfig(config);
    document.getElementById('settings-overlay')!.classList.remove('visible');
    this.showToast('设置已保存，下局新游戏生效');
  }

  private bindRendererCallbacks(): void {
    this.renderer.onHexClick = (coord) => this.handleHexClick(coord);
    this.renderer.onHexHover = (coord) => this.handleHexHover(coord);
  }

  private bindEngineEvents(): void {
    this.engine.on((event, data) => {
      switch (event) {
        case 'state_changed':
          this.updateAll();
          break;
        case 'game_over':
          this.showGameOver();
          break;
        case 'eureka_triggered': {
          const eureka = data as { description: string };
          if (eureka) this.showToast(`⚡ 尤里卡！${eureka.description}`);
          break;
        }
      }
    });
  }

  // -------- 事件处理 --------

  private handleHexClick(coord: HexCoord): void {
    const state = this.engine.getState();

    if (state.phase === 'placing' && state.selectedCard) {
      const success = this.engine.placeCard(coord);
      if (success) {
        this.renderer.clearValidPlacements();
        this.selectedTileCoord = coord;
        this.renderer.setSelectedHex(coord);
        this.pendingConfirm = null;
        this.showToast('放置成功！');
      } else {
        this.showToast('无法放置在此位置');
      }
      return;
    }

    if (
      this.selectedTileCoord &&
      this.selectedTileCoord.q === coord.q &&
      this.selectedTileCoord.r === coord.r
    ) {
      this.selectedTileCoord = null;
      this.pendingConfirm = null;
      this.renderer.setSelectedHex(null);
      this.tileInfo.innerHTML = '<div style="color: var(--text-muted)">点击地块查看详情和操作</div>';
    } else {
      this.selectedTileCoord = coord;
      this.pendingConfirm = null;
      this.renderer.setSelectedHex(coord);
      this.updateTileInfo(coord);
      // 移动端：点击地块自动展开改良区
      if (this.isMobile) {
        document.getElementById('right-panel')?.classList.remove('collapsed');
        document.getElementById('left-panel')?.classList.add('collapsed');
      }
    }
  }

  private handleHexHover(coord: HexCoord | null): void {
    if (this.selectedTileCoord) return;
    if (coord) {
      this.updateTileInfo(coord);
    } else {
      this.tileInfo.innerHTML = '<div style="color: var(--text-muted)">点击地块查看详情和操作</div>';
    }
  }

  // -------- 卡牌选择 --------

  private selectShopCard(card: IShopCard): void {
    const state = this.engine.getState();
    if (state.selectedCard?.instanceId === card.instanceId) {
      this.engine.deselectCard();
      this.renderer.clearValidPlacements();
      return;
    }
    if (this.engine.selectCard(card)) {
      this.selectedTileCoord = null;
      this.pendingConfirm = null;
      this.renderer.setSelectedHex(null);

      const validCoords = this.engine.getValidPlacements();
      this.renderer.setValidPlacements(validCoords);
      if (validCoords.length === 0) {
        this.showToast('没有可放置的位置');
        this.engine.deselectCard();
        this.renderer.clearValidPlacements();
      }
    } else {
      this.showToast('金币不足');
    }
  }

  // -------- UI 更新 --------

  updateAll(): void {
    this.updateHUD();
    this.updateShop();
    this.updateItemShopPanel();
    if (this.selectedTileCoord) {
      this.updateTileInfo(this.selectedTileCoord);
    }
    this.renderer.draw();
  }

  private updateHUD(): void {
    const state = this.engine.getState();
    const yields = state.perTurnYields;
    const available = this.engine.getAvailableWorkers();
    const threshold = this.engine.getGrowthThreshold();

    this.hudTurn.innerHTML = `
      <div>回合 ${state.turn}/${state.maxTurns}</div>
      <div style="font-size:13px;color:var(--text-secondary)">
        👥 人口 ${state.population}
        <span style="color:${available > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}">
          (${available > 0 ? available + ' 空闲' : '已满'})
        </span>
        ${state.items.length > 0 ? `<span style="color:var(--accent-purple);margin-left:4px">📦${state.items.length}</span>` : ''}
      </div>
    `;

    const netFoodStr =
      state.perTurnNetFood >= 0
        ? `<span style="color:var(--accent-green)">+${state.perTurnNetFood}</span>`
        : `<span style="color:var(--accent-red)">${state.perTurnNetFood}</span>`;

    this.hudYields.innerHTML = `
      ${this.yieldHtml('gold', state.storedGold, yields.gold)}
      <div class="yield-item">
        <span>🌾</span>
        <span class="yield-value" style="color:${yieldColor('food')}">${Math.floor(state.foodProgress)}/${threshold}</span>
        <span class="yield-per-turn">(${netFoodStr}/t)</span>
      </div>
      ${this.yieldHtml('production', state.storedProduction, yields.production)}
      ${this.yieldHtml('science', state.storedScience, yields.science)}
      ${this.yieldHtml('culture', state.accumulatedCulture, yields.culture)}
      ${this.yieldHtml('faith', state.accumulatedFaith, yields.faith)}
    `;

    const score = this.engine.getFinalScore();
    this.hudScore.innerHTML = `得分 <span class="score-value">${score.total}</span>`;

    const rerollBtn = document.getElementById('btn-reroll') as HTMLButtonElement;
    if (rerollBtn) {
      rerollBtn.disabled = state.storedGold < this.engine.getRerollCost() || state.phase === 'game_over';
      rerollBtn.textContent = `刷新 ${this.engine.getRerollCost()}🪙`;
    }
    const endTurnBtn = document.getElementById('btn-end-turn') as HTMLButtonElement;
    if (endTurnBtn) {
      endTurnBtn.disabled = state.phase === 'game_over';
    }
  }

  private yieldHtml(key: string, stored: number, perTurn: number): string {
    const icon = yieldIcon(key as keyof IYields);
    const color = yieldColor(key as keyof IYields);
    const ptStr = perTurn > 0 ? `+${perTurn}` : perTurn === 0 ? '' : `${perTurn}`;
    return `
      <div class="yield-item">
        <span>${icon}</span>
        <span class="yield-value" style="color:${color}">${stored}</span>
        ${ptStr ? `<span class="yield-per-turn">(${ptStr}/t)</span>` : ''}
      </div>
    `;
  }

  private updateShop(): void {
    const state = this.engine.getState();
    const shopPanel = document.getElementById('shop-panel')!;
    const shopH3 = shopPanel.querySelector('h3')!;

    const upgradeCost = this.engine.getShopUpgradeCost();
    let upgradeHtml = '';
    if (upgradeCost !== null) {
      const canUpgrade = state.storedScience >= upgradeCost;
      upgradeHtml = `<button id="btn-upgrade-shop" class="shop-upgrade-btn" ${canUpgrade ? '' : 'disabled'}>升级 ${upgradeCost}🔬</button>`;
    } else {
      upgradeHtml = '<span style="color:var(--accent-gold);font-size:11px">MAX</span>';
    }
    shopH3.innerHTML = `<span>商店 Lv.${state.shopLevel}</span>${upgradeHtml}`;

    if (state.phase === 'game_over') {
      this.shopCards.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">游戏结束</div>';
      return;
    }

    this.shopCards.innerHTML = '';

    // Ensure locks array is the right size
    while (state.shopCardLocks.length < state.shopCards.length) {
      (state as any).shopCardLocks.push(false);
    }

    for (let i = 0; i < state.shopCards.length; i++) {
      const card = state.shopCards[i];
      const isSelected = state.selectedCard?.instanceId === card.instanceId;
      const tooExpensive = state.storedGold < card.cost;
      const isLocked = state.shopCardLocks[i] || false;

      const wrapper = document.createElement('div');
      wrapper.className = 'shop-card-wrapper';

      // Lock button
      const lockBtn = document.createElement('button');
      lockBtn.className = `shop-lock-btn${isLocked ? ' locked' : ''}`;
      lockBtn.textContent = isLocked ? '🔒' : '🔓';
      lockBtn.title = isLocked ? '已锁定（点击解锁）' : '点击锁定';
      const idx = i;
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.toggleShopLock(idx);
      });
      wrapper.appendChild(lockBtn);

      const cardEl = document.createElement('div');
      cardEl.className = `shop-card ${isSelected ? 'selected' : ''} ${tooExpensive ? 'too-expensive' : ''}`;
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('aria-label', `${card.name} ${card.cost}金币`);

      const tierStars = '\u2605'.repeat(card.tier);
      const tierColor = card.tier === 3 ? 'var(--accent-purple)' : card.tier === 2 ? 'var(--accent-blue)' : 'var(--text-muted)';
      const yields = this.getCardYields(card);

      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-name">${card.icon} ${card.name}</span>
          <span class="card-cost">${card.cost}🪙</span>
        </div>
        <span class="card-tier" style="color:${tierColor}">${tierStars}</span>
        <div class="card-desc">${card.description}</div>
        ${yields ? `<div class="card-yields">产出: ${yields}</div>` : ''}
      `;

      cardEl.addEventListener('click', () => {
        if (!tooExpensive) this.selectShopCard(card);
      });

      wrapper.appendChild(cardEl);
      this.shopCards.appendChild(wrapper);
    }
  }

  private getCardYields(card: IShopCard): string {
    const parts: string[] = [];
    parts.push(yieldsToString(card.terrain.baseYields));
    if (card.feature) {
      const fStr = yieldsToString(card.feature.yieldModifier);
      if (fStr !== '无产出') parts.push(fStr);
    }
    if (card.resource) parts.push(yieldsToString(card.resource.yieldBonus));
    return parts.filter(p => p && p !== '无产出').join(' + ') || '';
  }

  private updateTileInfo(coord: HexCoord): void {
    const tile = this.engine.getTileAt(coord);
    if (!tile) {
      this.tileInfo.innerHTML = '';
      return;
    }

    const isSelected =
      this.selectedTileCoord !== null &&
      this.selectedTileCoord.q === coord.q &&
      this.selectedTileCoord.r === coord.r;

    // ---- 未解锁 ----
    if (!tile.unlocked) {
      const cost = this.engine.getHexUnlockCost(coord);
      const state = this.engine.getState();
      const canAfford = state.storedGold >= cost;

      let html = `
        <div class="info-row"><span class="info-label">状态</span><span class="info-value">🔒 未解锁 (${tile.ring}环)</span></div>
        <div style="color: var(--text-muted); margin-top: 8px; font-size: 12px">人口增长后自动解锁</div>
      `;

      if (isSelected && cost < Infinity) {
        html += `
          <div class="info-section">
            <button class="build-action-btn unlock-btn" data-action="unlock-hex" data-q="${coord.q}" data-r="${coord.r}" ${canAfford ? '' : 'disabled'}>
              🔓 金币解锁 ${cost}🪙
            </button>
          </div>
        `;
      }

      this.tileInfo.innerHTML = html;
      return;
    }

    // ---- 空地 ----
    if (!tile.terrain) {
      this.tileInfo.innerHTML = `
        <div class="info-row"><span class="info-label">状态</span><span class="info-value">空地 (${tile.ring}环)</span></div>
        <div style="color: var(--text-muted); margin-top: 8px; font-size: 12px">购买地形卡牌放置在此</div>
      `;
      return;
    }

    const state = this.engine.getState();
    const yields = this.engine.getTileYields(coord);
    const available = this.engine.getAvailableWorkers();

    // ---- 基础信息 ----
    let html = `
      <div class="info-row">
        <span class="info-label">地形</span>
        <span class="info-value">${tile.terrain.icon} ${tile.terrain.name}</span>
      </div>
    `;

    if (tile.feature) {
      html += `<div class="info-row"><span class="info-label">地貌</span><span class="info-value">${tile.feature.icon} ${tile.feature.name}</span></div>`;
    }
    if (tile.resource) {
      html += `<div class="info-row"><span class="info-label">资源</span><span class="info-value">${tile.resource.icon} ${tile.resource.name}</span></div>`;
    }
    if (tile.improvement) {
      html += `<div class="info-row"><span class="info-label">改良</span><span class="info-value">${tile.improvement.icon} ${tile.improvement.name} Lv${tile.improvementLevel}</span></div>`;
    }
    if (tile.district) {
      html += `<div class="info-row"><span class="info-label">区域</span><span class="info-value">${tile.district.icon} ${tile.district.name} Lv${tile.districtLevel}</span></div>`;
    }

    // ---- 产出 ----
    const itemBonus = this.engine.getItemBonusForTile(coord);
    const hasItemBonus = Object.values(itemBonus).some(v => v !== 0);
    const effectiveYields = hasItemBonus ? addYields(yields, itemBonus) : yields;

    html += `<div class="info-section">`;
    if (hasItemBonus && tile.isWorked) {
      html += `
        <div class="info-row">
          <span class="info-label">基础产出</span>
          <span class="info-value">${yieldsToString(yields)}</span>
        </div>
        <div class="info-row" style="color:var(--accent-purple)">
          <span class="info-label">📦 道具加成</span>
          <span class="info-value">+${yieldsToString(itemBonus)}</span>
        </div>
        <div class="info-row" style="font-weight:bold">
          <span class="info-label">总产出</span>
          <span class="info-value">${yieldsToString(effectiveYields)}</span>
        </div>
      `;
    } else {
      html += `
        <div class="info-row">
          <span class="info-label">${tile.isWorked ? '产出' : '潜在产出'}</span>
          <span class="info-value">${yieldsToString(yields)}</span>
        </div>
      `;
    }
    html += `</div>`;

    // ---- 邻接加成 ----
    const adjacencyRules = [
      ...(tile.improvement?.adjacencyRules || []),
      ...(tile.district?.adjacencyRules || []),
    ];
    if (adjacencyRules.length > 0) {
      html += '<div class="info-section"><div class="info-label" style="margin-bottom:4px">邻接加成:</div>';
      const neighbors = getNeighborTiles(state.board, coord);
      for (const rule of adjacencyRules) {
        const bonus = calculateAdjacencyBonus(rule, neighbors);
        const bonusStr = yieldsToString(bonus);
        html += `<div class="adjacency-rule">${rule.description} → ${bonusStr !== '无产出' ? bonusStr : '无'}</div>`;
      }
      html += '</div>';
    }

    // ---- 投资信息 ----
    if (isSelected && (tile.goldInvested > 0 || tile.productionInvested > 0)) {
      const ratio = this.engine.getConfig().sellRefundRatio;
      const goldRefund = Math.floor(tile.goldInvested * ratio);
      const prodRefund = Math.floor(tile.productionInvested * ratio);
      html += `
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">已投入</span>
            <span class="info-value">${tile.goldInvested > 0 ? tile.goldInvested + '🪙' : ''} ${tile.productionInvested > 0 ? tile.productionInvested + '⚙️' : ''}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">出售可返还 ${goldRefund}🪙 ${prodRefund}⚙️ (${Math.round(ratio * 100)}%)</div>
        </div>
      `;
    }

    // ---- 操作区域（选中时才显示按钮） ----
    if (tile.terrain.id === 'city_center') {
      html += `<div class="info-section"><div class="info-row"><span class="info-label">状态</span><span class="info-value" style="color:var(--accent-green)">🏛️ 主城（免费工作）</span></div></div>`;
    } else if (isSelected) {
      // ---- 二次确认区域 ----
      if (
        this.pendingConfirm &&
        this.pendingConfirm.coord.q === coord.q &&
        this.pendingConfirm.coord.r === coord.r
      ) {
        html += `
          <div class="info-section confirm-section">
            <div style="color:var(--accent-orange);margin-bottom:8px;font-size:13px">⚠️ ${this.pendingConfirm.description}</div>
            <div class="confirm-btns">
              <button class="build-action-btn" data-action="confirm-action" style="border-color:var(--accent-orange);color:var(--accent-orange);text-align:center">确认</button>
              <button class="build-action-btn" data-action="cancel-action" style="border-color:var(--text-muted);text-align:center">取消</button>
            </div>
          </div>
        `;
        this.tileInfo.innerHTML = html;
        return;
      }

      // 工人管理
      html += '<div class="info-section">';
      if (tile.isWorked) {
        html += `
          <div class="info-row" style="margin-bottom:4px">
            <span class="info-label">状态</span>
            <span class="info-value" style="color:var(--accent-green)">👷 工作中</span>
          </div>
          <button class="build-action-btn worker-btn" data-action="unassign-worker">撤回工人</button>
        `;
      } else {
        html += `
          <div class="info-row" style="margin-bottom:4px">
            <span class="info-label">状态</span>
            <span class="info-value" style="color:var(--accent-orange)">💤 空闲</span>
          </div>
          <button class="build-action-btn worker-btn" data-action="assign-worker" ${available > 0 ? '' : 'disabled'}>
            ${available > 0 ? '分配工人' : '无空闲工人'}
          </button>
        `;
      }
      html += '</div>';

      // 改良升级 (几何费用, 递减边际)
      if (tile.improvement) {
        const upgCost = this.engine.getImprovementUpgradeCost(tile.improvementLevel);
        const delta = upgradeMarginalYield(tile.improvementLevel + 1);
        const canUpgrade = state.storedProduction >= upgCost;
        html += `
          <div class="info-section">
            <button class="build-action-btn upgrade-btn" data-action="upgrade-improvement" ${canUpgrade ? '' : 'disabled'}>
              <span>⬆️ 升级至 Lv${tile.improvementLevel + 1} <small style="color:var(--accent-green)">(+${delta})</small></span>
              <span style="color:var(--accent-orange)">${upgCost}⚙️</span>
            </button>
          </div>
        `;
      }

      // 区域升级 (几何费用, 递减边际)
      if (tile.district) {
        const upgCost = this.engine.getDistrictLevelUpCost(tile.districtLevel);
        const delta = upgradeMarginalYield(tile.districtLevel + 1);
        const canUpgrade = state.storedProduction >= upgCost;
        html += `
          <div class="info-section">
            <button class="build-action-btn upgrade-btn" data-action="upgrade-improvement" ${canUpgrade ? '' : 'disabled'}>
              <span>⬆️ ${tile.district.icon} 升级至 Lv${tile.districtLevel + 1} <small style="color:var(--accent-green)">(+${delta})</small></span>
              <span style="color:var(--accent-orange)">${upgCost}⚙️</span>
            </button>
          </div>
        `;
      }

      // 建造选项
      const availableImps = this.engine.getAvailableImprovements(coord);
      const availableDists = this.engine.getAvailableDistricts(coord);
      const filteredImps = availableImps.filter(imp => tile.improvement?.id !== imp.id);

      if (filteredImps.length > 0 || availableDists.length > 0) {
        html += '<div class="info-section"><div class="info-label" style="margin-bottom:6px">🔨 建造</div>';

        for (const imp of filteredImps) {
          const canBuild = state.storedProduction >= imp.productionCost;
          const preview = this.calcBuildPreview(coord, imp.yields, imp.adjacencyRules);
          html += this.renderBuildOption({
            action: 'build-improvement', id: imp.id,
            typeBadge: '改良', badgeClass: 'imp-badge',
            icon: imp.icon, name: imp.name,
            cost: imp.productionCost, canBuild,
            baseYields: imp.yields, preview,
            hint: imp.terrainHint,
          });
        }

        for (const dist of availableDists) {
          const canBuild = state.storedProduction >= dist.productionCost;
          const preview = this.calcBuildPreview(coord, dist.baseYields, dist.adjacencyRules);
          html += this.renderBuildOption({
            action: 'build-district', id: dist.id,
            typeBadge: '区域', badgeClass: 'dist-badge',
            icon: dist.icon, name: dist.name,
            cost: dist.productionCost, canBuild,
            baseYields: dist.baseYields, preview,
          });
        }

        html += '</div>';
      }

      // 出售按钮
      html += `
        <div class="info-section">
          <button class="build-action-btn sell-btn" data-action="sell-tile">
            <span>💰 出售地块</span>
            <span>${Math.floor(tile.goldInvested * this.engine.getConfig().sellRefundRatio)}🪙 ${Math.floor(tile.productionInvested * this.engine.getConfig().sellRefundRatio)}⚙️</span>
          </button>
        </div>
      `;
    } else {
      const statusStr = tile.isWorked
        ? '<span style="color:var(--accent-green)">👷 工作中</span>'
        : '<span style="color:var(--accent-orange)">💤 空闲</span>';
      html += `
        <div class="info-section">
          <div class="info-row"><span class="info-label">状态</span><span class="info-value">${statusStr}</span></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">点击地块进行操作</div>
        </div>
      `;
    }

    this.tileInfo.innerHTML = html;
  }

  // -------- 建造预览计算 --------

  private calcBuildPreview(
    coord: HexCoord,
    baseYields: IYields,
    adjacencyRules: IAdjacencyRule[]
  ): { total: IYields; adjTotal: IYields; ruleDetails: { desc: string; bonusStr: string; matchCount: number }[] } {
    const state = this.engine.getState();
    const neighbors = getNeighborTiles(state.board, coord);

    let adjTotal = emptyYields();
    const ruleDetails: { desc: string; bonusStr: string; matchCount: number }[] = [];

    for (const rule of adjacencyRules) {
      const bonus = calculateAdjacencyBonus(rule, neighbors);
      adjTotal = addYields(adjTotal, bonus);
      const matchCount = neighbors.filter(n => tileHasTag(n, rule.matchTag)).length;
      const bonusStr = yieldsToString(bonus);
      ruleDetails.push({
        desc: rule.description,
        bonusStr: bonusStr !== '无产出' ? '+' + bonusStr : '无',
        matchCount,
      });
    }

    return { total: addYields(baseYields, adjTotal), adjTotal, ruleDetails };
  }

  private renderBuildOption(opt: {
    action: string;
    id: string;
    typeBadge: string;
    badgeClass: string;
    icon: string;
    name: string;
    cost: number;
    canBuild: boolean;
    baseYields: IYields;
    preview: ReturnType<UIManager['calcBuildPreview']>;
    hint?: string;
  }): string {
    const baseStr = yieldsToString(opt.baseYields);
    const adjStr = yieldsToString(opt.preview.adjTotal);
    const totalStr = yieldsToString(opt.preview.total);
    const hasAdj = adjStr !== '无产出';

    let previewLine = `+${baseStr}`;
    if (hasAdj) {
      previewLine += ` <span style="color:var(--accent-blue)">+${adjStr}(邻)</span>`;
    }

    let detailHtml = `<div class="detail-row">基础产出: ${baseStr}</div>`;
    for (const rd of opt.preview.ruleDetails) {
      const countColor = rd.matchCount > 0 ? 'var(--accent-green)' : 'var(--text-muted)';
      detailHtml += `<div class="detail-row">${rd.desc} → <span style="color:${countColor}">${rd.bonusStr}</span> <span style="color:var(--text-muted)">(${rd.matchCount}个匹配)</span></div>`;
    }
    detailHtml += `<div class="detail-row detail-total">总计: ${totalStr}</div>`;

    return `
      <button class="build-action-btn" data-action="${opt.action}" data-id="${opt.id}" ${opt.canBuild ? '' : 'disabled'}>
        <div class="build-option-main">
          <div class="build-option-left">
            <span class="build-type-badge ${opt.badgeClass}">${opt.typeBadge}</span>
            <span>${opt.icon} ${opt.name}</span>
          </div>
          <span class="build-cost">${opt.cost}⚙️</span>
        </div>
        <div class="build-option-yields">${previewLine}</div>
        ${opt.hint ? `<div class="terrain-hint">${opt.hint}</div>` : ''}
        <div class="build-option-detail">${detailHtml}</div>
      </button>
    `;
  }

  // -------- 游戏结束 --------

  private showGameOver(): void {
    const score = this.engine.getFinalScore();
    const state = this.engine.getState();

    this.gameOverContent.innerHTML = `
      <h2>游戏结束</h2>
      <div class="score-breakdown">
        <div class="score-row"><span>👥 最终人口</span><span>${state.population}</span></div>
        <div class="score-row"><span>🏪 商店等级</span><span>Lv.${state.shopLevel}</span></div>
        <div class="score-row"><span>📦 道具</span><span>${state.items.length}个</span></div>
        <div class="score-row"><span>🔬 科技（剩余）</span><span>${score.science}</span></div>
        <div class="score-row"><span>🎭 文化</span><span>${score.culture}</span></div>
        <div class="score-row"><span>🙏 信仰</span><span>${score.faith}</span></div>
        <div class="score-row total"><span>总得分</span><span>${score.total}</span></div>
      </div>
      <button class="action-btn primary" id="btn-restart" style="font-size:16px;padding:10px 32px;">再来一局</button>
    `;

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.selectedTileCoord = null;
      this.pendingConfirm = null;
      this.renderer.setSelectedHex(null);
      GameEngine.clearSave();
      const config = loadConfig();
      this.engine.startNewGame(config);
      this.gameOverOverlay.classList.remove('visible');
    });

    this.gameOverOverlay.classList.add('visible');
  }

  // -------- Toast --------

  showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('visible');
      this.toastTimer = null;
    }, 2000);
  }
}
