/**
 * 3D 六角棋盘渲染器 (Three.js + Kenney Hexagon Kit 模型)
 *
 * - 使用 Kenney GLB 模型替代纯几何体
 * - 已解锁+有地形的地块 → 对应 GLB 模型
 * - 未解锁/空地 → 程序化六角棱柱
 * - 自动检测模型朝向，按需旋转以匹配 pointy-top 网格
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { hexKey, hexNeighbors } from '../core/hex';
import type { HexCoord, ITile, IYields } from '../core/types';
import { getTile } from '../game/board';
import type { GameEngine } from '../game/engine';
import type { ModelManager } from './model-manager';
import { getModelForTile } from './model-mapping';

// ---- 常量 ----
const HEX_SIZE = 1.0;               // 网格间距使用的半径
const HEX_INNER = HEX_SIZE * 0.95;  // 程序化六角格的绘制半径
/** 参考模型名 (用于测量 Kenney 模型实际尺寸) */
const REFERENCE_MODEL = 'grass.glb';
/** 出现动画时长 (ms) */
const APPEAR_DURATION = 400;
/** 出现动画每圈延迟 (ms) */
const APPEAR_DELAY_PER_RING = 60;

/** 缩放动画条目 */
interface ScaleAnim {
  group: THREE.Group;
  startTime: number;
  delay: number;
  duration: number;
  from: number;
  to: number;
}

export class HexRenderer3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private engine: GameEngine;
  private models: ModelManager;
  private container: HTMLElement;

  private boardGroup = new THREE.Group();
  private highlightGroup = new THREE.Group();

  /** hex key → 用于 raycast 的 mesh (顶面) */
  private hitMeshes = new Map<string, THREE.Mesh>();
  /** hex key → 整个地块 group (模型 + sprites) */
  private tileGroups = new Map<string, THREE.Group>();

  private hoveredHex: HexCoord | null = null;
  private selectedHex: HexCoord | null = null;
  private validPlacements = new Set<string>();

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private animFrameId = 0;

  /** 共享的程序化 hex shape */
  private hexShape!: THREE.Shape;

  /** 运行时计算的模型缩放系数 */
  private modelScale = 1.0;
  /** 运行时计算的模型 Y 轴旋转角 (自动对齐 pointy-top) */
  private modelRotationY = 0;

  /** 正在播放的缩放动画 */
  private scaleAnims: ScaleAnim[] = [];
  /** 所有产出标签精灵 (用于 LOD 缩放) */
  private yieldSprites: THREE.Sprite[] = [];
  /** 收益标签是否可见 */
  private yieldLabelsVisible = true;
  /** yield sprite 的基础缩放值 */
  private readonly YIELD_BASE_SCALE = new THREE.Vector3(1.4, 0.3, 1);
  /** 临时向量 (避免每帧 alloc) */
  private readonly _tmpVec = new THREE.Vector3();

  /** 选中地块 shader 高亮: 存储被替换前的原始材质 */
  private selectedShaderKey: string | null = null;
  private selectedOrigMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  // ---- 公共回调 ----
  onHexClick: ((coord: HexCoord) => void) | null = null;
  onHexHover: ((coord: HexCoord | null) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, engine: GameEngine, models: ModelManager) {
    this.engine = engine;
    this.models = models;
    this.container = canvas.parentElement!;
    this.hexShape = this.makeHexShape(HEX_INNER);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0f1923);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // 修复所有模型纹理的各向异性过滤 (消除摩尔纹/锯齿)
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    models.fixTextures(maxAniso);

    // 从参考模型计算正确的缩放系数和旋转角
    this.computeModelScaleAndRotation();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0f1923, 0.006);
    this.scene.add(this.boardGroup);
    this.scene.add(this.highlightGroup);

    // Camera
    const rect = this.container.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(40, rect.width / rect.height, 0.1, 200);
    this.camera.position.set(0, 18, 16);
    this.camera.lookAt(0, 0, 0);

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 45;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.setupLighting();
    this.bindEvents();
    this.handleResize();
    this.animate();
  }

  /**
   * 从参考模型的包围盒自动计算缩放系数和旋转角
   * - 比较 size.x 与 size.z 判断模型是 flat-top 还是 pointy-top
   * - flat-top (size.x > size.z): 顶点沿 X → 需旋转 30°
   * - pointy-top (size.z ≥ size.x): 顶点沿 Z → 无需旋转
   */
  private computeModelScaleAndRotation(): void {
    const size = this.models.getModelSize(REFERENCE_MODEL);
    if (!size) {
      console.warn('[HexRenderer3D] Reference model not loaded, using defaults');
      this.modelScale = 1.0;
      this.modelRotationY = 0;
      return;
    }

    // 较宽轴 = vertex-to-vertex = 2 * outerRadius
    const modelOuterRadius = Math.max(size.x, size.z) / 2;
    // 轻微放大 (1.02) 使模型之间无缝隙
    this.modelScale = (HEX_SIZE / modelOuterRadius) * 1.02;

    // 自动判断朝向
    if (size.x > size.z * 1.05) {
      // 顶点沿 X → flat-top → 旋转 30° 适配 pointy-top 网格
      this.modelRotationY = Math.PI / 6;
    } else {
      // 顶点沿 Z (或近似正方) → 已是 pointy-top → 不旋转
      this.modelRotationY = 0;
    }

    console.log(
      `[HexRenderer3D] Model bbox: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}, ` +
      `outerR=${modelOuterRadius.toFixed(3)}, scale=${this.modelScale.toFixed(3)}, ` +
      `rotation=${(this.modelRotationY * 180 / Math.PI).toFixed(1)}° ` +
      `(${size.x > size.z * 1.05 ? 'flat-top→rotated' : 'pointy-top→no rotation'})`,
    );
  }

  // ---- Hex Shape (pointy-top, 用于程序化地块) ----

  private makeHexShape(radius: number): THREE.Shape {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 2;
      const px = radius * Math.cos(angle);
      const py = radius * Math.sin(angle);
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    return shape;
  }

  // ---- Lighting ----

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x6080b0, 0.8);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
    sun.position.set(10, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    // 消除 shadow acne (阴影条纹)
    sun.shadow.bias = -0.004;
    sun.shadow.normalBias = 0.03;
    const sc = 25;
    sun.shadow.camera.left = -sc;
    sun.shadow.camera.right = sc;
    sun.shadow.camera.top = sc;
    sun.shadow.camera.bottom = -sc;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x6090c0, 0.4);
    fill.position.set(-6, 10, -8);
    this.scene.add(fill);

    const hemi = new THREE.HemisphereLight(0x90b0d0, 0x203040, 0.4);
    this.scene.add(hemi);
  }

  // ---- Events ----

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
    canvas.addEventListener('click', (e) => this.onPointerClick(e));
    canvas.addEventListener('mouseleave', () => {
      this.hoveredHex = null;
      this.onHexHover?.(null);
      this.updateHighlights();
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const coord = this.raycastHex(t.clientX, t.clientY);
      if (coord) {
        this.hoveredHex = coord;
        this.onHexHover?.(coord);
        this.onHexClick?.(coord);
        this.updateHighlights();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.renderer.setSize(rect.width, rect.height);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  // ---- Coordinate conversion (pointy-top) ----

  private hexToWorld(coord: HexCoord): { x: number; z: number } {
    const s = HEX_SIZE * 2;
    const w = Math.sqrt(3) / 2 * s;
    const x = w * (coord.q + coord.r * 0.5);
    const z = s * 0.75 * coord.r;
    return { x, z };
  }

  // ---- Raycasting ----

  /** 检测是否处于竖屏强制横屏旋转模式 */
  private readonly _portraitMQ = window.matchMedia('(max-width: 768px) and (orientation: portrait)');

  private raycastHex(clientX: number, clientY: number): HexCoord | null {
    const rect = this.renderer.domElement.getBoundingClientRect();

    if (this._portraitMQ.matches) {
      // CSS 对 #app 施加了 rotate(90deg) (顺时针)
      // 屏幕坐标与画布内部坐标轴对应关系:
      //   屏幕 Y → 画布 X (top=-1, bottom=+1)
      //   屏幕 X → 画布 Y (left=-1, right=+1)
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;
      this.pointer.x = fy * 2 - 1;
      this.pointer.y = fx * 2 - 1;
    } else {
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      Array.from(this.hitMeshes.values()),
      false,
    );
    if (hits.length > 0) {
      return (hits[0].object.userData as { coord: HexCoord }).coord;
    }
    return null;
  }

  private onPointerMove(e: MouseEvent): void {
    const coord = this.raycastHex(e.clientX, e.clientY);
    const newKey = coord ? hexKey(coord) : '';
    const oldKey = this.hoveredHex ? hexKey(this.hoveredHex) : '';
    if (newKey !== oldKey) {
      this.hoveredHex = coord;
      this.onHexHover?.(coord);
      this.updateHighlights();
    }
  }

  private onPointerClick(e: MouseEvent): void {
    const coord = this.raycastHex(e.clientX, e.clientY);
    if (coord) this.onHexClick?.(coord);
  }

  // ---- Public API ----

  setValidPlacements(coords: HexCoord[]): void {
    this.validPlacements = new Set(coords.map(hexKey));
    this.updateHighlights();
  }

  clearValidPlacements(): void {
    this.validPlacements.clear();
    this.updateHighlights();
  }

  setSelectedHex(coord: HexCoord | null): void {
    this.selectedHex = coord;
    this.applySelectedShader(coord ? hexKey(coord) : null);
    this.updateHighlights();
  }

  /**
   * 增量更新棋盘：仅重建发生变化的地块
   * 首次调用时全量构建 (带入场动画)
   */
  draw(): void {
    this.incrementalUpdate();
    // 如果选中地块被重建了，重新施加选中高亮
    if (this.selectedHex) {
      const sk = hexKey(this.selectedHex);
      if (this.selectedShaderKey !== sk || this.selectedOrigMats.size === 0) {
        this.applySelectedShader(sk);
      }
    }
    this.updateHighlights();
  }

  // ---- 增量更新 ----

  /** 地块的"模型指纹"(决定是否需要重建 3D 对象) */
  private prevModelFP = new Map<string, string>();
  /** 地块的"产出指纹"(决定是否需要更新标签) */
  private prevYieldFP = new Map<string, string>();
  /** 是否已完成首次全量构建 */
  private initialBuildDone = false;

  /** 生成模型指纹: 决定模型/显示状态 (含改良等级和区域) */
  private getModelFP(tile: ITile): string {
    const model = getModelForTile(tile);
    // 星星视觉 Lv5 后不再变化，所以指纹中 cap 在 5 以避免无效重建
    const impLvlVis = Math.min(tile.improvementLevel, 5);
    const distLvlVis = Math.min(tile.districtLevel, 5);
    return `${tile.unlocked}|${model ?? 'none'}|${tile.isWorked}|${impLvlVis}|${tile.district?.id ?? ''}|${distLvlVis}`;
  }

  /** 生成产出指纹: 决定产出标签内容 */
  private getYieldFP(tile: ITile): string {
    if (!tile.terrain) return '';
    const y = this.engine.getTileEffectiveYields(tile.coord);
    return this.formatYieldCompact(y);
  }

  private incrementalUpdate(): void {
    const state = this.engine.getState();
    const isFirstBuild = !this.initialBuildDone;
    const currentKeys = new Set<string>();

    for (const [key, tile] of state.board) {
      currentKeys.add(key);
      const mfp = this.getModelFP(tile);
      const yfp = this.getYieldFP(tile);
      const prevMfp = this.prevModelFP.get(key);
      const prevYfp = this.prevYieldFP.get(key);

      if (prevMfp === undefined) {
        // ---- 新地块 → 构建 ----
        this.buildTile(key, tile, true, isFirstBuild);
      } else if (prevMfp !== mfp) {
        // ---- 模型/状态变化 → 重建 (带动画) ----
        this.removeTile(key);
        this.buildTile(key, tile, true, false);
      } else if (prevYfp !== yfp) {
        // ---- 仅产出变化 → 更新标签 ----
        this.updateYieldSprite(key, tile);
      }
      // else: 无变化，跳过

      this.prevModelFP.set(key, mfp);
      this.prevYieldFP.set(key, yfp);
    }

    // 移除已消失的地块 (理论上不会发生)
    for (const key of [...this.prevModelFP.keys()]) {
      if (!currentKeys.has(key)) {
        this.removeTile(key);
        this.prevModelFP.delete(key);
        this.prevYieldFP.delete(key);
      }
    }

    this.initialBuildDone = true;
  }

  /** 移除单个地块 */
  private removeTile(key: string): void {
    // 如果正在移除选中地块，先清除 shader 引用 (避免悬空引用)
    if (key === this.selectedShaderKey) {
      this.selectedOrigMats.clear();
      this.selectedShaderKey = null;
    }
    const group = this.tileGroups.get(key);
    if (group) {
      // 清除该 group 下的 yield sprites 引用
      for (let i = this.yieldSprites.length - 1; i >= 0; i--) {
        if (this.yieldSprites[i].parent === group) {
          this.yieldSprites.splice(i, 1);
        }
      }
      this.boardGroup.remove(group);
      this.disposeObject(group);
      this.tileGroups.delete(key);
    }
    this.hitMeshes.delete(key);
    // 移除相关动画
    this.scaleAnims = this.scaleAnims.filter(a =>
      (a.group.userData as { key?: string }).key !== key);
  }

  /** 仅更新地块的产出标签 (不重建模型) */
  private updateYieldSprite(key: string, tile: ITile): void {
    const group = this.tileGroups.get(key);
    if (!group) return;

    // 移除旧的 yield sprite
    for (let i = group.children.length - 1; i >= 0; i--) {
      const child = group.children[i];
      if (child.userData?.isYieldSprite) {
        // 从 LOD 列表中也移除
        const idx = this.yieldSprites.indexOf(child as THREE.Sprite);
        if (idx !== -1) this.yieldSprites.splice(idx, 1);
        group.remove(child);
        this.disposeObject(child);
      }
    }

    // 添加新的 yield sprite
    if (tile.terrain) {
      let modelTop = 0.3;
      for (const child of group.children) {
        if (child instanceof THREE.Group) {
          const box = new THREE.Box3().setFromObject(child);
          modelTop = Math.max(modelTop, box.max.y + 0.1);
        }
      }

      const isCityCenter = tile.terrain.id === 'city_center';
      const yields = this.engine.getTileEffectiveYields(tile.coord);
      const text = this.formatYieldCompact(yields);
      if (text) {
        const dimmed = !tile.isWorked && !isCityCenter;
        const ysp = this.createYieldSprite(text, dimmed);
        ysp.position.set(0, modelTop, HEX_SIZE * 0.3);
        ysp.userData = { isYieldSprite: true };
        this.yieldSprites.push(ysp);
        group.add(ysp);
      }
    }
  }

  // ---- Board Build ----

  /**
   * @param animate 是否播放缩放动画
   * @param stagger 是否按距离延迟 (仅首次全量构建)
   */
  private buildTile(key: string, tile: ITile, animate = false, stagger = false): void {
    const { x, z } = this.hexToWorld(tile.coord);
    const tileGroup = new THREE.Group();
    tileGroup.position.set(x, 0, z);
    tileGroup.userData = { coord: tile.coord, key };

    const modelFile = getModelForTile(tile);

    if (modelFile && this.models.has(modelFile)) {
      // ---- 使用 Kenney 模型 ----
      this.buildModelTile(tileGroup, tile, modelFile);
    } else {
      // ---- 程序化地块 (未解锁/空地/无模型) ----
      this.buildProceduralTile(tileGroup, tile);
    }

    this.boardGroup.add(tileGroup);
    this.tileGroups.set(key, tileGroup);

    // 缩放出现动画
    if (animate) {
      const dist = (Math.abs(tile.coord.q) + Math.abs(tile.coord.r)
        + Math.abs(-tile.coord.q - tile.coord.r)) / 2;
      tileGroup.scale.setScalar(0.01);
      this.scaleAnims.push({
        group: tileGroup,
        startTime: performance.now(),
        delay: stagger ? dist * APPEAR_DELAY_PER_RING : 0,
        duration: APPEAR_DURATION,
        from: 0.01,
        to: 1.0,
      });
    }
  }

  /**
   * 使用 Kenney GLB 模型构建地块
   */
  private buildModelTile(group: THREE.Group, tile: ITile, modelFile: string): void {
    const model = this.models.clone(modelFile);
    if (!model) return;

    // 按自动检测的旋转角对齐 pointy-top 网格
    model.rotation.y = this.modelRotationY;
    model.scale.setScalar(this.modelScale);

    const isCityCenter = tile.terrain?.id === 'city_center';

    // ---- 视觉区分: 仅用星星 (颜色 + 大小) ----
    let starColor: number | null = null;
    let starScale = 0.28; // 默认星大小

    if (!tile.isWorked && !isCityCenter) {
      this.applyGreyscaleShader(model);
    } else if (isCityCenter) {
      starColor = 0xf0c040; starScale = 0.38; // 城市中心: 大金星
    } else if (tile.district) {
      const dlvl = tile.districtLevel || 1;
      if (dlvl >= 3) { starColor = 0x60c0ff; starScale = 0.38; } // 蓝色大
      else if (dlvl >= 2) { starColor = 0x40a0ff; starScale = 0.30; } // 蓝色中
      // Lv1: 无星
    } else {
      const lvl = tile.improvementLevel;
      if (lvl >= 5) { starColor = 0xffd700; starScale = 0.44; } // 亮金大
      else if (lvl >= 4) { starColor = 0xf0c040; starScale = 0.38; } // 金色
      else if (lvl >= 3) { starColor = 0xe0a030; starScale = 0.32; } // 橙金
      else if (lvl >= 2) { starColor = 0xc08020; starScale = 0.24; } // 暗橙小
      // Lv1: 无星
    }

    group.add(model);

    // 装饰星 (浮在模型上方)
    if (starColor !== null) {
      const box = new THREE.Box3().setFromObject(model);
      const topY = box.max.y + 0.12;
      const starSprite = this.createStarSprite(starColor, starScale);
      starSprite.position.set(0, topY, 0);
      starSprite.userData = { isStar: true };
      group.add(starSprite);
    }

    // 创建不可见的 hit mesh 用于 raycast
    const hitMesh = this.createHitMesh(tile.coord);
    group.add(hitMesh);
    this.hitMeshes.set(hexKey(tile.coord), hitMesh);

    // 产出标签 (所有有地形的地块都显示) — 放在模型上方
    if (tile.terrain) {
      const box = new THREE.Box3().setFromObject(model);
      const modelTop = box.max.y + 0.1;

      const yields = this.engine.getTileEffectiveYields(tile.coord);
      const text = this.formatYieldCompact(yields);
      if (text) {
        const dimmed = !tile.isWorked && !isCityCenter;
        const ysp = this.createYieldSprite(text, dimmed);
        ysp.position.set(0, modelTop, HEX_SIZE * 0.3);
        ysp.userData = { isYieldSprite: true };
        this.yieldSprites.push(ysp);
        group.add(ysp);
      }
    }
  }

  /**
   * 程序化构建地块 (未解锁 / 空地)
   */
  private buildProceduralTile(group: THREE.Group, tile: ITile): void {
    const h = tile.unlocked ? 0.15 : 0.1;

    const topColor = this.getProceduralColor(tile);
    const sideColor = new THREE.Color(topColor).multiplyScalar(0.6).getHex();

    const geo = new THREE.ExtrudeGeometry(this.hexShape, {
      depth: h,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);

    const topMat = new THREE.MeshStandardMaterial({
      color: topColor,
      roughness: 0.8,
      metalness: 0.05,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: sideColor,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, [topMat, sideMat]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { coord: tile.coord };
    group.add(mesh);

    // 也作为 hit mesh
    this.hitMeshes.set(hexKey(tile.coord), mesh);

    // 图标
    if (!tile.unlocked) {
      // 锁图标
      const sp = this.createTextSprite('🔒', 0.55, 128);
      sp.position.set(0, h + 0.25, 0);
      group.add(sp);

      // 解锁费用
      const state = this.engine.getState();
      const hasAdj = hexNeighbors(tile.coord).some(n => {
        const nt = getTile(state.board, n);
        return nt && nt.unlocked;
      });
      if (hasAdj) {
        const cost = this.engine.getHexUnlockCost(tile.coord);
        if (cost < Infinity) {
          const csp = this.createCostSprite(`${cost}🪙`);
          csp.position.set(0, h + 0.08, HEX_SIZE * 0.42);
          group.add(csp);
        }
      }
    } else {
      // 空地 "+" 号
      const sp = this.createTextSprite('+', 0.45, 64);
      sp.position.set(0, h + 0.15, 0);
      group.add(sp);
    }
  }

  private getProceduralColor(tile: ITile): number {
    if (!tile.unlocked) {
      const state = this.engine.getState();
      const hasAdj = hexNeighbors(tile.coord).some(n => {
        const nt = getTile(state.board, n);
        return nt && nt.unlocked;
      });
      return hasAdj ? 0x1e3348 : 0x151e2a;
    }
    return 0x1e3045;
  }

  /**
   * 创建不可见的六角 hit mesh (用于 raycast)
   * 模型本身形状复杂，raycast 效率低；用简单平面代替
   */
  private createHitMesh(coord: HexCoord): THREE.Mesh {
    const geo = new THREE.ExtrudeGeometry(this.hexShape, {
      depth: 0.01,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      visible: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.01; // 略高于地面
    mesh.userData = { coord };
    return mesh;
  }

  /**
   * 给模型应用灰模 shader (未激活地块)
   * 通过 onBeforeCompile 注入 greyscale + 降亮 代码到片段着色器末尾
   */
  private applyGreyscaleShader(model: THREE.Group): void {
    model.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = mats.map(m => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return m;
        const cloned = m.clone();
        cloned.onBeforeCompile = (shader) => {
          // 在片段着色器最后、dithering 之后，将颜色转为灰度 + 降亮
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            float grey = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor.rgb = vec3(grey) * 0.55;`,
          );
        };
        cloned.needsUpdate = true;
        return cloned;
      });
      mesh.material = newMats.length === 1 ? newMats[0] : newMats;
    });
  }

  /**
   * 给模型施加发光效果 (高等级改良 / 区域 / 城市中心)
   * 通过 onBeforeCompile 注入自发光到片段着色器
   */
  private applyEmissiveShader(model: THREE.Group, color: number, intensity: number): void {
    const c = new THREE.Color(color);
    model.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = mats.map(m => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return m;
        const cloned = m.clone();
        cloned.emissive = c;
        cloned.emissiveIntensity = intensity;
        cloned.needsUpdate = true;
        return cloned;
      });
      mesh.material = newMats.length === 1 ? newMats[0] : newMats;
    });
  }

  // ---- 选中地块 shader 高亮 ----

  /** 对指定 key 的地块施加/移除选中高亮 shader */
  private applySelectedShader(key: string | null): void {
    // 先恢复上次选中的
    this.restoreSelectedShader();
    this.selectedShaderKey = key;
    if (!key) return;

    const group = this.tileGroups.get(key);
    if (!group) return;

    group.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (mesh.userData.isHitMesh) return;

      // 保存原始材质引用
      this.selectedOrigMats.set(mesh, mesh.material);

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = mats.map(m => {
        const cloned = m.clone();
        if (cloned instanceof THREE.MeshStandardMaterial) {
          // 给选中地块加一层金色自发光 tint
          cloned.emissive = new THREE.Color(0xf0c040);
          cloned.emissiveIntensity = 0.35;
          cloned.needsUpdate = true;
        }
        return cloned;
      });
      mesh.material = newMats.length === 1 ? newMats[0] : newMats;
    });
  }

  /** 恢复上次选中地块的原始材质 */
  private restoreSelectedShader(): void {
    for (const [mesh, origMat] of this.selectedOrigMats) {
      mesh.material = origMat;
    }
    this.selectedOrigMats.clear();
    this.selectedShaderKey = null;
  }

  /** 创建浮空装饰星光点 sprite */
  private createStarSprite(color: number, scale = 0.28): THREE.Sprite {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    // 绘制十字星光
    const c = new THREE.Color(color);
    const css = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
    ctx.fillStyle = css;
    ctx.globalAlpha = 0.9;
    // 画一个简单的四角星
    ctx.beginPath();
    const or = size * 0.45, ir = size * 0.12;
    for (let i = 0; i < 4; i++) {
      const aOuter = (Math.PI / 2) * i - Math.PI / 2;
      const aInner = aOuter + Math.PI / 4;
      ctx.lineTo(cx + Math.cos(aOuter) * or, cy + Math.sin(aOuter) * or);
      ctx.lineTo(cx + Math.cos(aInner) * ir, cy + Math.sin(aInner) * ir);
    }
    ctx.closePath();
    ctx.fill();
    // 中心白色高光
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.15);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    return sprite;
  }

  // ---- Sprites ----

  private createTextSprite(text: string, scale: number, resolution = 128): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, resolution, resolution);
    ctx.font = `${Math.round(resolution * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, resolution / 2, resolution / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    return sprite;
  }

  private createYieldSprite(text: string, dimmed = false): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const w = 512;
    const h = 96;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // 背景胶囊
    const bgAlpha = dimmed ? 0.35 : 0.7;
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 12);
    ctx.fill();

    // 工作中的地块加一条亮色底边
    if (!dimmed) {
      ctx.strokeStyle = 'rgba(80,220,120,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 12);
      ctx.stroke();
    }

    // 文字
    ctx.font = `bold ${Math.round(h * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dimmed ? 'rgba(200,200,200,0.5)' : '#ffffff';
    ctx.fillText(text, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: dimmed ? 0.65 : 1.0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.3, 1);
    return sprite;
  }

  /** 紧凑型费用标签 (用于解锁费用等) */
  private createCostSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const w = 192;
    const h = 64;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 10);
    ctx.fill();
    ctx.font = `bold ${Math.round(h * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd866';
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.28, 1);
    return sprite;
  }

  // ---- Highlights (发光 hex 平面) ----

  /** 当前高亮 mesh (用于脉动动画) */
  private glowMeshes: THREE.Mesh[] = [];

  private updateHighlights(): void {
    this.disposeGroup(this.highlightGroup);
    this.glowMeshes = [];

    if (this.selectedHex) {
      const glow = this.createGlowHex(this.selectedHex, 0xf0c040, 0.5, 1.08);
      if (glow) { this.highlightGroup.add(glow); this.glowMeshes.push(glow); }
    }
    if (this.hoveredHex) {
      const glow = this.createGlowHex(this.hoveredHex, 0xffffff, 0.3, 1.04);
      if (glow) { this.highlightGroup.add(glow); this.glowMeshes.push(glow); }
    }
    for (const key of this.validPlacements) {
      const [q, r] = key.split(',').map(Number);
      const glow = this.createGlowHex({ q, r }, 0x40f040, 0.4, 1.0);
      if (glow) { this.highlightGroup.add(glow); this.glowMeshes.push(glow); }
    }
  }

  /**
   * 创建一个发光的六边形 flat mesh (additive blending)
   * 用于选中/悬停/有效放置高亮
   */
  private createGlowHex(coord: HexCoord, color: number, opacity: number, scale: number): THREE.Mesh | null {
    const state = this.engine.getState();
    const tile = getTile(state.board, coord);
    if (!tile) return null;

    const { x, z } = this.hexToWorld(coord);
    const geo = new THREE.ShapeGeometry(this.hexShape);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.02, z);
    mesh.scale.setScalar(scale);
    mesh.userData = { isGlow: true, baseOpacity: opacity };
    return mesh;
  }

  // ---- Animation ----

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.tickScaleAnims();
    this.tickYieldLOD();
    this.tickGlowPulse();
    this.tickStarFloating();
    this.renderer.render(this.scene, this.camera);
  };

  /** 装饰星上下浮动 + 旋转 */
  private tickStarFloating(): void {
    const t = performance.now() * 0.001;
    this.scene.traverse(obj => {
      if (obj.userData?.isStar) {
        // 上下浮动
        const baseY = obj.userData.baseY ?? obj.position.y;
        if (obj.userData.baseY === undefined) obj.userData.baseY = obj.position.y;
        obj.position.y = baseY + Math.sin(t * 2 + baseY * 10) * 0.03;
        // 旋转
        (obj as THREE.Sprite).material.rotation = t * 1.5;
      }
    });
  }

  /** 脉动高亮 glow */
  private tickGlowPulse(): void {
    if (this.glowMeshes.length === 0) return;
    const t = performance.now() * 0.001;
    for (const mesh of this.glowMeshes) {
      const base = mesh.userData.baseOpacity as number;
      (mesh.material as THREE.MeshBasicMaterial).opacity = base * (0.55 + 0.45 * Math.sin(t * 4));
    }
  }

  /**
   * 根据相机距离动态缩放产出标签 (LOD)
   * 远看时放大标签，近看时缩小，保持可读性
   */
  private tickYieldLOD(): void {
    if (this.yieldSprites.length === 0) return;
    const visible = this.yieldLabelsVisible;
    const camPos = this.camera.position;
    for (const sp of this.yieldSprites) {
      sp.visible = visible;
      if (!visible) continue;
      sp.getWorldPosition(this._tmpVec);
      const dist = camPos.distanceTo(this._tmpVec);
      const factor = Math.max(0.8, dist / 15);
      sp.scale.set(
        this.YIELD_BASE_SCALE.x * factor,
        this.YIELD_BASE_SCALE.y * factor,
        1,
      );
    }
  }

  /** 切换收益标签显示/隐藏 */
  toggleYieldLabels(): void {
    this.yieldLabelsVisible = !this.yieldLabelsVisible;
  }

  /** 当前收益标签是否显示 */
  getYieldLabelsVisible(): boolean {
    return this.yieldLabelsVisible;
  }

  /** 更新所有缩放动画 */
  private tickScaleAnims(): void {
    if (this.scaleAnims.length === 0) return;
    const now = performance.now();
    for (let i = this.scaleAnims.length - 1; i >= 0; i--) {
      const a = this.scaleAnims[i];
      const elapsed = now - a.startTime - a.delay;
      if (elapsed < 0) {
        // 还在延迟阶段，保持起始缩放
        a.group.scale.setScalar(a.from);
        continue;
      }
      const t = Math.min(elapsed / a.duration, 1);
      // ease-out back (轻微回弹效果)
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      const scale = a.from + (a.to - a.from) * eased;
      a.group.scale.setScalar(scale);
      if (t >= 1) {
        a.group.scale.setScalar(a.to);
        this.scaleAnims.splice(i, 1);
      }
    }
  }

  // ---- Helpers ----

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

  private disposeGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    // 递归清理子对象
    while (obj.children.length > 0) {
      const child = obj.children[0];
      obj.remove(child);
      this.disposeObject(child);
    }
    if ((obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
    if ((obj as THREE.Mesh).material) {
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach(m => {
          if ((m as THREE.MeshStandardMaterial).map) (m as THREE.MeshStandardMaterial).map!.dispose();
          m.dispose();
        });
      } else {
        if ((mat as THREE.MeshStandardMaterial).map) (mat as THREE.MeshStandardMaterial).map!.dispose();
        (mat as THREE.Material).dispose();
      }
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
