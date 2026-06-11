<p align="center">
  <img src="assets/Anriod.svg" alt="Anriod" width="400">
</p>

<h1 align="center">Anriod</h1>

<p align="center">
  <b>All Narratives Recorded In Orderly Detail.</b>
</p>

<p align="center">
  <a href="https://github.com/LiangYin233/Anriod/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </a>
  <a href="https://bun.sh">
    <img src="https://img.shields.io/badge/runtime-Bun-%23f9f1e1" alt="Bun">
  </a>
  <a href="https://vuejs.org/">
    <img src="https://img.shields.io/badge/frontend-Vue%203-4FC08D" alt="Vue 3">
  </a>
  <a href="https://v2.tauri.app/">
    <img src="https://img.shields.io/badge/desktop-Tauri%202-%23FFC131" alt="Tauri 2">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20|%20macOS%20|%20Linux-lightgrey" alt="Platform">
</p>

<p align="center">跨平台个人媒体观看记录管理。<br>追踪动画、电影、剧集、游戏、小说、漫画的进度。</p>

---

## 快速开始

```bash
# 安装依赖
bun install

# 启动后端
bun dev:backend          # http://localhost:8000

# 启动前端
bun dev:frontend         # http://localhost:5173
```

首次使用在设置页配置后端地址 `http://localhost:8000` 和 API Key（见 `config.yaml`）。

## 功能

- **媒体库** — 网格展示、筛选排序、分页
- **详情页** — 元数据编辑、集数平铺、逐集笔记
- **搜索导入** — Bangumi 数据源一键导入
- **观看记录** — 每集独立时间线、按月分组
- **统计分析** — Chart.js 可视化、评分分布
- **定时同步** — 可配置 cron，自动更新评分/集数
- **数据导入/导出** — JSON 格式热备份

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Bun + Hono + SQLite (Drizzle ORM) |
| 前端 | Vue 3 + Tailwind CSS + Chart.js |
| 桌面 | Tauri 2.x |
| 数据源 | Bangumi v0 API |

## 项目结构

```
packages/
├── shared/          # 前后端共享类型
├── backend/         # Bun 后端
│   └── src/
│       ├── routes/      # API 路由
│       ├── services/    # 业务逻辑
│       ├── datasources/ # 数据源模块
│       └── utils/       # 工具
└── frontend/        # Vue 前端
    └── src/
        ├── views/       # 页面
        ├── components/  # 组件
        └── composables/ # 组合式函数
```

## 配置

复制 `config.example.yaml` 为 `config.yaml`：

```yaml
auth:
  api_key: "your-secret-key-here"

sync:
  cron: "0 3 * * *"    # 设为 "" 禁用

proxy: ""               # HTTP 代理

datasources:
  bangumi:
    bgm_token: ""       # Bangumi access token (可选)
```

## 编译

```bash
# 后端编译为单文件
bun build:backend      # → anriod.exe

# 前端编译
bun build:frontend     # → dist/

# Tauri 桌面端（需要 Rust）
bun tauri build
```

## License

MIT
