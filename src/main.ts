/**
 * 应用入口
 * 初始化引擎、渲染器、UI管理器，启动游戏
 */

import { GameEngine } from './game/engine';
import { HexRenderer } from './ui/hex-renderer';
import './ui/styles.css';
import { UIManager } from './ui/ui-manager';

function main(): void {
  const canvas = document.getElementById('board-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  // 1. 创建游戏引擎（逻辑层）
  const engine = new GameEngine();

  // 2. 创建渲染器（视图层 - Canvas）
  const renderer = new HexRenderer(canvas, engine);

  // 3. 创建 UI 管理器（视图层 - DOM）
  const ui = new UIManager(engine, renderer);

  // 4. 启动游戏
  engine.startNewGame();

  // 暴露到全局（调试用）
  if (import.meta.env.DEV) {
    (window as any).__engine = engine;
    (window as any).__renderer = renderer;
    (window as any).__ui = ui;
  }
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
