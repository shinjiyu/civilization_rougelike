/**
 * Yield 计算工具函数
 * 纯函数，无副作用
 */

import type { IYields } from './types';

/** 创建零产出向量 */
export function emptyYields(): IYields {
  return { gold: 0, food: 0, production: 0, science: 0, culture: 0, faith: 0 };
}

/** 两个产出向量相加 */
export function addYields(a: IYields, b: IYields): IYields {
  return {
    gold: a.gold + b.gold,
    food: a.food + b.food,
    production: a.production + b.production,
    science: a.science + b.science,
    culture: a.culture + b.culture,
    faith: a.faith + b.faith,
  };
}

/** 产出向量按系数缩放（向下取整） */
export function scaleYields(y: IYields, factor: number): IYields {
  return {
    gold: Math.floor(y.gold * factor),
    food: Math.floor(y.food * factor),
    production: Math.floor(y.production * factor),
    science: Math.floor(y.science * factor),
    culture: Math.floor(y.culture * factor),
    faith: Math.floor(y.faith * factor),
  };
}

/** 多个产出向量求和 */
export function sumYields(...yields: IYields[]): IYields {
  return yields.reduce((acc, y) => addYields(acc, y), emptyYields());
}

/** 产出向量转可读字符串 */
export function yieldsToString(y: IYields): string {
  const parts: string[] = [];
  if (y.gold) parts.push(`${y.gold}🪙`);
  if (y.food) parts.push(`${y.food}🌾`);
  if (y.production) parts.push(`${y.production}⚙️`);
  if (y.science) parts.push(`${y.science}🔬`);
  if (y.culture) parts.push(`${y.culture}🎭`);
  if (y.faith) parts.push(`${y.faith}⛪`);
  return parts.join(' ') || '无产出';
}

/** 产出总值（简单求和，用于排序等） */
export function totalYieldValue(y: IYields): number {
  return y.gold + y.food + y.production + y.science + y.culture + y.faith;
}

/** 获取 yield 中文名 */
export function yieldName(key: keyof IYields): string {
  const names: Record<keyof IYields, string> = {
    gold: '金币',
    food: '食物',
    production: '生产力',
    science: '科技',
    culture: '文化',
    faith: '信仰',
  };
  return names[key];
}

/** 获取 yield 图标 */
export function yieldIcon(key: keyof IYields): string {
  const icons: Record<keyof IYields, string> = {
    gold: '🪙',
    food: '🌾',
    production: '⚙️',
    science: '🔬',
    culture: '🎭',
    faith: '⛪',
  };
  return icons[key];
}

/** 获取 yield 的 CSS 颜色 */
export function yieldColor(key: keyof IYields): string {
  const colors: Record<keyof IYields, string> = {
    gold: '#f0c040',
    food: '#60c040',
    production: '#e07020',
    science: '#40a0e0',
    culture: '#c060d0',
    faith: '#e0d060',
  };
  return colors[key];
}
