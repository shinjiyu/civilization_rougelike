/**
 * UI 管理器
 * 负责所有 DOM UI 的更新和事件绑定
 * 与 Canvas 渲染器协作
 */

import type { HexCoord, IAdjacencyRule, IShopCard, IYields } from '../core/types';
import { addYields, emptyYields, yieldColor, yieldIcon, yieldsToString } from '../core/yields';
import { calculateAdjacencyBonus, getNeighborTiles, tileHasTag } from '../game/board';
import type { GameEngine } from '../game/engine';
import type { HexRenderer } from './hex-renderer';

export class UIManager {
  private engine: GameEngine;
  private renderer: HexRenderer;

  private hudTurn!: HTMLElement;
  private hudYields!: HTMLElement;
  private hudScore!: HTMLElement;
  private shopCards!: HTMLElement;
  private tileInfo!: HTMLElement;
  private gameOverOverlay!: HTMLElement;
  private gameOverContent!: HTMLElement;
  private toast!: HTMLElement;

  private toastTimer: number | null = null;
  /** 当前选中的地块坐标（null 表示无选中） */
  private selectedTileCoord: HexCoord | null = null;

  constructor(engine: GameEngine, renderer: HexRenderer) {
    this.engine = engine;
    this.renderer = renderer;
    this.cacheElements();
    this.bindActions();
    this.bindRendererCallbacks();
    this.bindEngineEvents();
    this.bindInfoPanelActions();
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
    });
    document.getElementById('btn-reroll')!.addEventListener('click', () => {
      if (!this.engine.rerollShop()) {
        this.showToast('金币不足，无法刷新商店');
      }
    });
    document.getElementById('btn-new-game')!.addEventListener('click', () => {
      this.selectedTileCoord = null;
      this.renderer.setSelectedHex(null);
      this.engine.startNewGame();
      this.gameOverOverlay.classList.remove('visible');
    });

    // 商店升级按钮（事件委托，因为按钮动态渲染）
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
      if (!btn || !this.selectedTileCoord) return;

      const action = btn.dataset.action!;
      const coord = this.selectedTileCoord;

      switch (action) {
        case 'assign-worker':
          if (this.engine.assignWorker(coord)) this.showToast('工人已分配');
          else this.showToast('无法分配工人');
          break;
        case 'unassign-worker':
          if (this.engine.unassignWorker(coord)) this.showToast('工人已撤回');
          else this.showToast('无法撤回');
          break;
        case 'build-improvement': {
          const impId = btn.dataset.id!;
          if (this.engine.buildImprovement(coord, impId)) this.showToast('建造成功！');
          else this.showToast('生产力不足');
          break;
        }
        case 'build-district': {
          const distId = btn.dataset.id!;
          if (this.engine.buildDistrict(coord, distId)) this.showToast('建造成功！');
          else this.showToast('生产力不足');
          break;
        }
        case 'upgrade-improvement':
          if (this.engine.upgradeTile(coord)) this.showToast('升级成功！');
          else this.showToast('生产力不足');
          break;
      }
      // engine 的操作会 emit state_changed → updateAll → 自动刷新
    });
  }

  private bindRendererCallbacks(): void {
    this.renderer.onHexClick = (coord) => this.handleHexClick(coord);
    this.renderer.onHexHover = (coord) => this.handleHexHover(coord);
  }

  private bindEngineEvents(): void {
    this.engine.on((event) => {
      switch (event) {
        case 'state_changed':
          this.updateAll();
          break;
        case 'game_over':
          this.showGameOver();
          break;
      }
    });
  }

  // -------- 事件处理 --------

  private handleHexClick(coord: HexCoord): void {
    const state = this.engine.getState();

    // 1. 放置模式：放置卡牌
    if (state.phase === 'placing' && state.selectedCard) {
      const success = this.engine.placeCard(coord);
      if (success) {
        this.renderer.clearValidPlacements();
        this.selectedTileCoord = coord;
        this.renderer.setSelectedHex(coord);
        this.showToast('放置成功！');
      } else {
        this.showToast('无法放置在此位置');
      }
      return;
    }

    // 2. 选中/取消选中地块
    if (
      this.selectedTileCoord &&
      this.selectedTileCoord.q === coord.q &&
      this.selectedTileCoord.r === coord.r
    ) {
      this.selectedTileCoord = null;
      this.renderer.setSelectedHex(null);
      this.tileInfo.innerHTML =
        '<div style="color: var(--text-muted)">点击地块查看详情和操作</div>';
    } else {
      this.selectedTileCoord = coord;
      this.renderer.setSelectedHex(coord);
      this.updateTileInfo(coord);
    }
  }

  private handleHexHover(coord: HexCoord | null): void {
    // 有选中地块时，信息面板不跟随鼠标
    if (this.selectedTileCoord) return;

    if (coord) {
      this.updateTileInfo(coord);
    } else {
      this.tileInfo.innerHTML =
        '<div style="color: var(--text-muted)">点击地块查看详情和操作</div>';
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
      // 选择卡牌时清除地块选中状态
      this.selectedTileCoord = null;
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
      rerollBtn.disabled =
        state.storedGold < this.engine.getRerollCost() || state.phase === 'game_over';
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

    // 商店等级 + 升级按钮
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
      this.shopCards.innerHTML =
        '<div style="color: var(--text-muted); padding: 20px; text-align: center;">游戏结束</div>';
      return;
    }

    this.shopCards.innerHTML = '';

    for (const card of state.shopCards) {
      const isSelected = state.selectedCard?.instanceId === card.instanceId;
      const tooExpensive = state.storedGold < card.cost;

      const cardEl = document.createElement('div');
      cardEl.className = `shop-card ${isSelected ? 'selected' : ''} ${tooExpensive ? 'too-expensive' : ''}`;
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');
      cardEl.setAttribute('aria-label', `${card.name} ${card.cost}金币`);

      const tierStars = '\u2605'.repeat(card.tier);
      const tierColor =
        card.tier === 3
          ? 'var(--accent-purple)'
          : card.tier === 2
            ? 'var(--accent-blue)'
            : 'var(--text-muted)';
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

      this.shopCards.appendChild(cardEl);
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

    if (!tile.unlocked) {
      this.tileInfo.innerHTML = `
        <div class="info-row"><span class="info-label">状态</span><span class="info-value">🔒 未解锁</span></div>
        <div style="color: var(--text-muted); margin-top: 8px; font-size: 12px">人口增长后自动解锁</div>
      `;
      return;
    }

    if (!tile.terrain) {
      this.tileInfo.innerHTML = `
        <div class="info-row"><span class="info-label">状态</span><span class="info-value">空地</span></div>
        <div style="color: var(--text-muted); margin-top: 8px; font-size: 12px">购买地形卡牌放置在此</div>
      `;
      return;
    }

    const state = this.engine.getState();
    const yields = this.engine.getTileYields(coord);
    const available = this.engine.getAvailableWorkers();
    const isSelected =
      this.selectedTileCoord !== null &&
      this.selectedTileCoord.q === coord.q &&
      this.selectedTileCoord.r === coord.r;

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
      html += `<div class="info-row"><span class="info-label">区域</span><span class="info-value">${tile.district.icon} ${tile.district.name}</span></div>`;
    }

    // ---- 产出 ----
    html += `
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">${tile.isWorked ? '产出' : '潜在产出'}</span>
          <span class="info-value">${yieldsToString(yields)}</span>
        </div>
      </div>
    `;

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

    // ---- 操作区域（选中时才显示按钮） ----
    if (tile.terrain.id === 'city_center') {
      html += `<div class="info-section"><div class="info-row"><span class="info-label">状态</span><span class="info-value" style="color:var(--accent-green)">🏛️ 主城（免费工作）</span></div></div>`;
    } else if (isSelected) {
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

      // 改良升级
      if (tile.improvement && tile.improvementLevel < tile.improvement.maxLevel) {
        const upgCost = this.engine.getProductionPerUpgrade();
        const canUpgrade = state.storedProduction >= upgCost;
        html += `
          <div class="info-section">
            <button class="build-action-btn upgrade-btn" data-action="upgrade-improvement" ${canUpgrade ? '' : 'disabled'}>
              <span>⬆️ 升级至 Lv${tile.improvementLevel + 1}</span>
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
            action: 'build-improvement',
            id: imp.id,
            typeBadge: '改良',
            badgeClass: 'imp-badge',
            icon: imp.icon,
            name: imp.name,
            cost: imp.productionCost,
            canBuild,
            baseYields: imp.yields,
            preview,
          });
        }

        for (const dist of availableDists) {
          const canBuild = state.storedProduction >= dist.productionCost;
          const preview = this.calcBuildPreview(coord, dist.baseYields, dist.adjacencyRules);
          html += this.renderBuildOption({
            action: 'build-district',
            id: dist.id,
            typeBadge: '区域',
            badgeClass: 'dist-badge',
            icon: dist.icon,
            name: dist.name,
            cost: dist.productionCost,
            canBuild,
            baseYields: dist.baseYields,
            preview,
          });
        }

        html += '</div>';
      }
    } else {
      // 未选中：简单状态提示
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

  /** 计算在指定位置建造时的收益预览 */
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

  /** 渲染单个建造选项按钮 */
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
  }): string {
    const baseStr = yieldsToString(opt.baseYields);
    const adjStr = yieldsToString(opt.preview.adjTotal);
    const totalStr = yieldsToString(opt.preview.total);
    const hasAdj = adjStr !== '无产出';

    // 紧凑预览行
    let previewLine = `+${baseStr}`;
    if (hasAdj) {
      previewLine += ` <span style="color:var(--accent-blue)">+${adjStr}(邻)</span>`;
    }

    // hover 详情
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
        <div class="score-row"><span>🔬 科技（剩余）</span><span>${score.science}</span></div>
        <div class="score-row"><span>🎭 文化</span><span>${score.culture}</span></div>
        <div class="score-row"><span>⛪ 信仰</span><span>${score.faith}</span></div>
        <div class="score-row total"><span>总得分</span><span>${score.total}</span></div>
      </div>
      <button class="action-btn primary" id="btn-restart" style="font-size:16px;padding:10px 32px;">再来一局</button>
    `;

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.selectedTileCoord = null;
      this.renderer.setSelectedHex(null);
      this.engine.startNewGame();
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
