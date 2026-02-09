/**
 * UI 管理器
 * 负责所有 DOM UI 的更新和事件绑定
 * 与 Canvas 渲染器协作
 */

import type { HexCoord, IShopCard, IYields } from '../core/types';
import { yieldColor, yieldIcon, yieldsToString } from '../core/yields';
import { calculateAdjacencyBonus, getNeighborTiles } from '../game/board';
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

  constructor(engine: GameEngine, renderer: HexRenderer) {
    this.engine = engine;
    this.renderer = renderer;
    this.cacheElements();
    this.bindActions();
    this.bindRendererCallbacks();
    this.bindEngineEvents();
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
      this.engine.startNewGame();
      this.gameOverOverlay.classList.remove('visible');
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

    // 1. 放置模式：放置选中的卡牌
    if (state.phase === 'placing' && state.selectedCard) {
      const success = this.engine.placeCard(coord);
      if (success) {
        this.renderer.clearValidPlacements();
        this.showToast('放置成功！');
      } else {
        this.showToast('无法放置在此位置');
      }
      return;
    }

    // 2. 普通模式：工人调配 / 升级
    const tile = this.engine.getTileAt(coord);
    if (!tile || !tile.terrain) return;
    if (tile.terrain.id === 'city_center') return;

    if (tile.isWorked) {
      // 已工作 → 取消分配
      if (this.engine.unassignWorker(coord)) {
        this.showToast('工人已撤回');
        this.updateTileInfo(coord);
      }
    } else {
      // 未工作 → 尝试分配
      if (this.engine.getAvailableWorkers() > 0) {
        if (this.engine.assignWorker(coord)) {
          this.showToast('工人已分配');
          this.updateTileInfo(coord);
        }
      } else {
        this.showToast('没有空闲工人，先从其他地块撤回');
      }
    }
  }

  private handleHexHover(coord: HexCoord | null): void {
    if (coord) {
      this.updateTileInfo(coord);
    } else {
      this.tileInfo.innerHTML = '<div style="color: var(--text-muted)">将鼠标移到地块上查看详情</div>';
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
    this.renderer.draw();
  }

  private updateHUD(): void {
    const state = this.engine.getState();
    const yields = state.perTurnYields;
    const available = this.engine.getAvailableWorkers();
    const threshold = this.engine.getGrowthThreshold();

    // 回合 + 人口
    this.hudTurn.innerHTML = `
      <div>回合 ${state.turn}/${state.maxTurns}</div>
      <div style="font-size:13px;color:var(--text-secondary)">
        👥 人口 ${state.population}
        <span style="color:${available > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}">
          (${available > 0 ? available + ' 空闲' : '已满'})
        </span>
      </div>
    `;

    // 产出
    const netFoodStr = state.perTurnNetFood >= 0
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
      ${this.yieldHtml('science', state.accumulatedScience, yields.science)}
      ${this.yieldHtml('culture', state.accumulatedCulture, yields.culture)}
      ${this.yieldHtml('faith', state.accumulatedFaith, yields.faith)}
    `;

    // 得分
    const score = this.engine.getFinalScore();
    this.hudScore.innerHTML = `得分 <span class="score-value">${score.total}</span>`;

    // 按钮状态
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

    if (state.phase === 'game_over') {
      this.shopCards.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">游戏结束</div>';
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

      const typeLabel = card.type === 'terrain' ? '地形' : card.type === 'improvement' ? '改良' : '区域';
      const yields = this.getCardYields(card);

      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-name">${card.icon} ${card.name}</span>
          <span class="card-cost">${card.cost}🪙</span>
        </div>
        <span class="card-type">${typeLabel}</span>
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
    if (card.terrain) parts.push(yieldsToString(card.terrain.baseYields));
    if (card.feature) {
      const fStr = yieldsToString(card.feature.yieldModifier);
      if (fStr !== '无产出') parts.push(fStr);
    }
    if (card.resource) parts.push(yieldsToString(card.resource.yieldBonus));
    if (card.improvement) parts.push(yieldsToString(card.improvement.yields));
    if (card.district) parts.push(yieldsToString(card.district.baseYields));
    return parts.filter(p => p && p !== '无产出').join(' + ') || '';
  }

  private updateTileInfo(coord: HexCoord): void {
    const tile = this.engine.getTileAt(coord);
    if (!tile) { this.tileInfo.innerHTML = ''; return; }

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

    const yields = this.engine.getTileYields(coord);
    const available = this.engine.getAvailableWorkers();

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
      if (tile.improvementLevel < tile.improvement.maxLevel) {
        const cost = this.engine.getProductionPerUpgrade();
        const canUpgrade = this.engine.getState().storedProduction >= cost;
        html += `<div style="margin-top:4px;font-size:12px;color:${canUpgrade ? 'var(--accent-green)' : 'var(--text-muted)'}">升级: ${cost}⚙️ ${canUpgrade ? '(可升级)' : ''}</div>`;
      }
    }
    if (tile.district) {
      html += `<div class="info-row"><span class="info-label">区域</span><span class="info-value">${tile.district.icon} ${tile.district.name}</span></div>`;
    }

    // 工作状态
    if (tile.terrain.id === 'city_center') {
      html += `<div class="info-section"><div class="info-row"><span class="info-label">状态</span><span class="info-value" style="color:var(--accent-green)">🏛️ 主城（免费工作）</span></div></div>`;
    } else if (tile.isWorked) {
      html += `<div class="info-section"><div class="info-row"><span class="info-label">状态</span><span class="info-value" style="color:var(--accent-green)">👷 工作中</span></div><div style="font-size:12px;color:var(--text-secondary);margin-top:2px">点击地块可撤回工人</div></div>`;
    } else {
      const canAssign = available > 0;
      html += `<div class="info-section"><div class="info-row"><span class="info-label">状态</span><span class="info-value" style="color:var(--accent-orange)">💤 空闲</span></div><div style="font-size:12px;color:${canAssign ? 'var(--accent-green)' : 'var(--text-muted)'};margin-top:2px">${canAssign ? '点击地块分配工人' : '无空闲工人'}</div></div>`;
    }

    // 产出（工作中才实际产出，空闲显示潜在产出）
    html += `
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">${tile.isWorked ? '产出' : '潜在产出'}</span>
          <span class="info-value">${yieldsToString(yields)}</span>
        </div>
      </div>
    `;

    // 邻接规则
    const adjacencyRules = [
      ...(tile.improvement?.adjacencyRules || []),
      ...(tile.district?.adjacencyRules || []),
    ];
    if (adjacencyRules.length > 0) {
      html += '<div class="info-section"><div class="info-label" style="margin-bottom:4px">邻接加成:</div>';
      const neighbors = getNeighborTiles(this.engine.getState().board, coord);
      for (const rule of adjacencyRules) {
        const bonus = calculateAdjacencyBonus(rule, neighbors);
        const bonusStr = yieldsToString(bonus);
        html += `<div class="adjacency-rule">${rule.description} → ${bonusStr !== '无产出' ? bonusStr : '无'}</div>`;
      }
      html += '</div>';
    }

    this.tileInfo.innerHTML = html;
  }

  // -------- 游戏结束 --------

  private showGameOver(): void {
    const score = this.engine.getFinalScore();
    const state = this.engine.getState();

    this.gameOverContent.innerHTML = `
      <h2>游戏结束</h2>
      <div class="score-breakdown">
        <div class="score-row"><span>👥 最终人口</span><span>${state.population}</span></div>
        <div class="score-row"><span>🔬 科技</span><span>${score.science}</span></div>
        <div class="score-row"><span>🎭 文化</span><span>${score.culture}</span></div>
        <div class="score-row"><span>⛪ 信仰</span><span>${score.faith}</span></div>
        <div class="score-row total"><span>总得分</span><span>${score.total}</span></div>
      </div>
      <button class="action-btn primary" id="btn-restart" style="font-size:16px;padding:10px 32px;">再来一局</button>
    `;

    document.getElementById('btn-restart')?.addEventListener('click', () => {
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
