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

- **媒体库** — 网格/紧凑双视图、多条件筛选（类型/状态/来源/标签/日期/集数）、排序、分页、进度快速标记
- **详情页** — 元数据编辑、集数/章节网格、逐集笔记、观看历史时间线、数据源同步、外部浏览器打开
- **发现** — 浏览 Bangumi 今日放送、TMDB Trending 热门影视，一键跳转预览
- **作品预览** — 从发现/搜索结果查看作品详情、简介、演职员表（声优/演员/制作人员），一键导入媒体库
- **搜索导入** — Bangumi / TMDB 数据源搜索，一键导入，支持手动添加
- **观看记录** — 每集独立时间线、按月分组、逐条管理
- **统计分析** — Chart.js 可视化仪表盘（状态分布、类型分布、观看趋势、评分分布、标签云）
- **小说/漫画章节支持** — 自动识别媒体类型，进度字段适配 chapter/episode
- **定时同步** — 可配置 cron，自动更新评分/集数
- **数据导入/导出** — JSON 格式热备份
- **桌面端** — Tauri 2 无框窗口、自定义标题栏、系统托盘

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Bun + Hono + SQLite (bun:sqlite) |
| 前端 | Vue 3 + Vue Router + Tailwind CSS + Chart.js |
| 桌面 | Tauri 2.x |
| 数据源 | Bangumi v0 API + TMDB v3 API |

## 项目结构

```
packages/
├── shared/              # 前后端共享类型
│   └── src/types.ts
├── backend/             # Bun 后端
│   ├── config.example.yaml
│   └── src/
│       ├── index.ts          # 入口，路由注册
│       ├── config.ts         # 配置加载
│       ├── routes/           # API 路由
│       │   ├── media.ts      #   媒体 CRUD、进度、状态、导入、同步
│       │   ├── history.ts    #   观看历史
│       │   ├── search.ts     #   外部搜索、详情、演职员表
│       │   ├── discover.ts   #   发现页（缓存至 24:00）
│       │   ├── tag.ts        #   标签管理
│       │   ├── backup.ts     #   数据导入/导出
│       │   ├── sync.ts       #   定时同步触发
│       │   └── statistics.ts #   统计分析
│       ├── services/         # 业务逻辑
│       ├── datasources/      # 数据源适配（Bangumi / TMDB）
│       ├── middleware/       # 认证、错误处理
│       ├── utils/            # 工具函数、代理检测、下载队列
│       ├── db/               # SQLite 初始化、查询辅助
│       └── test/             # 后端测试（115 个用例）
└── frontend/            # Vue 前端
    └── src/
        ├── main.ts           # 入口
        ├── App.vue           # 布局、侧边栏、主题切换
        ├── router/           # 路由配置
        ├── views/            # 页面
        │   ├── Home.vue          # 媒体库（筛选/排序/分页）
        │   ├── MediaDetail.vue   # 详情（编辑/进度/笔记/历史）
        │   ├── Discover.vue      # 发现（今日放送/热门）
        │   ├── ExploreWork.vue   # 作品预览（只读 + 演职员表）
        │   ├── Search.vue        # 搜索导入
        │   ├── History.vue       # 观看记录
        │   ├── Statistics.vue    # 统计分析
        │   ├── Tags.vue          # 标签管理
        │   └── Settings.vue      # 系统设置
        ├── components/       # UI 组件
        ├── composables/      # 组合式函数
        ├── utils/            # API 客户端、格式化
        └── src-tauri/        # Tauri 桌面端配置
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/covers/:filename` | 封面图片 |
| GET/POST | `/api/media` | 媒体列表 / 创建 |
| POST | `/api/media/import` | 从数据源导入 |
| GET/PUT/DELETE | `/api/media/:id` | 媒体详情 / 更新 / 删除 |
| PATCH | `/api/media/:id/progress` | 更新进度 |
| PATCH | `/api/media/:id/status` | 更新状态 |
| POST | `/api/media/:id/sync` | 同步数据源 |
| GET | `/api/media/:id/history` | 媒体观看历史 |
| GET/POST/DELETE | `/api/tags` | 标签 CRUD |
| GET/POST/PUT/DELETE | `/api/history` | 观看历史 CRUD |
| GET | `/api/search` | 外部搜索 |
| GET | `/api/search/sources` | 数据源列表 |
| GET | `/api/search/details` | 作品详情（不导入） |
| GET | `/api/search/credits` | 演职员表 |
| GET/POST | `/api/backup` | 数据导入/导出 |
| POST | `/api/sync/trigger` | 触发同步 |
| POST | `/api/sync/covers` | 下载所有封面 |
| GET | `/api/statistics/*` | 统计概览/趋势/分布 |
| GET | `/api/discover` | 发现页内容（缓存至 24:00） |

## 配置

复制 `config.example.yaml` 为 `config.yaml`：

```yaml
server:
  port: 8000
  host: 0.0.0.0

auth:
  api_key: "your-secret-key-here"

sync:
  cron: "0 3 * * *"    # 设为 "" 禁用

proxy: ""               # HTTP 代理，留空自动检测系统代理

datasources:
  bangumi:
    enabled: true
    base_url: https://api.bgm.tv
    bgm_token: ""       # Bangumi access token (可选)
  tmdb:
    enabled: true
    base_url: https://api.themoviedb.org/3
    access_token: ""    # TMDB API access token (https://www.themoviedb.org/settings/api)
    language: zh-CN
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
