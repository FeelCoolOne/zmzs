# 小红书采集助手 (Mini 版)

轻量级小红书数据采集 Chrome 扩展，支持笔记、用户、评论数据采集与导出。

## 功能特性

- ✅ 小红书页面数据自动采集
- ✅ 本地 IndexedDB 存储
- ✅ 悬浮快捷操作按钮
- ✅ 侧边栏数据管理
- ✅ JSON/CSV 数据导出
- ✅ 无账户体系，纯本地运行

## 文件结构

```
mini/
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
│   └── rule.json              # 网络拦截规则
├── icons/
│   ├── icon16.png             # 16x16 图标 (需要自行添加)
│   ├── icon32.png             # 32x32 图标 (需要自行添加)
│   ├── icon48.png             # 48x48 图标 (需要自行添加)
│   ├── icon128.png            # 128x128 图标 (需要自行添加)
│   └── icon.svg               # 图标源文件
└── doc/                       # 设计文档
```

## 安装方法

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `mini` 文件夹

## 使用方法

1. 访问小红书网站 (xiaohongshu.com)
2. 浏览笔记、用户页面时数据会自动采集
3. 点击扩展图标打开侧边栏查看采集的数据
4. 使用悬浮按钮进行快捷操作

## 开发文档

详细的设计文档位于 `doc/` 目录：

- [01-manifest-design.md](doc/01-manifest-design.md) - Manifest 配置
- [02-inject-js-design.md](doc/02-inject-js-design.md) - 注入脚本
- [03-content-js-design.md](doc/03-content-js-design.md) - 内容脚本
- [04-background-design.md](doc/04-background-design.md) - Service Worker
- [05-sidepanel-design.md](doc/05-sidepanel-design.md) - 侧边栏 UI
- [06-database-design.md](doc/06-database-design.md) - 数据库设计
- [07-architecture-overview.md](doc/07-architecture-overview.md) - 架构总览
- [08-development-guide.md](doc/08-development-guide.md) - 开发指南

## 注意事项

1. 需要 Chrome 95+ 版本支持
2. 首次使用前需要在 `icons/` 目录添加 PNG 图标文件
3. 所有数据仅存储在本地，不会上传到服务器

## 许可证

MIT License
