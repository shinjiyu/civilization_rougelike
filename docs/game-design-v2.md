# 文明精铺 Roguelike — V2 完整游戏设计规格

## 1. 设计理念

### 核心原则

1. **摆放为王** — 所有收益必须经过地块产生。没有任何机制可以绕开棋盘直接产生分数。
2. **三阶段循环** — 前期摆放（买地选位）→ 中期建造（改良区域）→ 后期升级（深耕地块），三阶段都围绕地块。
3. **资源专一** — 每种资源只有一个核心用途，无竞争无歧义。
4. **选择即成本** — 科技树二选一的分支设计，让每局游戏都有不同的策略路径。

### 与 V1 的主要变化

| 变化项 | V1 | V2 |
|--------|-----|-----|
| 加成系统 | 道具商店（随机抽卡、百分比加成） | 科技树（确定性分支、效果经过地块） |
| 商店升级 | 花科技值手动升级 | 科技树自动升级（任意树达L2/L3/L4） |
| 地块种类 | 7地形+5地貌+7资源 | 14地形+12地貌+18资源 |
| 建造种类 | 7改良+5区域 | 18改良+12区域（含科技树解锁） |
| 美术资源 | Kenney 模型复用 | 全量新制低多边形3D（模块化） |
| 刷新限制 | 无限制 | 每回合上限3次 |

---

## 2. 资源体系

### 六种产出与唯一用途

| 资源 | 图标 | 唯一用途 | 类型 |
|------|------|---------|------|
| 金币 | 🪙 | 购买地块 + 刷新商店 | 投资型（花掉才有用） |
| 粮食 | 🌾 | 驱动人口增长 | 投资型 |
| 生产力 | ⚙️ | 建造改良/区域 + 升级 | 投资型 |
| 科技 | 🔬 | 累积解锁科技树 | 得分+解锁型 |
| 文化 | 🎭 | 累积解锁政策树 | 得分+解锁型 |
| 信仰 | 🙏 | 累积解锁信仰树 | 得分+解锁型 |

### 终局得分

```
最终得分 = 累积科技 + 累积文化 + 累积信仰
```

科技/文化/信仰既是解锁科技树的条件（累积值达到阈值），也直接计入最终得分。不消耗，只看累积。

### 人口系统

- 人口 = 可分配工人数（城市中心免费不占）
- 食物消耗: 每人口 2🌾/回合
- 增长: 净食物累积达 foodPerPop（默认8）→ 人口+1
- 饥荒: 净食物持续为负 → 人口-1（最低1）
- 人口增长 → 解锁外环地块

---

## 3. 地形系统

### 3.1 地形（14种）

| ID | 名称 | 图标 | 标签 | 基础产出 | 可建造 | 可工作 | 设计意图 |
|----|------|------|------|---------|--------|--------|---------|
| `city_center` | 城市中心 | 🏛️ | `city_center` | 2🪙 2🌾 1⚙️ | 否 | 永远 | 起始核心，永远工作 |
| `grassland` | 草地 | 🌿 | `grassland`, `flat`, `buildable`, `fertile` | 2🌾 | 是 | 是 | 粮食基础地形 |
| `plains` | 平原 | 🌾 | `plains`, `flat`, `buildable`, `fertile` | 1🌾 1⚙️ | 是 | 是 | 均衡基础地形 |
| `desert` | 沙漠 | 🏜️ | `desert`, `flat`, `buildable`, `arid` | 0 | 是 | 是 | 低产但可通过科技树变肥沃 |
| `tundra` | 冻土 | ❄️ | `tundra`, `flat`, `buildable`, `cold` | 1🌾 | 是 | 是 | 寒冷地形，可通过信仰树增强 |
| `mountain` | 山脉 | ⛰️ | `mountain` | 0 | 否 | 否(可解锁) | 邻接触发器，科技/信仰树可使其可工作 |
| `lake` | 湖泊 | 🌊 | `water`, `lake`, `natural` | 1🪙 1🌾 | 否 | 是 | 内陆水域，提供邻接 |
| `coast` | 浅海 | 🏖️ | `water`, `coast`, `buildable` | 1🪙 1🌾 | 是 | 是 | 可建造水域，解锁水系玩法 |
| `ocean` | 深海 | 🌏 | `water`, `ocean` | 0 | 否 | 否(可解锁) | 远洋，科技树可使其可工作 |
| `volcanic` | 火山岩 | 🌋 | `volcanic`, `buildable`, `hill` | 2⚙️ | 是 | 是 | 高产能地形 |
| `savanna` | 稀树草原 | 🦁 | `savanna`, `flat`, `buildable` | 1🌾 1🪙 | 是 | 是 | 粮金混合 |
| `snow` | 冰原 | 🧊 | `snow`, `frozen`, `cold` | 0 | 否 | 否(可解锁) | 极端地形，信仰树可解锁 |
| `river_valley` | 河谷 | 🏞️ | `river_valley`, `flat`, `buildable`, `fertile` | 2🌾 1🪙 | 是 | 是 | 稀有高价值地形 |
| `plateau` | 高原 | 🏔️ | `plateau`, `flat`, `buildable` | 1⚙️ 1🔬 | 是 | 是 | 科技+生产混合 |

### 3.2 地貌（12种）

地貌叠加在地形上，修正产出并增加标签。

| ID | 名称 | 图标 | 标签 | 产出修正 | 适配地形 | 可移除 |
|----|------|------|------|---------|---------|--------|
| `hills` | 丘陵 | ⛰ | `hill` | +1⚙️ | 草地,平原,冻土,稀树草原 | 否 |
| `forest` | 森林 | 🌲 | `forest`, `vegetation` | +1⚙️ | 草地,平原,冻土,稀树草原 | 是 |
| `rainforest` | 雨林 | 🌴 | `rainforest`, `vegetation` | +1🌾 | 草地,稀树草原 | 是 |
| `oasis` | 绿洲 | 🏝️ | `oasis`, `natural` | +3🌾 +1🪙 | 沙漠 | 否 |
| `marsh` | 沼泽 | 🌿 | `marsh` | +1🌾 -1⚙️ | 草地,冻土 | 是 |
| `river` | 河流 | 💧 | `river` | +1🪙 +1🌾 | 草地,平原,沙漠,稀树草原,河谷 | 否 |
| `reef` | 珊瑚礁 | 🪸 | `reef`, `natural` | +1🔬 +1🪙 | 浅海 | 否 |
| `geothermal` | 地热 | ♨️ | `geothermal`, `natural` | +1⚙️ +1🔬 | 火山岩,冻土,高原 | 否 |
| `cliff` | 悬崖 | 🧗 | `cliff` | +1⚙️ | 山脉,高原,浅海 | 否 |
| `floodplain` | 洪泛平原 | 🌊 | `floodplain` | +2🌾 | 沙漠,河谷 | 否 |
| `old_growth` | 老林 | 🌳 | `old_growth`, `vegetation`, `natural` | +2⚙️ +1🔬 | 草地,冻土 | 否 |
| `volcanic_soil` | 火山灰土 | 🟤 | `volcanic_soil` | +1🌾 +1⚙️ | 火山岩 | 否 |

### 3.3 资源（18种）

资源为地块提供额外加成产出。

| ID | 名称 | 图标 | 类别 | 标签 | 产出加成 | 适配地形/地貌 |
|----|------|------|------|------|---------|-------------|
| `wheat` | 小麦 | 🌾 | bonus | `bonus_resource`, `wheat` | +1🌾 | 草地,平原,洪泛平原 |
| `stone` | 石材 | 🪨 | bonus | `bonus_resource`, `stone` | +1⚙️ | 丘陵,高原 |
| `fish` | 鱼群 | 🐟 | bonus | `bonus_resource`, `fish` | +1🌾 | 浅海,湖泊 |
| `salt` | 盐 | 🧂 | bonus | `bonus_resource`, `salt` | +1🪙 +1🌾 | 沙漠,冻土,浅海 |
| `iron` | 铁矿 | ⛓️ | strategic | `strategic_resource`, `iron` | +1⚙️ +1🔬 | 丘陵,火山岩 |
| `horses` | 马匹 | 🐴 | strategic | `strategic_resource`, `horses` | +1⚙️ +1🪙 | 草地,平原,稀树草原 |
| `gems` | 宝石 | 💎 | luxury | `luxury_resource`, `gems` | +2🪙 | 丘陵,火山岩 |
| `silk` | 丝绸 | 🧶 | luxury | `luxury_resource`, `silk` | +1🪙 +1🎭 | 森林,雨林 |
| `incense` | 乳香 | 🪔 | luxury | `luxury_resource`, `incense` | +1🪙 +1🙏 | 沙漠,稀树草原 |
| `spices` | 香料 | 🌶️ | luxury | `luxury_resource`, `spices` | +1🪙 +1🎭 | 稀树草原,雨林 |
| `grapes` | 葡萄 | 🍇 | luxury | `luxury_resource`, `grapes` | +2🪙 | 丘陵,河谷 |
| `marble` | 大理石 | 🏛 | luxury | `luxury_resource`, `marble` | +1⚙️ +1🎭 | 丘陵,高原 |
| `pearls` | 珍珠 | 🦪 | luxury | `luxury_resource`, `pearls` | +2🪙 +1🙏 | 浅海,珊瑚礁 |
| `amber` | 琥珀 | 💛 | luxury | `luxury_resource`, `amber` | +1🪙 +1🔬 | 森林,老林 |
| `ivory` | 象牙 | 🐘 | luxury | `luxury_resource`, `ivory` | +2🪙 | 稀树草原 |
| `tea` | 茶叶 | 🍵 | luxury | `luxury_resource`, `tea` | +1🪙 +1🎭 +1🙏 | 丘陵,森林 |
| `ancient_ruins` | 远古遗迹 | 🏛 | knowledge | `knowledge_resource`, `ruins` | +2🔬 | 平原,沙漠,高原 |
| `holy_site_relic` | 圣地遗址 | ✝️ | knowledge | `knowledge_resource`, `holy` | +2🙏 | 草地,山脉 |

---

## 4. 建造系统

### 4.1 基础改良设施（7种，开局可用）

| ID | 名称 | 图标 | 标签 | 放置需求 | 基础产出 | 建造费 | 邻接规则 | 升级主产出 |
|----|------|------|------|---------|---------|--------|---------|-----------|
| `farm` | 农田 | 🌾 | `farm`, `improvement` | `fertile` | 2🌾 | 8⚙️ | 每相邻farm: +1🌾 (per_each) | 🌾 |
| `mine` | 矿山 | ⛏️ | `mine`, `improvement` | `hill` | 2⚙️ | 8⚙️ | 每2相邻mine: +1⚙️ (per_two) | ⚙️ |
| `trading_post` | 商站 | 🏪 | `trading_post`, `improvement` | `buildable` | 3🪙 | 8⚙️ | 每相邻district: +1🪙 (per_each) | 🪙 |
| `lumber_mill` | 伐木场 | 🪓 | `lumber_mill`, `improvement` | `forest` 或 `old_growth` | 2⚙️ | 8⚙️ | — | ⚙️ |
| `plantation` | 种植园 | 🌿 | `plantation`, `improvement` | `flat` + `buildable` | 1🪙 1🌾 | 8⚙️ | 若相邻luxury_resource: +1🪙 (flat_if_any) | 🪙 |
| `solar_farm` | 太阳能农场 | ☀️ | `solar_farm`, `improvement` | `arid` | 1🪙 2⚙️ 1🔬 | 10⚙️ | 每相邻arid: +1⚙️ (per_each) | ⚙️ |
| `hunting_ground` | 猎场 | 🏹 | `hunting_ground`, `improvement` | `cold` | 1🪙 2🌾 | 8⚙️ | 每2相邻cold: +1🌾 (per_two) | 🌾 |

### 4.2 科技树解锁改良设施（11种）

| ID | 名称 | 图标 | 解锁节点 | 标签 | 放置需求 | 基础产出 | 建造费 | 邻接规则 | 升级主产出 |
|----|------|------|---------|------|---------|---------|--------|---------|-----------|
| `fishery` | 渔场 | 🎣 | S-B | `fishery`, `improvement` | `water` | 2🌾 1🪙 | 8⚙️ | 每相邻reef: +1🪙 (per_each) | 🌾 |
| `quarry` | 采石场 | 🪨 | S-AA | `quarry`, `improvement` | `volcanic` 或 `stone` | 3⚙️ | 10⚙️ | 每相邻mountain: +1⚙️ (per_each) | ⚙️ |
| `lighthouse` | 灯塔 | 🗼 | S-BA | `lighthouse`, `improvement` | `coast` | 1🪙 1🔬 | 10⚙️ | 每相邻water: +1🔬 (per_each) | 🔬 |
| `terrace` | 梯田 | 🪜 | S-BBB | `terrace`, `improvement` | `hill` | 3🌾 | 10⚙️ | 每相邻mountain: +1🌾 (per_each) | 🌾 |
| `observatory` | 天文台 | 🔭 | S-BAA | `observatory`, `improvement` | 需相邻`mountain` | 3🔬 | 12⚙️ | 每相邻mountain: +1🔬 (per_each) | 🔬 |
| `monastery` | 修道院 | ⛪ | F-B | `monastery`, `improvement` | 需相邻`natural` | 2🙏 1🎭 | 8⚙️ | 每相邻natural: +1🙏 (per_each) | 🙏 |
| `hot_spring` | 温泉 | ♨️ | F-AA | `hot_spring`, `improvement` | `geothermal` | 1🙏 1🎭 1🌾 | 8⚙️ | — | 🙏 |
| `sacred_grove` | 圣林 | 🌳 | F-BB | `sacred_grove`, `improvement` | `vegetation` | 1🙏 1🔬 1🎭 | 8⚙️ | — | 🙏 |
| `windmill` | 风车 | 🌀 | P-B | `windmill`, `improvement` | `flat` | 1🌾 2⚙️ | 8⚙️ | — | ⚙️ |
| `vineyard` | 葡萄园 | 🍷 | P-AB | `vineyard`, `improvement` | `fertile` + `hill` | 2🪙 1🎭 | 10⚙️ | 若相邻luxury_resource: +1🪙 (flat_if_any) | 🪙 |
| `bazaar` | 集市 | 🏬 | P-AAB | `bazaar`, `improvement` | `buildable` | 2🪙 1🎭 | 10⚙️ | 每2相邻improvement: +1🪙 (per_two) | 🪙 |

### 4.3 基础区域（5种，开局可用）

| ID | 名称 | 图标 | 标签 | 放置需求 | 基础产出 | 建造费 | 邻接规则 | 升级主产出 |
|----|------|------|------|---------|---------|--------|---------|-----------|
| `campus` | 学院 | 🔬 | `campus`, `district`, `science_district` | `buildable` | 2🔬 | 15⚙️ | 每相邻mountain: +1🔬; 每2相邻vegetation: +1🔬; 每2相邻district: +1🔬 | 🔬 |
| `commercial_hub` | 商业中心 | 💰 | `commercial_hub`, `district`, `gold_district` | `buildable` | 3🪙 | 15⚙️ | 若相邻water: +2🪙; 每2相邻district: +1🪙 | 🪙 |
| `holy_site` | 圣地 | 🙏 | `holy_site`, `district`, `faith_district` | `buildable` | 2🙏 | 15⚙️ | 每相邻mountain: +1🙏; 每相邻natural: +1🙏 | 🙏 |
| `theater_square` | 剧院广场 | 🎭 | `theater_square`, `district`, `culture_district` | `buildable` | 2🎭 | 15⚙️ | 每2相邻district: +1🎭; 每相邻natural: +1🎭 | 🎭 |
| `industrial_zone` | 工业区 | 🏭 | `industrial_zone`, `district`, `production_district` | `buildable` | 2⚙️ | 15⚙️ | 每相邻mine: +1⚙️; 每2相邻district: +1⚙️ | ⚙️ |

> **V2 变更**：剧院广场的区域邻接从 `per_each` 改为 `per_two`，新增 `per_each natural` 规则。

### 4.4 科技树解锁区域（7种）

| ID | 名称 | 图标 | 解锁节点 | 标签 | 放置需求 | 基础产出 | 建造费 | 邻接规则 | 升级主产出 |
|----|------|------|---------|------|---------|---------|--------|---------|-----------|
| `harbor` | 港口 | ⚓ | S-BB | `harbor`, `district`, `gold_district` | `buildable`+需相邻`water` | 3🪙 1🌾 | 15⚙️ | 每相邻water: +1🪙 (per_each) | 🪙 |
| `aqueduct` | 水渠 | 🚰 | S-BBA | `aqueduct`, `district` | `buildable` | 1🌾 1⚙️ | 15⚙️ | 每相邻farm: +1🌾 (per_each); 若相邻water: +2🌾 (flat_if_any) | 🌾 |
| `barracks` | 军营 | ⚔️ | S-ABAA | `barracks`, `district`, `production_district` | `buildable` | 2⚙️ 1🔬 | 15⚙️ | 每相邻industrial_zone: +1⚙️ (per_each) | ⚙️ |
| `entertainment` | 娱乐中心 | 🎪 | P-BA | `entertainment`, `district`, `culture_district` | `buildable` | 1🪙 2🎭 | 15⚙️ | 每2相邻district: +1🎭 (per_two) | 🎭 |
| `government_plaza` | 政府广场 | 🏛️ | P-BAB | `government_plaza`, `district` | `buildable` | 20⚙️ | 1🪙 1🔬 1🎭 | 每相邻district: +1🪙 (per_each) | 🪙 |
| `monastery_district` | 修道院区 | 📿 | F-BA | `monastery_district`, `district`, `faith_district` | `buildable` | 15⚙️ | 2🙏 1🎭 | 每相邻natural: +1🙏 (per_each); 每2相邻district: +1🎭 (per_two) | 🙏 |
| `university` | 大学城 | 🎓 | P-BAAB | `university`, `district`, `science_district` | `buildable` | 20⚙️ | 3🔬 1🎭 | 每相邻campus: +2🔬 (per_each) | 🔬 |

### 4.5 升级系统

- 所有改良和区域可无限升级（maxLevel: 99）
- 升级费用：`baseCost × 2^(currentLevel - 1)`
  - 改良 baseCost = 10⚙️ → 10, 20, 40, 80, 160...
  - 区域 baseCost = 20⚙️ → 20, 40, 80, 160, 320...
- 升级收益（递减边际）：每级 `max(1, floor(4 / sqrt(level - 1)))` 主产出
  - Lv2: +4, Lv3: +2, Lv4: +2, Lv5: +2, Lv6: +1, Lv7+: +1/级

---

## 5. 科技树系统

### 5.1 系统规则

- **三棵独立科技树**：科技树🔬、政策树🎭、信仰树🙏
- **真二叉树结构**：4层，每层二选一，选择决定下层可选节点
- **解锁方式**：对应资源的**累积值**达到阈值后，节点亮起可选。**不消耗资源**。
- **可见性**：只显示已解锁层 + 下一层预览。更深层隐藏（雾化）。
- **商店升级联动**：任意一棵树达到 L2/L3/L4 → 自动升级商店至对应等级。
- 每棵树结构：L1(2节点) + L2(4节点) + L3(8节点) + L4(16节点) = **30节点/棵**

### 5.2 解锁阈值

| 层级 | 科技树 🔬 | 政策树 🎭 | 信仰树 🙏 |
|------|----------|----------|----------|
| L1 | 科技 ≥ 15 | 文化 ≥ 20 | 信仰 ≥ 20 |
| L2 | 科技 ≥ 50 | 文化 ≥ 60 | 信仰 ≥ 60 |
| L3 | 科技 ≥ 120 | 文化 ≥ 140 | 信仰 ≥ 140 |
| L4 | 科技 ≥ 250 | 文化 ≥ 280 | 信仰 ≥ 280 |

### 5.3 节点效果类型

```typescript
type TechEffectType =
  | 'buff_improvement'    // 增强特定改良产出: { target: string, yields: IYields }
  | 'buff_district'       // 增强特定区域产出: { target: string, yields: IYields }
  | 'buff_terrain'        // 增强特定地形产出: { target: string, yields: IYields }
  | 'buff_feature'        // 增强特定地貌产出: { targetTag: string, yields: IYields }
  | 'buff_all_improvements' // 增强所有改良产出: { yields: IYields }
  | 'add_adjacency'       // 给建筑新增邻接规则: { target: string, rule: IAdjacencyRule }
  | 'modify_adjacency'    // 修改已有邻接规则模式: { target: string, matchTag: string, newMode: string }
  | 'terrain_alias'       // 地形标签变换: { terrain: string, addTag: string }
  | 'make_workable'       // 使地形可工作: { terrain: string, yields: IYields }
  | 'unlock_improvement'  // 解锁新改良: { improvementId: string }
  | 'unlock_district'     // 解锁新区域: { districtId: string }
  | 'reduce_cost'         // 降低建造/升级成本: { category: string, percent: number }
  | 'pattern_bonus'       // 图案奖励: { pattern: string, bonus: IYields }
```

### 5.4 科技树 🔬 — 完整节点

主题：征服物质世界（采矿、建造、水利、地形开发）

**分支概览**：
- A支线「大地工程」→ 矿业、火山、山脉、军事
- B支线「水利航海」→ 渔业、港口、灯塔、梯田

| ID | 层 | 父节点 | 名称 | 效果类型 | 效果描述 |
|----|---|--------|------|---------|---------|
| S-A | L1 | — | 石工术 | buff_improvement | 矿山+1⚙️ |
| S-B | L1 | — | 航海术 | unlock_improvement | 解锁「渔场」 |
| S-AA | L2 | S-A | 深层开采 | unlock_improvement | 解锁「采石场」 |
| S-AB | L2 | S-A | 冶金术 | reduce_cost | 改良升级费用-30% |
| S-BA | L2 | S-B | 灯塔工程 | unlock_improvement | 解锁「灯塔」 |
| S-BB | L2 | S-B | 港口规划 | unlock_district | 解锁「港口」区域 |
| S-AAA | L3 | S-AA | 火山冶炼 | buff_terrain | 火山岩+1⚙️+1🔬 |
| S-AAB | L3 | S-AA | 隧道工程 | make_workable | 山脉可工作，产出2⚙️ |
| S-ABA | L3 | S-AB | 标准化生产 | reduce_cost | 区域建造费用-25% |
| S-ABB | L3 | S-AB | 工业改革 | buff_district | 工业区+2⚙️ |
| S-BAA | L3 | S-BA | 天文观测 | unlock_improvement | 解锁「天文台」 |
| S-BAB | L3 | S-BA | 珊瑚研究 | buff_feature | 珊瑚礁(reef)+1🔬+1🪙 |
| S-BBA | L3 | S-BB | 水利工程 | unlock_district | 解锁「水渠」区域 |
| S-BBB | L3 | S-BB | 梯田农业 | unlock_improvement | 解锁「梯田」 |
| S-AAAA | L4 | S-AAA | 地质勘探 | add_adjacency | 采石场每相邻volcanic: +1⚙️ |
| S-AAAB | L4 | S-AAA | 矿脉网络 | add_adjacency | 矿山每相邻mine: +1⚙️ |
| S-AABA | L4 | S-AAB | 山脉学府 | add_adjacency | 学院每相邻mountain: 额外+1🔬 |
| S-AABB | L4 | S-AAB | 高原开发 | buff_terrain | 高原+1⚙️+1🔬 |
| S-ABAA | L4 | S-ABA | 军事工程 | unlock_district | 解锁「军营」区域 |
| S-ABAB | L4 | S-ABA | 高效建材 | reduce_cost | 所有建造费用额外-20% |
| S-ABBA | L4 | S-ABB | 蒸汽动力 | buff_all_improvements | 所有改良+1⚙️ |
| S-ABBB | L4 | S-ABB | 精密仪器 | buff_district | 学院+2🔬 |
| S-BAAA | L4 | S-BAA | 深空探索 | buff_improvement | 天文台+2🔬 |
| S-BAAB | L4 | S-BAA | 海洋科学 | buff_terrain | 浅海+1🔬+1🌾 |
| S-BABA | L4 | S-BAB | 远洋航行 | make_workable | 深海可工作，产出1🔬+1🪙 |
| S-BABB | L4 | S-BAB | 航海图鉴 | add_adjacency | 灯塔每相邻water: 额外+1🔬 |
| S-BBAA | L4 | S-BBA | 大坝工程 | add_adjacency | 水渠每相邻farm: +1🌾 |
| S-BBAB | L4 | S-BBA | 灌溉网络 | add_adjacency | 农田每相邻water: +1🌾 |
| S-BBBA | L4 | S-BBB | 阶梯灌溉 | buff_improvement | 梯田+1🌾+1⚙️ |
| S-BBBB | L4 | S-BBB | 高山水库 | add_adjacency | 梯田每相邻mountain: 额外+1🌾 |

### 5.5 政策树 🎭 — 完整节点

主题：组织文明（商贸、治理、文教、娱乐）

**分支概览**：
- A支线「商贸经济」→ 贸易站、集市、丝路、奢侈品
- B支线「文教治理」→ 风车、娱乐、政府、大学

| ID | 层 | 父节点 | 名称 | 效果类型 | 效果描述 |
|----|---|--------|------|---------|---------|
| P-A | L1 | — | 贸易政策 | buff_improvement | 商站+1🪙 |
| P-B | L1 | — | 风力利用 | unlock_improvement | 解锁「风车」 |
| P-AA | L2 | P-A | 自由贸易 | add_adjacency | 商业中心每相邻trading_post: +1🪙 |
| P-AB | L2 | P-A | 葡萄种植 | unlock_improvement | 解锁「葡萄园」 |
| P-BA | L2 | P-B | 大众娱乐 | unlock_district | 解锁「娱乐中心」 |
| P-BB | L2 | P-B | 文教兴邦 | buff_district | 所有区域+1🎭 |
| P-AAA | L3 | P-AA | 丝路贸易 | buff_terrain | 沙漠+1🪙+1🎭 |
| P-AAB | L3 | P-AA | 东方集市 | unlock_improvement | 解锁「集市」 |
| P-ABA | L3 | P-AB | 酿酒工艺 | buff_improvement | 葡萄园+1🪙+1🎭 |
| P-ABB | L3 | P-AB | 奢侈品税 | buff_feature | 所有luxury_resource额外+1🪙 |
| P-BAA | L3 | P-BA | 节庆文化 | buff_district | 娱乐中心+2🎭 |
| P-BAB | L3 | P-BA | 政府规划 | unlock_district | 解锁「政府广场」 |
| P-BBA | L3 | P-BB | 学术自由 | modify_adjacency | 学院的区域邻接从per_two变为per_each |
| P-BBB | L3 | P-BB | 艺术赞助 | add_adjacency | 剧院每相邻natural: 额外+1🎭 |
| P-AAAA | L4 | P-AAA | 商路帝国 | add_adjacency | 商站每相邻trading_post: +1🪙 |
| P-AAAB | L4 | P-AAA | 海上丝路 | add_adjacency | 港口每相邻commercial_hub: +2🪙 |
| P-AABA | L4 | P-AAB | 市场经济 | buff_improvement | 集市+2🪙 |
| P-AABB | L4 | P-AAB | 垄断贸易 | pattern_bonus | 商业中心被3+商站包围: 该商业中心+3🪙 |
| P-ABAA | L4 | P-ABA | 庄园经济 | add_adjacency | 葡萄园每相邻farm: +1🌾 |
| P-ABAB | L4 | P-ABA | 种植园主 | buff_improvement | 种植园+1🪙+1🎭 |
| P-ABBA | L4 | P-ABB | 奢华殿堂 | add_adjacency | 剧院每相邻luxury_resource: +1🎭 |
| P-ABBB | L4 | P-ABB | 国际都会 | buff_district | 商业中心+1🪙+1🎭+1🔬 |
| P-BAAA | L4 | P-BAA | 全民狂欢 | add_adjacency | 娱乐中心每相邻improvement: +1🎭 |
| P-BAAB | L4 | P-BAA | 大学城 | unlock_district | 解锁「大学城」区域 |
| P-BABA | L4 | P-BAB | 中央集权 | add_adjacency | 政府广场每相邻district: +1⚙️ |
| P-BABB | L4 | P-BAB | 民主议会 | buff_district | 政府广场+2🎭+2🔬 |
| P-BBAA | L4 | P-BBA | 文艺复兴 | buff_district | 剧院+2🎭 |
| P-BBAB | L4 | P-BBA | 博物馆 | buff_feature | 所有natural地貌+1🎭 |
| P-BBBA | L4 | P-BBB | 科教兴国 | buff_district | 学院+1🔬+1🎭 |
| P-BBBB | L4 | P-BBB | 文化遗产 | pattern_bonus | 完整一环的每个地块+1🎭 |

### 5.6 信仰树 🙏 — 完整节点

主题：灵魂与自然（自然崇拜、地形变换、宗教组织）

**分支概览**：
- A支线「自然崇拜」→ 温泉、地热、山岳、沙漠/冰原变换
- B支线「宗教制度」→ 修道院、圣地、圣林、森林信仰

| ID | 层 | 父节点 | 名称 | 效果类型 | 效果描述 |
|----|---|--------|------|---------|---------|
| F-A | L1 | — | 自然崇拜 | buff_feature | 所有natural标签地貌+1🙏 |
| F-B | L1 | — | 修道制度 | unlock_improvement | 解锁「修道院」 |
| F-AA | L2 | F-A | 温泉开发 | unlock_improvement | 解锁「温泉」 |
| F-AB | L2 | F-A | 万物有灵 | terrain_alias | 山脉获得`natural`标签 |
| F-BA | L2 | F-B | 修道院区 | unlock_district | 解锁「修道院区」 |
| F-BB | L2 | F-B | 圣林守护 | unlock_improvement | 解锁「圣林」 |
| F-AAA | L3 | F-AA | 地热神迹 | buff_feature | 地热(geothermal)+1🙏+1🔬 |
| F-AAB | L3 | F-AA | 沙漠绿洲 | terrain_alias | 沙漠获得`fertile`标签 |
| F-ABA | L3 | F-AB | 山岳信仰 | add_adjacency | 圣地每相邻mountain: 额外+1🙏 |
| F-ABB | L3 | F-AB | 冰原圣域 | terrain_alias | 冻土获得`hill`标签 |
| F-BAA | L3 | F-BA | 朝圣之路 | add_adjacency | 修道院区每相邻holy_site: +2🙏 |
| F-BAB | L3 | F-BA | 宗教热忱 | buff_district | 圣地+2🙏 |
| F-BBA | L3 | F-BB | 神圣植林 | buff_improvement | 圣林+1🙏+1🎭 |
| F-BBB | L3 | F-BB | 森林信仰 | buff_feature | 森林(forest)+1🙏+1🌾 |
| F-AAAA | L4 | F-AAA | 火山祭祀 | buff_terrain | 火山岩+1🙏+1⚙️ |
| F-AAAB | L4 | F-AAA | 温泉文化 | buff_improvement | 温泉+1🙏+1🎭 |
| F-AABA | L4 | F-AAB | 圣山 | make_workable | 山脉可工作，产出2🙏 |
| F-AABB | L4 | F-AAB | 荒漠圣者 | buff_terrain | 沙漠+1🙏+1🌾 |
| F-ABAA | L4 | F-ABA | 高山祭坛 | add_adjacency | 圣地每相邻mountain: 额外+1🙏(与现有叠加) |
| F-ABAB | L4 | F-ABA | 极地探索 | make_workable | 冰原可工作，产出1🙏+1🌾 |
| F-ABBA | L4 | F-ABB | 神秘力量 | buff_feature | 所有natural标签地貌额外+1🙏 |
| F-ABBB | L4 | F-ABB | 高原牧歌 | buff_terrain | 高原+1🙏+1🌾 |
| F-BAAA | L4 | F-BAA | 宗教统治 | buff_district | 修道院区+2🙏+1⚙️ |
| F-BAAB | L4 | F-BAA | 苦行修炼 | add_adjacency | 修道院每相邻mountain: +1🙏 |
| F-BABA | L4 | F-BAB | 圣战 | buff_district | 圣地+1🙏+1⚙️ |
| F-BABB | L4 | F-BAB | 先知降临 | pattern_bonus | 圣地被3+natural地貌包围: 该圣地+3🙏 |
| F-BBAA | L4 | F-BBA | 世界树 | buff_improvement | 圣林+2🙏+1🔬 |
| F-BBAB | L4 | F-BBA | 老林崇拜 | buff_feature | 老林(old_growth)+1🙏+1🔬 |
| F-BBBA | L4 | F-BBB | 森林圣域 | buff_feature | 森林(forest)+1🙏+1⚙️ |
| F-BBBB | L4 | F-BBB | 自然和谐 | buff_feature | 所有vegetation标签+1🙏+1🌾 |

### 5.7 交叉路线示例

不同树的组合可以创造独特的 build：

| 组合 | 路线 | 特色 |
|------|------|------|
| 山脉帝国 | S-AAB(山脉可工作) + F-AABA(山脉产信仰) + F-AB(山脉=natural) | 山脉变成全能地块 |
| 海洋文明 | S-B→BB(渔场+港口) + P-AAAB(海上丝路) | 水域经济最大化 |
| 沙漠奇迹 | F-AAB(沙漠变fertile) + P-AAA(沙漠+金+文化) | 垃圾地形变宝地 |
| 森林王国 | F-BB→BBA→BBBA(圣林+森林buff) + P-BBB(剧院+natural) | 植被全面强化 |
| 工业帝国 | S-A→AB→ABB(工业区+2) + S-ABBA(所有改良+1⚙️) | 生产力最大化 |

---

## 6. 尤里卡系统

尤里卡（Eureka）为特定条件触发的阈值减免，降低某棵科技树某层的解锁门槛。

| ID | 触发条件 | 效果 | 关联树/层 |
|----|---------|------|----------|
| `eureka_farms_3` | 拥有 3+ 农田 | 科技树 L2 阈值 -30% | 🔬 L2 |
| `eureka_first_district` | 建造第一个区域 | 政策树 L1 阈值 -50% | 🎭 L1 |
| `eureka_pop_5` | 人口达到 5 | 信仰树 L2 阈值 -30% | 🙏 L2 |
| `eureka_ring_complete` | 完成一整环地块 | 三棵树当前层阈值 -20% | 全部 当前 |
| `eureka_3_districts` | 拥有 3+ 不同区域类型 | 政策树 L3 阈值 -30% | 🎭 L3 |
| `eureka_mountain_adj` | 任意建筑旁有 3+ 山脉 | 科技树 L3 阈值 -30% | 🔬 L3 |
| `eureka_water_tiles_5` | 拥有 5+ 水域地块 | 科技树 L2 阈值 -30% | 🔬 L2 |
| `eureka_culture_50` | 累积文化达到 50 | 政策树 L2 阈值 -30% | 🎭 L2 |
| `eureka_faith_50` | 累积信仰达到 50 | 信仰树 L2 阈值 -30% | 🙏 L2 |
| `eureka_tiles_15` | 已工作地块达到 15 | 三棵树 L3 阈值 -20% | 全部 L3 |
| `eureka_pop_10` | 人口达到 10 | 信仰树 L3 阈值 -30% | 🙏 L3 |
| `eureka_2_improvements` | 拥有 2+ 种不同改良类型 | 科技树 L1 阈值 -50% | 🔬 L1 |
| `eureka_luxury_3` | 拥有 3+ 不同奢侈资源 | 政策树 L3 阈值 -25% | 🎭 L3 |
| `eureka_natural_5` | 拥有 5+ natural标签地块 | 信仰树 L3 阈值 -30% | 🙏 L3 |
| `eureka_score_200` | 当前得分达到 200 | 三棵树 L4 阈值 -15% | 全部 L4 |

---

## 7. 商店系统

### 7.1 基本规则

- 商店只出售**地块卡牌**（地形+可选地貌+可选资源的组合）
- 每回合自动刷新（锁定的卡保留）
- 手动刷新花费 2🪙/次，**每回合上限 3 次**（可配置 `maxRerollsPerTurn`）
- 每次显示 4 张卡牌（可配置 `shopCardCount`）
- 可锁定卡牌（锁定的卡在刷新时保留）

### 7.2 商店等级

商店等级由科技树进度自动升级：

| 商店等级 | 解锁条件 | T1权重 | T2权重 | T3权重 |
|---------|---------|--------|--------|--------|
| Lv.1 | 初始 | 70% | 25% | 5% |
| Lv.2 | 任意树达L2 | 40% | 45% | 15% |
| Lv.3 | 任意树达L3 | 15% | 45% | 40% |
| Lv.4 | 任意树达L4 | 5% | 30% | 65% |

### 7.3 商店卡池

#### Tier 1 — 基础地块（6种）

| 名称 | 费用 | 地形 | 地貌 | 资源 | 权重 |
|------|------|------|------|------|------|
| 草地 | 2🪙 | grassland | — | — | 10 |
| 平原 | 2🪙 | plains | — | — | 10 |
| 沙漠 | 1🪙 | desert | — | — | 5 |
| 冻土 | 1🪙 | tundra | — | — | 4 |
| 稀树草原 | 2🪙 | savanna | — | — | 6 |
| 高原 | 2🪙 | plateau | — | — | 5 |

#### Tier 2 — 加成地块（14种）

| 名称 | 费用 | 地形 | 地貌 | 资源 | 权重 |
|------|------|------|------|------|------|
| 草地丘陵 | 3🪙 | grassland | hills | — | 7 |
| 平原丘陵 | 3🪙 | plains | hills | — | 7 |
| 草地森林 | 3🪙 | grassland | forest | — | 7 |
| 平原森林 | 3🪙 | plains | forest | — | 5 |
| 雨林 | 3🪙 | grassland | rainforest | — | 4 |
| 山脉 | 4🪙 | mountain | — | — | 5 |
| 湖泊 | 3🪙 | lake | — | — | 4 |
| 浅海 | 3🪙 | coast | — | — | 4 |
| 火山岩 | 4🪙 | volcanic | — | — | 4 |
| 河谷 | 4🪙 | river_valley | — | — | 3 |
| 小麦草地 | 3🪙 | grassland | — | wheat | 4 |
| 石材丘陵 | 4🪙 | plains | hills | stone | 4 |
| 鱼群浅海 | 4🪙 | coast | — | fish | 3 |
| 马匹草原 | 4🪙 | savanna | — | horses | 3 |

#### Tier 3 — 稀有地块（16种）

| 名称 | 费用 | 地形 | 地貌 | 资源 | 权重 |
|------|------|------|------|------|------|
| 绿洲 | 5🪙 | desert | oasis | — | 3 |
| 宝石丘陵 | 5🪙 | grassland | hills | gems | 3 |
| 丝绸森林 | 5🪙 | plains | forest | silk | 3 |
| 乳香沙漠 | 4🪙 | desert | — | incense | 3 |
| 珊瑚浅海 | 5🪙 | coast | reef | — | 3 |
| 地热火山 | 5🪙 | volcanic | geothermal | — | 3 |
| 远古遗迹 | 6🪙 | plains | — | ancient_ruins | 2 |
| 圣地遗址 | 5🪙 | grassland | — | holy_site_relic | 2 |
| 洪泛河谷 | 5🪙 | river_valley | floodplain | — | 3 |
| 老林 | 5🪙 | grassland | old_growth | — | 2 |
| 香料雨林 | 5🪙 | savanna | rainforest | spices | 2 |
| 葡萄丘陵 | 5🪙 | plains | hills | grapes | 2 |
| 大理石高原 | 5🪙 | plateau | cliff | marble | 2 |
| 珍珠浅海 | 6🪙 | coast | reef | pearls | 2 |
| 琥珀老林 | 6🪙 | grassland | old_growth | amber | 2 |
| 茶叶丘陵 | 6🪙 | grassland | hills | tea | 2 |

---

## 8. 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `maxTurns` | 40 | 总回合数 |
| `startingGold` | 10 | 初始金币 |
| `startingPopulation` | 1 | 初始人口 |
| `foodPerPop` | 8 | 增长所需净食物 |
| `foodPerPopConsumption` | 2 | 每人口食物消耗 |
| `shopCardCount` | 4 | 商店显示卡牌数 |
| `rerollCost` | 2 | 刷新费用(金币) |
| `maxRerollsPerTurn` | 3 | 每回合刷新上限 |
| `productionPerUpgrade` | 10 | 改良升级基础费用 |
| `districtUpgradeCost` | 20 | 区域升级基础费用 |
| `sellRefundRatio` | 0.5 | 出售退还比例 |
| `hexRings` | 4 | 棋盘环数(含中心) |
| `victoryGoalType` | 'score' | 胜利目标类型 |
| `victoryGoalTarget` | 800 | 胜利目标值 |

---

## 9. 移除的旧系统

以下 V1 系统在 V2 中完全移除：

| 移除项 | 原功能 | 替代方案 |
|--------|--------|---------|
| 道具商店 | 花金币/文化/信仰进入，随机抽3选1 | 科技树（确定性分支选择） |
| `flat_per_turn` 道具 | 每回合固定加产出 | 科技树 buff 效果（经过地块） |
| `yield_percent` 道具 | 全局百分比加成 | 移除，无替代（设计原则不允许） |
| `instant` 道具 | 一次性资源注入 | 移除，无替代 |
| `convert_yield` 道具 | 资源转化 | 移除，无替代 |
| `pop_growth` 道具 | 直接+1人口 | 移除，无替代 |
| 科技值升级商店 | 花科技值手动升级商店 | 科技树自动升级（任意树达L2/L3/L4） |
| `items.ts` 全部道具定义 | 48个道具 | 删除 |
| 道具效果计算 | `applyItemEffects()` | 科技树效果在地块产出中直接体现 |

---

## 附录 A：邻接规则汇总

### 基础改良邻接

| 改良 | 匹配标签 | 模式 | 加成 |
|------|---------|------|------|
| 农田 | `farm` | per_each | +1🌾 |
| 矿山 | `mine` | per_two | +1⚙️ |
| 商站 | `district` | per_each | +1🪙 |
| 种植园 | `luxury_resource` | flat_if_any | +1🪙 |
| 太阳能 | `arid` | per_each | +1⚙️ |
| 猎场 | `cold` | per_two | +1🌾 |

### 解锁改良邻接

| 改良 | 匹配标签 | 模式 | 加成 |
|------|---------|------|------|
| 渔场 | `reef` | per_each | +1🪙 |
| 采石场 | `mountain` | per_each | +1⚙️ |
| 灯塔 | `water` | per_each | +1🔬 |
| 梯田 | `mountain` | per_each | +1🌾 |
| 天文台 | `mountain` | per_each | +1🔬 |
| 修道院 | `natural` | per_each | +1🙏 |
| 葡萄园 | `luxury_resource` | flat_if_any | +1🪙 |
| 集市 | `improvement` | per_two | +1🪙 |

### 基础区域邻接

| 区域 | 匹配标签 | 模式 | 加成 |
|------|---------|------|------|
| 学院 | `mountain` | per_each | +1🔬 |
| 学院 | `vegetation` | per_two | +1🔬 |
| 学院 | `district` | per_two | +1🔬 |
| 商业中心 | `water` | flat_if_any | +2🪙 |
| 商业中心 | `district` | per_two | +1🪙 |
| 圣地 | `mountain` | per_each | +1🙏 |
| 圣地 | `natural` | per_each | +1🙏 |
| 剧院 | `district` | per_two | +1🎭 |
| 剧院 | `natural` | per_each | +1🎭 |
| 工业区 | `mine` | per_each | +1⚙️ |
| 工业区 | `district` | per_two | +1⚙️ |

### 解锁区域邻接

| 区域 | 匹配标签 | 模式 | 加成 |
|------|---------|------|------|
| 港口 | `water` | per_each | +1🪙 |
| 水渠 | `farm` | per_each | +1🌾 |
| 水渠 | `water` | flat_if_any | +2🌾 |
| 军营 | `industrial_zone` | per_each | +1⚙️ |
| 娱乐中心 | `district` | per_two | +1🎭 |
| 政府广场 | `district` | per_each | +1🪙 |
| 修道院区 | `natural` | per_each | +1🙏 |
| 修道院区 | `district` | per_two | +1🎭 |
| 大学城 | `campus` | per_each | +2🔬 |
