/**
 * 应用入口
 * 初始化引擎、模型管理器、渲染器、UI管理器，启动游戏
 * 支持 localStorage 自动存档/恢复
 */

import type { IGameConfig } from './core/config';
import { DEFAULT_CONFIG, getChallengeFromURL, loadConfig } from './core/config';
import { GameEngine } from './game/engine';
import { HexRenderer3D } from './ui/hex-renderer-3d';
import { ModelManager } from './ui/model-manager';
import { getAllModelFileNames } from './ui/model-mapping';
import './ui/styles.css';
import { UIManager } from './ui/ui-manager';

// ======== Polyfills (兼容百度/夸克/迅雷等国产浏览器) ========

/**
 * CanvasRenderingContext2D.roundRect polyfill
 * Chrome 99+ / Safari 15.4+ 才原生支持；国产浏览器可能缺失
 */
if (
  typeof CanvasRenderingContext2D !== 'undefined' &&
  !CanvasRenderingContext2D.prototype.roundRect
) {
  (CanvasRenderingContext2D.prototype as any).roundRect = function (
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radii?: number | number[],
  ): void {
    const r = Math.min(
      typeof radii === 'number' ? radii : Array.isArray(radii) ? (radii[0] || 0) : 0,
      w / 2,
      h / 2,
    );
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

// ======== WebGL 支持检测 ========

function checkWebGLSupport(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      c.getContext('webgl2') ||
      c.getContext('webgl') ||
      c.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

function showWebGLError(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
      text-align:center;padding:20px;font-family:sans-serif;color:#3a3020;background:#f5f0e0">
      <div>
        <h2 style="margin-bottom:16px">⚠️ 浏览器不支持 WebGL</h2>
        <p style="color:#6a5d45;line-height:1.8">
          本游戏需要 WebGL 支持才能渲染 3D 地图。<br>
          请尝试以下方案：<br>
          1. 使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 浏览器<br>
          2. 在浏览器设置中启用「硬件加速」<br>
          3. 更新显卡驱动程序
        </p>
      </div>
    </div>
  `;
}

// ======== 竖屏旋转后滚动修复 ========

/**
 * 当 #app 通过 CSS rotate(90deg) 强制横屏时，
 * 浏览器原生触摸滚动方向与旋转后的逻辑方向不匹配。
 * 此函数对可滚动面板注入 JS 触摸滚动处理。
 *
 * 旋转 90° 顺时针后 (rotation matrix: screen_x = -css_y, screen_y = css_x)：
 *   物理屏幕 X+(右) → CSS Y-(上)
 *   物理屏幕 X-(左) → CSS Y+(下)
 *
 * 自然滚动: 手指 CSS 向上 → scrollTop 增大 (显示下方内容)
 * 即: 物理右滑 (dx>0) → CSS 上 → scrollTop 增大
 * 公式: scrollTop = start + dx
 */
function setupRotatedScroll(): void {
  const portraitMQ = window.matchMedia(
    '(max-width: 768px) and (orientation: portrait)',
  );

  function patchElement(el: HTMLElement): void {
    let startPhysX = 0;
    let startScrollTop = 0;
    let active = false;

    el.addEventListener(
      'touchstart',
      (e) => {
        if (!portraitMQ.matches) return;
        if (e.touches.length !== 1) return; // 只处理单指
        startPhysX = e.touches[0].clientX;
        startScrollTop = el.scrollTop;
        active = true;
      },
      { passive: true },
    );

    el.addEventListener(
      'touchmove',
      (e) => {
        if (!portraitMQ.matches || !active) return;
        // 物理右滑 (dx > 0) → CSS 向上 → scrollTop 增大 (自然滚动)
        const dx = e.touches[0].clientX - startPhysX;
        el.scrollTop = startScrollTop + dx;
        e.preventDefault();
      },
      { passive: false },
    );

    el.addEventListener('touchend', () => { active = false; }, { passive: true });
    el.addEventListener('touchcancel', () => { active = false; }, { passive: true });
  }

  // 修复所有可能需要纵向滚动的容器
  document.querySelectorAll<HTMLElement>(
    '.side-panel, #tutorial-content, #rules-content, #settings-content, #tech-tree-content, #game-over-content',
  ).forEach(patchElement);
}

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

  // WebGL 可用性检测 (国产浏览器可能不支持)
  if (!checkWebGLSupport()) {
    showWebGLError();
    return;
  }

  const canvas = document.getElementById('board-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  // 0. 应用保存的主题 (在渲染器创建前，确保 CSS 变量已生效)
  const savedTheme = localStorage.getItem('civ-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // 0b. 检测挑战链接
  const challenge = getChallengeFromURL();
  let config: IGameConfig;
  if (challenge) {
    // 挑战模式：用发起者的配置，目标改为发起者的分数
    config = {
      ...DEFAULT_CONFIG,
      ...challenge.config,
      victoryGoalType: challenge.goalType,
      victoryGoalTarget: challenge.score,
    };
  } else {
    config = loadConfig();
  }

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
  ui.setModelManager(models);

  // 4b. 如果是挑战模式，传递发起者信息
  if (challenge) {
    ui.setChallengeFrom(challenge.from);
  }

  // 5. 尝试从 localStorage 恢复存档，否则开始新游戏
  if (challenge) {
    // 挑战模式：总是开始新游戏（不加载存档），清除旧存档
    GameEngine.clearSave();
    engine.startNewGame();
  } else {
    const restored = engine.loadFromStorage();
    if (!restored) {
      engine.startNewGame();
    }
  }

  // 6. 自动存档：每次状态变化后写入 localStorage
  engine.on((event) => {
    if (event === 'state_changed') {
      engine.saveToStorage();
    }
  });

  // 7. 修复竖屏旋转后的面板滚动
  setupRotatedScroll();

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
    color: var(--text-secondary); font-size: 1.1rem; font-family: sans-serif;
    background: var(--bg-primary); z-index: 100;
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
