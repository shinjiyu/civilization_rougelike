/**
 * 应用入口
 * 初始化引擎、模型管理器、渲染器、UI管理器，启动游戏
 * 支持 localStorage 自动存档/恢复
 */

import { loadConfig } from './core/config';
import { GameEngine } from './game/engine';
import { HexRenderer3D } from './ui/hex-renderer-3d';
import { ModelManager } from './ui/model-manager';
import { getAllModelFileNames } from './ui/model-mapping';
import './ui/styles.css';
import { UIManager } from './ui/ui-manager';

/** 尝试锁定屏幕为横屏 (需要全屏环境) */
function tryLockLandscape(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orientation = screen.orientation as any;
    if (orientation && typeof orientation.lock === 'function') {
      orientation.lock('landscape').catch(() => { /* 非全屏时静默失败 */ });
    }
  } catch {
    // 浏览器不支持 screen.orientation.lock
  }
}

async function main(): Promise<void> {
  // 手机端尝试锁定横屏
  tryLockLandscape();

  const canvas = document.getElementById('board-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  // 0. 加载配置
  const config = loadConfig();

  // 1. 创建游戏引擎（逻辑层）
  const engine = new GameEngine(config);

  // 2. 加载 3D 模型（显示加载进度）
  const loadingEl = showLoading();
  const models = new ModelManager('models/');
  const modelFiles = getAllModelFileNames();

  await models.loadAll(modelFiles, (loaded, total) => {
    const pct = Math.round((loaded / total) * 100);
    if (loadingEl) {
      loadingEl.textContent = `加载模型 ${loaded}/${total} (${pct}%)`;
    }
  });

  hideLoading(loadingEl);

  // 3. 创建渲染器（视图层 - Three.js 3D）
  const renderer = new HexRenderer3D(canvas, engine, models);

  // 4. 创建 UI 管理器（视图层 - DOM）
  const ui = new UIManager(engine, renderer);

  // 5. 尝试从 localStorage 恢复存档，否则开始新游戏
  const restored = engine.loadFromStorage();
  if (!restored) {
    engine.startNewGame();
  }

  // 6. 自动存档：每次状态变化后写入 localStorage
  engine.on((event) => {
    if (event === 'state_changed') {
      engine.saveToStorage();
    }
  });

  // 暴露到全局（调试用）
  if (import.meta.env.DEV) {
    (window as any).__engine = engine;
    (window as any).__renderer = renderer;
    (window as any).__ui = ui;
  }
}

function showLoading(): HTMLElement | null {
  // 尝试在 canvas 区域显示加载文字
  const container = document.getElementById('board-container');
  if (!container) return null;
  const el = document.createElement('div');
  el.id = 'model-loading';
  el.style.cssText = `
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: #8ab4d0; font-size: 1.1rem; font-family: sans-serif;
    background: rgba(15,25,35,0.9); z-index: 100;
    pointer-events: none;
  `;
  el.textContent = '加载 3D 模型...';
  container.style.position = 'relative';
  container.appendChild(el);
  return el;
}

function hideLoading(el: HTMLElement | null): void {
  if (el && el.parentElement) {
    el.parentElement.removeChild(el);
  }
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { main(); });
} else {
  main();
}
