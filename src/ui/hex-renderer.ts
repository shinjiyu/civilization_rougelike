/**
 * 六角棋盘 Canvas 渲染器
 * 负责绘制棋盘、处理鼠标事件
 */

import { hexCorners, hexKey, hexToPixel, pixelToHex } from '../core/hex';
import type { HexCoord, ITile, IYields } from '../core/types';
import type { GameEngine } from '../game/engine';

const HEX_SIZE = 48;

export class HexRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;

  private offsetX = 0;
  private offsetY = 0;

  private hoveredHex: HexCoord | null = null;
  private validPlacements: Set<string> = new Set();

  onHexClick: ((coord: HexCoord) => void) | null = null;
  onHexHover: ((coord: HexCoord | null) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
    this.setupCanvas();
    this.bindEvents();
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
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredHex = null;
      this.onHexHover?.(null);
      this.draw();
    });
    window.addEventListener('resize', () => {
      this.setupCanvas();
      this.draw();
    });
  }

  private getMouseHex(e: MouseEvent): HexCoord {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - this.offsetX;
    const my = e.clientY - rect.top - this.offsetY;
    return pixelToHex(mx, my, HEX_SIZE);
  }

  private handleMouseMove(e: MouseEvent): void {
    const coord = this.getMouseHex(e);
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
    const coord = this.getMouseHex(e);
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

  draw(): void {
    const { ctx } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const state = this.engine.getState();

    // 绘制所有地块
    for (const [, tile] of state.board) {
      this.drawTile(tile);
    }

    // 有效放置高亮
    for (const key of this.validPlacements) {
      const [q, r] = key.split(',').map(Number);
      this.drawValidPlacementHighlight({ q, r });
    }

    // 悬停高亮
    if (this.hoveredHex) {
      this.drawHoverHighlight(this.hoveredHex);
    }
  }

  private drawTile(tile: ITile): void {
    const { ctx } = this;
    const { x, y } = hexToPixel(tile.coord, HEX_SIZE);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, HEX_SIZE - 1);

    // 画六角形路径
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    // ---- 未解锁 ----
    if (!tile.unlocked) {
      ctx.fillStyle = '#0a0f15';
      ctx.fill();
      ctx.strokeStyle = '#1a2535';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#2a3545';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', cx, cy);
      return;
    }

    // ---- 空地 ----
    if (!tile.terrain) {
      ctx.fillStyle = '#151f2e';
      ctx.fill();
      ctx.strokeStyle = '#2a4060';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#3a5a7a';
      ctx.font = '20px sans-serif';
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

    // 未工作的地块：半透明遮罩使其变暗
    if (!tile.isWorked) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();
    }

    ctx.strokeStyle = this.darkenColor(fillColor, 0.3);
    ctx.lineWidth = tile.isWorked ? 1.5 : 1;
    ctx.stroke();

    // 图标
    let icon = tile.terrain.icon;
    if (tile.resource) icon = tile.resource.icon;
    if (tile.feature && tile.feature.id !== 'hills') icon = tile.feature.icon;
    if (tile.improvement) icon = tile.improvement.icon;
    if (tile.district) icon = tile.district.icon;

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy - 6);

    // 工作状态标记
    if (tile.terrain.id !== 'city_center') {
      if (tile.isWorked) {
        // 工作中：左上角小人图标
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('👷', cx - HEX_SIZE * 0.52, cy - HEX_SIZE * 0.58);
      } else {
        // 空闲：显示 "zzz"
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#607080';
        ctx.fillText('💤', cx - HEX_SIZE * 0.52, cy - HEX_SIZE * 0.58);
      }
    }

    // 产出概要（只对工作中的地块显示）
    if (tile.isWorked) {
      const yields = this.engine.getTileYields(tile.coord);
      const yieldText = this.formatYieldCompact(yields);
      if (yieldText) {
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(yieldText);
        const tw = metrics.width + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cx - tw / 2, cy + 10, tw, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(yieldText, cx, cy + 17);
      }
    }

    // 升级标记
    if (tile.improvement && tile.improvementLevel > 1) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#f0c040';
      ctx.textAlign = 'right';
      ctx.fillText(`Lv${tile.improvementLevel}`, cx + HEX_SIZE * 0.6, cy - HEX_SIZE * 0.4);
    }
  }

  private drawValidPlacementHighlight(coord: HexCoord): void {
    const { ctx } = this;
    const { x, y } = hexToPixel(coord, HEX_SIZE);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, HEX_SIZE - 1);

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

  private drawHoverHighlight(coord: HexCoord): void {
    const { ctx } = this;
    const { x, y } = hexToPixel(coord, HEX_SIZE);
    const cx = x + this.offsetX;
    const cy = y + this.offsetY;
    const corners = hexCorners(cx, cy, HEX_SIZE);

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
    if (y.gold) parts.push(`${y.gold}G`);
    if (y.food) parts.push(`${y.food}F`);
    if (y.production) parts.push(`${y.production}P`);
    if (y.science) parts.push(`${y.science}S`);
    if (y.culture) parts.push(`${y.culture}C`);
    if (y.faith) parts.push(`${y.faith}H`);
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
}
