# Mini 版小红书采集插件 - 设计文档

## 文档索引

| 文档 | 说明 |
|------|------|
| [01-manifest-design.md](./01-manifest-design.md) | Manifest V3 配置设计 |
| [02-inject-js-design.md](./02-inject-js-design.md) | 注入脚本 (inject.js) 设计 |
| [03-content-js-design.md](./03-content-js-design.md) | 内容脚本 (content.js) 设计 |
| [04-background-design.md](./04-background-design.md) | Service Worker 设计 |
| [05-sidepanel-design.md](./05-sidepanel-design.md) | 侧边栏 UI 设计 |
| [06-database-design.md](./06-database-design.md) | 数据库 (IndexedDB) 设计 |
| [07-architecture-overview.md](./07-architecture-overview.md) | 架构总览 |
| [08-development-guide.md](./08-development-guide.md) | 开发指南 |

## 快速开始

### 1. 阅读顺序

建议按以下顺序阅读文档：

1. **架构总览** - 了解整体架构
2. **Manifest 配置** - 了解扩展配置
3. **inject.js 设计** - 了解请求拦截
4. **content.js 设计** - 了解数据存储
5. **background.js 设计** - 了解后台功能
6. **sidepanel 设计** - 了解 UI 界面
7. **数据库设计** - 了解数据结构
8. **开发指南** - 开始开发

### 2. 核心特性

- ✅ 小红书全页面数据采集
- ✅ 本地 IndexedDB 存储
- ✅ 悬浮快捷操作按钮
- ✅ 侧边栏数据管理
- ✅ JSON/CSV 数据导出
- ✅ 无账户体系，纯本地运行

### 3. 技术栈

- **Manifest V3**: Chrome 扩展最新标准
- **Service Worker**: 后台脚本
- **Side Panel**: 侧边栏 API
- **IndexedDB**: 本地数据存储
- **Vanilla JS**: 原生 JavaScript

### 4. 文件结构

```
mini-xhs-collector/
├── manifest.json              # 扩展配置
├── background.js              # Service Worker
├── sidepanel.html             # 侧边栏 HTML
├── sidepanel.css              # 侧边栏样式
├── sidepanel.js               # 侧边栏逻辑
├── content-scripts/
│   ├── content.js             # 隔离环境脚本
│   ├── inject.js              # 主世界注入脚本
│   └── content.css            # 内容脚本样式
├── xiaohongshu/
│   ├── rule.json              # 网络拦截规则
│   └── vendor-dynamic.js      # 请求函数注入
├── icons/                     # 扩展图标
└── doc/                       # 设计文档
```

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                  Chrome 浏览器                   │
├─────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────┐ │
│  │  Side Panel     │    │  Content Scripts    │ │
│  │  (数据展示)      │◀──▶│  (数据存储+悬浮按钮) │ │
│  └─────────────────┘    └─────────────────────┘ │
│           │                      │              │
│           ▼                      ▼              │
│  ┌─────────────────────────────────────────────┐│
│  │         Service Worker (background.js)      ││
│  │              (下载+导出+通信)                ││
│  └─────────────────────────────────────────────┘│
│                      │                          │
│                      ▼                          │
│  ┌─────────────────────────────────────────────┐│
│  │         小红书页面 (xiaohongshu.com)         ││
│  │    (XHR/Fetch 请求 / __INITIAL_STATE__)     ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 数据流向

```
小红书页面请求
    │
    ├── XHR/Fetch
    │
    ▼
inject.js 拦截
    │
    ├── 解析数据
    │
    ▼
CustomEvent
    │
    ▼
content.js 接收
    │
    ├── 存储到 IndexedDB
    │
    ▼
Side Panel 展示
    │
    ├── 筛选/搜索
    │
    ▼
导出文件
```

## 开发状态

| 模块 | 状态 | 文档 |
|------|------|------|
| Manifest 配置 | ✅ 已完成 | [01-manifest-design.md](./01-manifest-design.md) |
| inject.js | ✅ 已完成 | [02-inject-js-design.md](./02-inject-js-design.md) |
| content.js | ✅ 已完成 | [03-content-js-design.md](./03-content-js-design.md) |
| background.js | ✅ 已完成 | [04-background-design.md](./04-background-design.md) |
| Sidepanel | ✅ 已完成 | [05-sidepanel-design.md](./05-sidepanel-design.md) |
| 数据库 | ✅ 已完成 | [06-database-design.md](./06-database-design.md) |
| 架构总览 | ✅ 已完成 | [07-architecture-overview.md](./07-architecture-overview.md) |
| 开发指南 | ✅ 已完成 | [08-development-guide.md](./08-development-guide.md) |

## 注意事项

1. **Chrome 版本**: 需要 Chrome 95+ 支持 `world: "MAIN"`
2. **隐私保护**: 所有数据本地存储，不上传服务器
3. **性能优化**: 大数据量时使用分页和虚拟列表
4. **错误处理**: 所有异步操作需要 try-catch

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request

## 更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 支持小红书数据采集
- 支持笔记/用户/评论/搜索数据
- 支持 JSON/CSV 导出
