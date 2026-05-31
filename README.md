# 我嘞个豆 · PINDOU

> 拼豆爱好者的全能助手 —— 库存管理、图纸生成、AI 识别，一站搞定

[![Deploy to GitHub Pages](https://github.com/ElaineZhao92/PINDOU-App/actions/workflows/deploy.yml/badge.svg)](https://github.com/ElaineZhao92/PINDOU-App/actions/workflows/deploy.yml)

**🌐 在线体验：[https://elainezhao92.github.io/PINDOU-App](https://elainezhao92.github.io/PINDOU-App)**

---

## What's this?

PINDOU 是一个免费开源的拼豆管理 Web 应用，专为拼豆爱好者设计。注册账号即可使用，数据存储在云端，手机、平板、电脑均可访问。

核心解决的痛点：
- 拼到一半发现某个颜色没豆了 → **库存实时追踪 + 低库存预警**
- 买了图纸不知道要用多少颜色 → **AI 自动识别图纸色号和用量**
- 自己有图片想转成拼豆图纸 → **一键生成像素化拼豆图纸**
- 做完的作品没有记录 → **图纸档案管理，支持文件夹分类**

---

## Function Introduction

### 🏠 主页
- 库存不足预警（快速定位缺货颜色）
- 最近图纸进度一览
- 总豆子数、追踪颜色数等统计数据

### 🎨 生成图纸
上传任意图片，自动转换为可用于拼豆的像素图纸：
- 支持 32×32 / 52×52 / 72×72 / 104×104 / 148×148 等多种尺寸
- 基于 CIELAB 色彩空间，从 221 种颜色中精准匹配最接近的色号
- 生成的图纸每个格子标注色号（如 A3、C15），方便对照拼装
- 支持下载带色号标注的高清图纸，或直接保存到图纸档案

### 📥 导入图纸
上传图纸照片，AI 自动识别需要哪些颜色、各要多少颗：
- 支持同时上传多张图（分别识别后合并汇总）
- 可手动修改 AI 识别的数量
- 一键与当前库存对比，显示缺多少
- 确认后自动从库存扣除，并保存到图纸档案

> **需要配置 OpenRouter API Key，详见下方说明**

### 📦 豆子库存
以色板网格形式管理全部 221 种颜色的库存：
- 点击色格直接编辑数量，支持正数、负数（欠库存记录）
- 按色系筛选（A~H/M 系列）
- 低库存颜色自动标注橙色警告（阈值可自定义）
- 批量操作：全系列统一增减/设置数量
- 操作历史与撤销功能

### 🗂️ 图纸档案
- 网格展示所有已保存图纸的缩略图
- 支持文件夹分类（拖拽排序，自动配色）
- 批量选择：批量删除、批量改状态、批量移入文件夹
- 点击图纸查看完整用珠明细（色号 + 数量 + 颜色预览）

---

## Quick Start

### 直接使用（推荐）

1. 打开 [https://elainezhao92.github.io/PINDOU-App](https://elainezhao92.github.io/PINDOU-App)
2. 注册账号（邮箱 + 密码）
3. 进入**豆子库存**页面，开始录入你的库存数量

如果要使用 **AI 导入图纸** 功能，还需要配置 OpenRouter API Key（见下方）。

---

## 配置 OpenRouter API Key

「导入图纸」功能需要调用 AI 模型（Google Gemini 2.0 Flash）来识别图纸中的色号和用量。

### 获取 Key

1. 前往 [https://openrouter.ai](https://openrouter.ai) 注册账号（支持 Google 登录）
2. 进入 **Keys** 页面，点击 **Create Key**
3. 复制生成的 Key（格式为 `sk-or-v1-...`）
4. 在 PINDOU 的**设置页**粘贴并保存

Key 会加密存储在你的账号下，不会泄露给其他用户使用。

### ⚠️ 预防API key泄露

为防止api key存储在数据库中泄露，建议为OpenRouter的key**设置消费上限**：登录 OpenRouter 后，进入 **Settings → Limits** 设置 **Spending Limit**（如 $5 或 $10）

---

## 本地开发 / 自部署

如果你想在本地运行或二次开发：

### 环境要求
- Node.js 18+
- 一个 [Supabase](https://supabase.com) 项目（免费计划即可）
- 一个 OpenRouter 账号（用于 AI 功能）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ElaineZhao92/PINDOU-App.git
cd PINDOU-App

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Supabase 项目 URL 和 anon key

# 4. 启动开发服务器
npm run dev
```

### 环境变量

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 数据库

在 Supabase 控制台的 SQL Editor 中执行`supabase/migrations/`下三个sql文件以创建表。

### 部署到 GitHub Pages

1. Fork 此仓库
2. 在仓库 **Settings → Secrets and variables → Actions** 中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 推送到 `main` 分支，GitHub Actions 会自动构建并部署

