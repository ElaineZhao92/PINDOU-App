# 我嘞个豆 · PINDOU App

> 拼豆库存管理 & 图纸追踪工具 —— 再也不怕关键颜色断货！

---

## 一、项目概述

**我嘞个豆** 是一个面向拼豆爱好者的 Web 应用，核心目标是：

- 上传图纸图片，由 AI 自动识别所需色号和数量
- 记录并管理个人豆子库存，智能提示库存不足
- 存档已完成的图纸，追踪每个作品的用豆历史

支持多端响应式布局（手机 / 平板 / 桌面），部署在 GitHub Pages，数据存储在云端，多用户之间完全隔离。

---

## 二、核心功能设计

### 2.1 库存管理页（Inventory）

拼豆主流色系以字母+数字编码，例如 `A01`、`C15`，共约 221 色。

**功能细节：**
- 以色板网格形式展示全部 221 色，每格显示色块、色号、当前库存数量
- 支持按色系字母分组筛选（A 系 / B 系 / C 系……）
- 点击某个色格可直接编辑数量（支持加减按钮 + 直接输入）
- 库存低于阈值（默认 50 粒，可自定义）时，色格出现橙色警告角标
- 支持批量导入：用户可粘贴 CSV 格式数据一次性更新多个颜色库存
- 页面顶部展示"库存警告汇总"：有多少种颜色即将不足

### 2.2 图纸分析页（Analyze）

**核心流程：**

```
用户上传图纸图片
        ↓
前端压缩图片 + 上传到 Supabase Storage
        ↓
调用 Supabase Edge Function（服务端代理）
        ↓
Edge Function 调用 LLM API（key 安全存于服务端）
        ↓
LLM 返回 JSON：[{color_code: "A01", quantity: 120}, ...]
        ↓
前端对比当前库存，高亮不足的颜色
        ↓
用户确认后，从库存中扣除 / 记录为"进行中图纸"
```

**页面展示：**
- 上传区：拖拽或点击上传，支持 JPG / PNG / WEBP
- 识别结果：以表格展示各色号 + 需要数量 + 当前库存 + 差额
- 差额为负（库存不足）的行以红色标出，一键跳转补货备忘
- 用户可手动修正 AI 识别结果（LLM 不会100%准确）
- 给图纸起名后，一键存入图纸档案

### 2.3 图纸档案页（Archive）

已完成或进行中的图纸记录：

- 瀑布流 / 网格展示图纸缩略图
- 每张卡片显示：图纸名称、完成日期、状态（进行中 / 已完成）、用豆总数
- 点击图纸可查看详情：完整用豆清单、图纸原图、备注
- 支持标签分类（动物 / 游戏 / 风景……）
- 搜索 & 按完成时间 / 用豆数排序

### 2.4 仪表盘首页（Dashboard）

登录后的默认页，一览关键信息：

- 库存警告列表（最需要补货的颜色 Top 10）
- 最近的图纸进度
- 累计用豆统计（所有颜色总计）
- 快捷入口：「分析新图纸」「更新库存」

### 2.5 用户系统（Auth）

- 邮箱 + 密码注册 / 登录（Supabase Auth 内置）
- 可选：第三方登录（GitHub / Google）
- 每个用户的数据完全隔离（Row Level Security）
- 简单的个人设置页（改名、修改低库存阈值默认值）

---

## 三、技术栈选型

### 前端

| 技术 | 选型 | 理由 |
|------|------|------|
| 框架 | **React + TypeScript + Vite** | 生态完善，Vite 打包快，TS 类型安全 |
| 样式 | **Tailwind CSS** | 响应式工具类，手机/桌面适配方便 |
| 路由 | **React Router v6** | SPA 路由 |
| 状态管理 | **Zustand** | 轻量，比 Redux 简单，适合此项目体量 |
| UI 组件 | **shadcn/ui** | 基于 Radix UI，无样式侵入，可完全定制 |
| 图片上传 | **react-dropzone** | 拖拽上传 |
| 表格 | **TanStack Table** | 强大的库存表格 |

### 后端 / 数据库

| 技术 | 选型 | 理由 |
|------|------|------|
| BaaS | **Supabase** | 免费额度足够，PostgreSQL + Auth + Storage + Edge Functions 一体化 |
| 图片存储 | **Supabase Storage** | 图纸原图存储 |
| 服务端函数 | **Supabase Edge Functions**（Deno） | 代理 LLM 调用，API key 安全存于服务端 |

### AI 图像识别

| 方案 | 说明 |
|------|------|
| **GitHub Models（推荐）** | 见下方详解 |
| 备选：Google Gemini Flash | 免费额度大，速度快，支持视觉 |

### 部署

- 前端：**GitHub Pages**（通过 GitHub Actions 自动部署）
- 后端：**Supabase 云**（免费 Starter 计划）

---

## 四、关键问题解答

### Q1：豆子数量数据库如何管理？

**不推荐 CSV 方案**，原因：多用户场景下 CSV 无法并发写入，且无法做权限隔离。

推荐用 **Supabase PostgreSQL** 存储，结构清晰且支持实时同步：

```
bead_colors（参考表，随应用发布，不随用户变化）
  color_code   TEXT PRIMARY KEY   -- 如 "A01"
  color_name   TEXT               -- 颜色名称
  hex_value    TEXT               -- 用于显示色块，如 "#FF5733"
  brand        TEXT               -- 品牌（哈马/艺珂/等）

bead_inventory（每个用户的库存，一行 = 一种颜色）
  id           UUID
  user_id      UUID               -- 关联用户
  color_code   TEXT               -- 关联 bead_colors
  quantity     INT                -- 当前数量
  low_threshold INT DEFAULT 50    -- 低库存警告线
  updated_at   TIMESTAMP
```

初始的 221 色参考数据（color_code + hex）以 **JSON 文件**打包进前端，第一次登录时自动初始化用户的库存记录（数量全为 0）。

### Q2：部署到 GitHub Pages 时如何管理远程数据库？

架构如下：

```
用户浏览器
    ↕ HTTPS
GitHub Pages（React 静态前端）
    ↕ Supabase JS SDK
Supabase 云服务
    ├── PostgreSQL 数据库（用户数据隔离，Row Level Security）
    ├── Auth 服务（JWT token 鉴权）
    ├── Storage（图纸图片）
    └── Edge Functions（代理 LLM 请求）
```

Supabase 的 **Row Level Security（RLS）** 保证每个用户只能读写自己的数据：

```sql
-- 示例策略：用户只能看到自己的库存
CREATE POLICY "Users see own inventory"
ON bead_inventory FOR ALL
USING (auth.uid() = user_id);
```

Supabase 免费计划限额：
- 数据库 500MB（足够）
- 存储 1GB（图片可压缩后上传）
- Edge Function 调用 500k 次/月（足够）

### Q3：LLM 调用方案 —— 如何避免暴露 API Key？

**推荐方案：GitHub Models + Supabase Edge Function 代理**

**为什么选 GitHub Models：**
- 完全免费（目前 Preview 阶段，每天有免费额度）
- 可用 GPT-4o、GPT-4o mini 等主流模型（支持视觉/多模态）
- 用 GitHub Personal Access Token（PAT）鉴权，不需要 OpenAI 账户

**为什么安全（key 不会暴露）：**

```
前端（浏览器）
    ↓ 只传图片 URL + 用户 JWT（无 key）
Supabase Edge Function（服务端，Deno 运行环境）
    ↓ 从 Supabase Secrets 读取 GITHUB_TOKEN
GitHub Models API（gpt-4o）
    ↓ 返回识别结果
前端
```

GitHub Token 存在 **Supabase Secrets**（类似环境变量），前端代码中永远看不到 key。

**Edge Function 核心逻辑（伪代码）：**

```typescript
// supabase/functions/analyze-pattern/index.ts
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN"); // 从 Secrets 读取

// 调用 GitHub Models（兼容 OpenAI SDK 格式）
const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "分析这张拼豆图纸，返回每种颜色的色号和数量，格式为 JSON 数组..." },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }],
  }),
});
```

**备选 LLM 方案（如 GitHub Models 额度不够）：**
- Google Gemini 1.5 Flash：每天 1500 次免费调用，同样可代理
- Cloudflare AI（Workers AI）：完全免费，有视觉模型，但识别质量稍弱

---

## 五、数据模型完整设计

```sql
-- 参考颜色表（随代码发布，221条固定数据）
CREATE TABLE bead_colors (
  color_code   TEXT PRIMARY KEY,
  color_name   TEXT NOT NULL,
  hex_value    TEXT NOT NULL,
  brand        TEXT DEFAULT 'generic'
);

-- 用户库存表
CREATE TABLE bead_inventory (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users NOT NULL,
  color_code    TEXT REFERENCES bead_colors NOT NULL,
  quantity      INT NOT NULL DEFAULT 0,
  low_threshold INT NOT NULL DEFAULT 50,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, color_code)
);

-- 图纸表
CREATE TABLE patterns (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users NOT NULL,
  name          TEXT NOT NULL,
  image_url     TEXT,              -- Supabase Storage URL
  status        TEXT DEFAULT 'in_progress', -- in_progress / completed
  tags          TEXT[],
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 图纸用豆明细表
CREATE TABLE pattern_beads (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_id    UUID REFERENCES patterns NOT NULL,
  color_code    TEXT REFERENCES bead_colors NOT NULL,
  quantity      INT NOT NULL,      -- AI 识别或用户调整后的用量
  UNIQUE (pattern_id, color_code)
);

-- RLS 策略（所有用户表均启用）
ALTER TABLE bead_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_beads ENABLE ROW LEVEL SECURITY;
```

---

## 六、页面路由规划

```
/                   → 未登录：Landing Page；已登录：Dashboard
/login              → 登录 / 注册
/inventory          → 库存管理页
/analyze            → 图纸分析页（上传 + AI 识别）
/archive            → 图纸档案页
/archive/:id        → 图纸详情页
/settings           → 用户设置
```

---

## 七、响应式设计策略

使用 Tailwind 断点：

| 断点 | 设备 | 布局特点 |
|------|------|----------|
| `< 640px` | 手机 | 单列，底部 Tab 导航，库存色格 5列 |
| `640–1024px` | 平板 | 侧边栏折叠，库存色格 8列 |
| `> 1024px` | 桌面 | 固定侧边栏导航，库存色格 12列 |

---

## 八、开发阶段规划

### Phase 1 — 基础骨架
- [ ] Vite + React + TypeScript 项目初始化
- [ ] Tailwind + shadcn/ui 配置
- [ ] Supabase 项目创建，数据库表结构建立
- [ ] 用户注册 / 登录（Supabase Auth）
- [ ] 路由框架搭建，响应式导航

### Phase 2 — 库存核心功能
- [ ] 221 色参考数据录入（JSON）
- [ ] 库存页色板展示（带颜色、色号、数量）
- [ ] 库存编辑（单个 + 批量导入）
- [ ] 低库存警告逻辑

### Phase 3 — AI 图纸分析
- [ ] Supabase Edge Function 搭建（LLM 代理）
- [ ] 图片上传 + Storage 集成
- [ ] 图纸分析结果展示 + 用户修正
- [ ] 确认扣除库存

### Phase 4 — 图纸档案
- [ ] 图纸列表 / 详情页
- [ ] 标签系统
- [ ] 完成状态管理

### Phase 5 — 部署 & 优化
- [ ] GitHub Actions 自动部署到 GitHub Pages
- [ ] 性能优化（图片懒加载、列表虚拟化）
- [ ] PWA 支持（手机端可添加到主屏幕）

---

## 九、项目结构（预期）

```
PINDOU-App/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── BeadColorGrid/   # 色板网格
│   │   ├── PatternCard/     # 图纸卡片
│   │   └── InventoryEditor/ # 库存编辑器
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── Inventory.tsx
│   │   ├── Analyze.tsx
│   │   ├── Archive.tsx
│   │   └── Settings.tsx
│   ├── store/               # Zustand 状态
│   ├── lib/
│   │   ├── supabase.ts      # Supabase 客户端
│   │   └── beadColors.ts    # 221色参考数据
│   └── hooks/               # 自定义 Hooks
├── supabase/
│   ├── functions/
│   │   └── analyze-pattern/ # Edge Function
│   └── migrations/          # SQL 迁移文件
└── public/
    └── bead-colors.json     # 221色数据
```

---

## 十、注意事项

1. **LLM 识别局限性**：AI 识别图纸颜色只是辅助，用户必须能手动修正数量，不能完全依赖 AI。
2. **颜色标准问题**：不同品牌（哈马 Hama / 艺珂 Artkal）色号体系不同，初期可只支持一个品牌，后续扩展。
3. **图片质量要求**：建议在 UI 上提示用户上传清晰的正面图纸（非实物照片），识别效果更好。
4. **离线支持**：GitHub Pages 纯静态，可考虑 PWA + Service Worker 缓存色板数据，弱网下也能查看库存。