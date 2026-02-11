/**
 * 3D 模型加载与缓存管理器
 * 使用 Three.js GLTFLoader 加载 Kenney Hexagon Kit 的 GLB 文件
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ModelManager {
  private cache = new Map<string, THREE.Group>();
  private loader = new GLTFLoader();
  private basePath: string;
  private _ready = false;

  /** 加载进度 (0~1) */
  progress = 0;

  constructor(basePath = 'models/') {
    this.basePath = basePath;
  }

  get ready(): boolean {
    return this._ready;
  }

  /**
   * 修复所有已缓存模型的纹理 (消除摩尔纹)
   * 1) 小纹理（<512px）放大 4 倍，提供足够的像素数据给 mipmap
   * 2) 启用三线性过滤 + 最大各向异性过滤
   * 需要在 WebGLRenderer 创建后调用
   */
  fixTextures(maxAnisotropy: number): void {
    // 收集所有唯一纹理及引用它的材质
    const texToMats = new Map<number, { tex: THREE.Texture; mats: THREE.Material[] }>();

    for (const model of this.cache.values()) {
      model.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          // 兼容任何含 map 属性的材质类型
          const m = mat as any;
          if (!m.map) continue;
          const tex = m.map as THREE.Texture;
          if (!texToMats.has(tex.id)) {
            texToMats.set(tex.id, { tex, mats: [] });
          }
          texToMats.get(tex.id)!.mats.push(mat);
        }
      });
    }

    let upscaled = 0;
    for (const { tex, mats } of texToMats.values()) {
      const img = tex.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
      const w = img?.width ?? 0;
      const h = img?.height ?? 0;

      if (img && (w < 512 || h < 512)) {
        // ---- 放大小纹理 ----
        const factor = w < 256 ? 8 : 4;
        const nw = w * factor;
        const nh = h * factor;

        const canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        const ctx = canvas.getContext('2d')!;
        // 双线性插值平滑放大
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img as CanvasImageSource, 0, 0, nw, nh);

        const newTex = new THREE.CanvasTexture(canvas);
        // 复制原始 UV / 色彩空间设置
        newTex.wrapS = tex.wrapS;
        newTex.wrapT = tex.wrapT;
        newTex.flipY = tex.flipY;
        newTex.colorSpace = tex.colorSpace;
        newTex.anisotropy = maxAnisotropy;
        newTex.minFilter = THREE.LinearMipmapLinearFilter;
        newTex.magFilter = THREE.LinearFilter;
        newTex.generateMipmaps = true;
        newTex.needsUpdate = true;

        // 替换所有引用此纹理的材质
        for (const mat of mats) {
          (mat as any).map = newTex;
          (mat as any).needsUpdate = true;
        }
        upscaled++;
      } else {
        // ---- 仅修复过滤参数 ----
        tex.anisotropy = maxAnisotropy;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
      }
    }

    console.log(
      `[ModelManager] Fixed ${texToMats.size} textures (${upscaled} upscaled), anisotropy=${maxAnisotropy}`,
    );
  }

  /**
   * 获取指定模型的包围盒尺寸 (用于计算缩放)
   */
  getModelSize(fileName: string): THREE.Vector3 | null {
    const model = this.cache.get(fileName);
    if (!model) return null;
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  }

  /**
   * 批量预加载所有模型
   * @param fileNames GLB 文件名数组
   * @param onProgress 可选的进度回调
   */
  async loadAll(
    fileNames: string[],
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const unique = [...new Set(fileNames)];
    let loaded = 0;
    const total = unique.length;

    await Promise.all(
      unique.map(async (name) => {
        await this.load(name);
        loaded++;
        this.progress = loaded / total;
        onProgress?.(loaded, total);
      }),
    );

    this._ready = true;
  }

  /**
   * 加载单个模型并缓存
   */
  private async load(fileName: string): Promise<void> {
    if (this.cache.has(fileName)) return;

    try {
      const gltf = await this.loader.loadAsync(this.basePath + fileName);
      const model = gltf.scene;

      // 启用阴影
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      this.cache.set(fileName, model);
    } catch (err) {
      console.warn(`[ModelManager] Failed to load: ${fileName}`, err);
    }
  }

  /**
   * 获取模型的克隆实例 (可安全放入场景)
   * 返回 null 表示模型未加载
   */
  clone(fileName: string): THREE.Group | null {
    const original = this.cache.get(fileName);
    if (!original) return null;
    return original.clone();
  }

  /**
   * 检查模型是否已加载
   */
  has(fileName: string): boolean {
    return this.cache.has(fileName);
  }
}
