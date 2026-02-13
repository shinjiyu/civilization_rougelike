/**
 * 六角棋盘 Canvas 2D 渲染器
 * 负责绘制棋盘、处理鼠标/触摸事件
 * 支持响应式 hex 尺寸，4环棋盘
 * 实现 IHexRenderer 接口，可与 3D 渲染器切换
 */

import { hexCorners, hexKey, hexNeighbors, hexToPixel, pixelToHex } from '../core/hex';
import type { HexCoord, ITile, IYields } from '../core/types';
import { getTile } from '../game/board';
import type { GameEngine } from '../game/engine';

/** 桌面端最大 hex 尺寸 */
const MAX_HEX_SIZE = 40;
/** 最小可用 hex 尺寸 */
const MIN_HEX_SIZE = 20;

export class HexRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;

  private offsetX = 0;
  private offsetY = 0;
  /** 当前计算的 hex 尺寸（响应式） */
  private hexSize = MAX_HEX_SIZE;

  private hoveredHex: HexCoord | null = null;
  private selectedHex: HexCoord | null = null;
  private validPlacements: Set<string> = new Set();
  private yieldLabelsVisible = true;

  onHexClick: ((coord: HexCoord) => void) | null = null;
  onHexHover: ((coord: HexCoord | null) => void) | null = null;

  private resizeHandler: () => void;

  private initialized = false;

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
    this.resizeHandler = () => {
      if (this.canvas.offsetParent !== null) {
        this.setupCanvas();
        this.draw();
      }
    };
    this.bindEvents();
  }

  /** 确保 canvas 已经初始化（需要在可见时调用） */
  private ensureInit(): void {
    if (this.initialized) return;
    this.setupCanvas();
    this.initialized = true;
  }

  private setupCanvas(): void {
    const container = this.canvas.parentElement!;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.offsetX = rect.width / 2;
    this.offsetY = rect.height / 2;

    // 4环 hex 网格: 宽约 16*hexSize, 高约 14*hexSize
    // 取两个维度各自能容纳的 hexSize，用较小值
    const hsByWidth = rect.width / 16;
    const hsByHeight = rect.height / 14;
    this.hexSize = Math.min(MAX_HEX_SIZE, Math.max(MIN_HEX_SIZE, Math.floor(Math.min(hsByWidth, hsByHeight))));
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredHex = null;
      this.onHexHover?.(null);
      this.draw();
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const coord = this.getCoordFromClientXY(touch.clientX, touch.clientY);
      const tile = this.engine.getTileAt(coord);
      if (tile) {
        this.hoveredHex = coord;
        this.onHexHover?.(coord);
        this.onHexClick?.(coord);
        this.draw();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', this.resizeHandler);
  }

  /** 检测是否处于竖屏强制横屏旋转模式 */
  private readonly _portraitMQ = window.matchMedia('(max-width: 768px) and (orientation: portrait)');

  private getCoordFromClientXY(clientX: number, clientY: number): HexCoord {
    const rect = this.canvas.getBoundingClientRect();

    let mx: number;
    let my: number;

    if (this._portraitMQ.matches) {
      // CSS 对 #app 施加了 rotate(90deg) (顺时针)
      // 屏幕坐标 → 画布内部坐标:
      //   画布 X = (clientY - rect.top) / rect.height * 画布逻辑宽
      //   画布 Y = (1 - (clientX - rect.left) / rect.width) * 画布逻辑高
      const w = this.canvas.width / (window.devicePixelRatio || 1);
      const h = this.canvas.height / (window.devicePixelRatio || 1);
      const fx = (clientY - rect.top) / rect.height;
      const fy = 1 - (clientX - rect.left) / rect.width;
      mx = fx * w - this.offsetX;
      my = fy * h - this.offsetY;
    } else {
      mx = clientX - rect.left - this.offsetX;
      my = clientY - rect.top - this.offsetY;
    }

    return pixelToHex(mx, my, this.hexSize);
  }

  private handleMouseMove(e: MouseEvent): void {
    const coord = this.getCoordFromClientXY(e.clientX, e.clientY);
    const key = hexKey(coord);
    if (!this.hoveredHex || hexKey(this.hoveredHex) !== key) {
      const tile = this.engine.getTileAt(coord);
      if (tile) {
        this.hoveredHex = coord;
        this.onHexHover?.(coord);
      } else {
        this.hoveredHex = null;
        this.onHexHover?.(null);
      }
      this.draw();
    }
  }

  private handleClick(e: MouseEvent): void {
    const coord = this.getCoordFromClientXY(e.clientX, e.clientY);
    const tile = this.engine.getTileAt(coord);
    if (tile) {
      this.onHexClick?.(coord);
    }
  }

  setValidPlacements(coords: HexCoord[]): void {
    this.validPlacements = new Set(coords.map(hexKey));
    this.draw();
  }

  clearValidPlacements(): void {
    this.validPlacements.clear();
    this.draw();
  }

  setSelectedHex(coord: HexCoord | null): void {
    this.selectedHex = coord;
    this.draw();
  }

  draw(): void {
    this.ensureInit();
    const { ctx } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // 读取主题色
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColors = isDark
      ? ['#1a2a3a', '#121e2b', '#0f1923']
      : ['#e8e0d0', '#ddd5c2', '#d5ccb8'];

    const grad = ctx.createRadialGradient(this.offsetX, this.offsetY, 0, this.offsetX, this.offsetY, this.hexSize * 10);
    grad.addColorStop(0, bgColors[0]);
    grad.addColorStop(0.7, bgColors[1]);
    grad.addColorStop(1, bgColors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const state = this.engine.getState();

    for (const [, tile] of state.board) {
      this.drawTile(tile);
    }

    for (const key of this.validPlacements) {
      const [q, r] = key.split(',').map(Number);
      this.drawValidPlacementHighlight({ q, r });
    }

    if (this.selectedHex) {
      this.drawSelectedHighlight(this.selectedHex);
    }

    if (this.hoveredHex) {
      this.drawHoverHighlight(this.hoveredHex);
    }
  }

  private drawTile(tile: ITile): void {
    const { ctx } = this;
    const hs = this.hexSize;
    const { x, y } = hexToPixel(tile.coord, hs);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, hs - 1);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // ---- 未解锁 ----
    if (!tile.unlocked) {
      const state = this.engine.getState();
      const neighbors = hexNeighbors(tile.coord);
      const hasUnlockedNeighbor = neighbors.some(n => {
        const nt = getTile(state.board, n);
        return nt && nt.unlocked;
      });

      ctx.fillStyle = hasUnlockedNeighbor
        ? (isDark ? '#1e3348' : '#c8d8e8')
        : (isDark ? '#15222e' : '#d5d0c8');
      ctx.fill();
      ctx.strokeStyle = hasUnlockedNeighbor
        ? (isDark ? '#3a6580' : '#8aaccf')
        : (isDark ? '#2a3d52' : '#b0a898');
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = hasUnlockedNeighbor
        ? (isDark ? '#6aafcf' : '#4888b0')
        : (isDark ? '#405060' : '#a09888');
      ctx.font = `${Math.round(hs * 0.33)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', cx, cy - hs * 0.1);

      if (hasUnlockedNeighbor) {
        const cost = this.engine.getHexUnlockCost(tile.coord);
        if (cost < Infinity) {
          ctx.font = `${Math.max(8, Math.round(hs * 0.22))}px sans-serif`;
          ctx.fillStyle = isDark ? '#8ac0e0' : '#3070a0';
          ctx.fillText(`${cost}🪙`, cx, cy + hs * 0.25);
        }
      }
      return;
    }

    // ---- 空地 ----
    if (!tile.terrain) {
      ctx.fillStyle = isDark ? '#1e3045' : '#d8d0c0';
      ctx.fill();
      ctx.strokeStyle = isDark ? '#3a6890' : '#a0b8d0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isDark ? '#5a8ab0' : '#6080a0';
      ctx.font = `${Math.round(hs * 0.42)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', cx, cy);
      return;
    }

    // ---- 有地形的格子 ----
    let fillColor = tile.terrain.color;
    if (tile.feature?.colorOverlay) {
      fillColor = this.blendColors(tile.terrain.color, tile.feature.colorOverlay, 0.5);
    }

    ctx.fillStyle = fillColor;
    ctx.fill();

    if (!tile.isWorked) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();
    }

    if (tile.isWorked) {
      ctx.strokeStyle = this.lightenColor(fillColor, 0.3);
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = this.darkenColor(fillColor, 0.15);
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // 图标
    let icon = tile.terrain.icon;
    if (tile.resource) icon = tile.resource.icon;
    if (tile.feature && tile.feature.id !== 'hills') icon = tile.feature.icon;
    if (tile.improvement) icon = tile.improvement.icon;
    if (tile.district) icon = tile.district.icon;

    ctx.font = `${Math.round(hs * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy - hs * 0.125);

    // 工作状态标记
    if (tile.terrain.id !== 'city_center') {
      const statusFontSize = Math.round(hs * 0.23);
      if (tile.isWorked) {
        ctx.font = `${statusFontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('👷', cx - hs * 0.52, cy - hs * 0.58);
      } else {
        ctx.font = `${statusFontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#607080';
        ctx.fillText('💤', cx - hs * 0.52, cy - hs * 0.58);
      }
    }

    // 产出概要（只对工作中的地块显示）
    if (tile.isWorked && this.yieldLabelsVisible) {
      const yields = this.engine.getTileEffectiveYields(tile.coord);
      const yieldText = this.formatYieldCompact(yields);
      if (yieldText) {
        const yieldFontSize = Math.max(8, Math.round(hs * 0.22));
        ctx.font = `${yieldFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(yieldText);
        const tw = metrics.width + 6;
        ctx.fillStyle = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.55)';
        ctx.fillRect(cx - tw / 2, cy + hs * 0.19, tw, yieldFontSize + 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(yieldText, cx, cy + hs * 0.19 + (yieldFontSize + 4) / 2);
      }
    }

    // 升级标记
    if (tile.improvement && tile.improvementLevel > 1) {
      ctx.font = `bold ${Math.round(hs * 0.2)}px sans-serif`;
      ctx.fillStyle = '#f0c040';
      ctx.textAlign = 'right';
      ctx.fillText(`Lv${tile.improvementLevel}`, cx + hs * 0.6, cy - hs * 0.4);
    }

    // 环数标记（仅调试用，可注释掉）
    // ctx.font = `${Math.round(hs * 0.18)}px sans-serif`;
    // ctx.fillStyle = '#ffffff40';
    // ctx.textAlign = 'right';
    // ctx.fillText(`R${tile.ring}`, cx + hs * 0.55, cy + hs * 0.5);
  }

  private drawValidPlacementHighlight(coord: HexCoord): void {
    const { ctx } = this;
    const hs = this.hexSize;
    const { x, y } = hexToPixel(coord, hs);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, hs - 1);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(64, 240, 64, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#40f040';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawSelectedHighlight(coord: HexCoord): void {
    const { ctx } = this;
    const hs = this.hexSize;
    const { x, y } = hexToPixel(coord, hs);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, hs);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();

    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawHoverHighlight(coord: HexCoord): void {
    const { ctx } = this;
    const hs = this.hexSize;
    const { x, y } = hexToPixel(coord, hs);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, hs);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  private formatYieldCompact(y: IYields): string {
    const parts: string[] = [];
    if (y.gold) parts.push(`${y.gold}🪙`);
    if (y.food) parts.push(`${y.food}🌾`);
    if (y.production) parts.push(`${y.production}⚙️`);
    if (y.science) parts.push(`${y.science}🔬`);
    if (y.culture) parts.push(`${y.culture}🎭`);
    if (y.faith) parts.push(`${y.faith}🙏`);
    return parts.join(' ');
  }

  private blendColors(c1: string, c2: string, ratio: number): string {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private darkenColor(color: string, amount: number): string {
    const r = Math.max(0, Math.round(parseInt(color.slice(1, 3), 16) * (1 - amount)));
    const g = Math.max(0, Math.round(parseInt(color.slice(3, 5), 16) * (1 - amount)));
    const b = Math.max(0, Math.round(parseInt(color.slice(5, 7), 16) * (1 - amount)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private lightenColor(color: string, amount: number): string {
    const r = Math.min(255, Math.round(parseInt(color.slice(1, 3), 16) + (255 - parseInt(color.slice(1, 3), 16)) * amount));
    const g = Math.min(255, Math.round(parseInt(color.slice(3, 5), 16) + (255 - parseInt(color.slice(3, 5), 16)) * amount));
    const b = Math.min(255, Math.round(parseInt(color.slice(5, 7), 16) + (255 - parseInt(color.slice(5, 7), 16)) * amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ---- IHexRenderer 接口方法 ----

  toggleYieldLabels(): void {
    this.yieldLabelsVisible = !this.yieldLabelsVisible;
    this.draw();
  }

  getYieldLabelsVisible(): boolean {
    return this.yieldLabelsVisible;
  }

  applyThemeColors(): void {
    this.setupCanvas();
    this.draw();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.onHexClick = null;
    this.onHexHover = null;
  }
}
