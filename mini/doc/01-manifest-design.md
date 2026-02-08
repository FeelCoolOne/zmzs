# Manifest V3 配置设计文档

## 概述

本文档定义 Mini 版小红书采集插件的 Manifest V3 配置，包含权限声明、入口文件、内容脚本、网络规则等。

## 完整配置

```json
{
  "manifest_version": 3,
  "name": "小红书采集助手(Mini)",
  "version": "1.0.0",
  "description": "轻量级小红书数据采集工具，支持笔记、用户、评论数据采集与导出",
  
  "permissions": [
    "sidePanel",
    "storage",
    "scripting",
    "downloads",
    "declarativeNetRequestWithHostAccess",
    "activeTab"
  ],
  
  "host_permissions": [
    "*://www.xiaohongshu.com/*",
    "*://pgy.xiaohongshu.com/*",
    "*://ci.xiaohongshu.com/*"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  
  "content_scripts": [
    {
      "matches": [
        "*://www.xiaohongshu.com/*",
        "*://pgy.xiaohongshu.com/*"
      ],
      "js": ["content-scripts/content.js"],
      "css": ["content-scripts/content.css"],
      "run_at": "document_start",
      "world": "ISOLATED"
    },
    {
      "matches": [
        "*://www.xiaohongshu.com/*",
        "*://pgy.xiaohongshu.com/*"
      ],
      "js": ["content-scripts/inject.js"],
      "run_at": "document_start",
      "world": "MAIN"
    }
  ],
  
  "web_accessible_resources": [
    {
      "resources": ["xiaohongshu/vendor-dynamic.js"],
      "matches": ["*://www.xiaohongshu.com/*"]
    }
  ],
  
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "xiaohongshu_rules",
        "enabled": true,
        "path": "xiaohongshu/rule.json"
      }
    ]
  },
  
  "action": {
    "default_title": "打开小红书采集助手",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## 权限说明

### 必需权限

| 权限 | 用途 | 说明 |
|------|------|------|
| `sidePanel` | 打开侧边栏面板 | 核心功能，用于展示采集数据 |
| `storage` | 本地数据存储 | 存储采集数据和用户设置 |
| `scripting` | 在页面执行脚本 | 用于 executeScript API |
| `downloads` | 导出文件下载 | 数据导出功能 |
| `declarativeNetRequestWithHostAccess` | 网络请求拦截 | 拦截小红书 API 请求 |

### 可选权限

| 权限 | 用途 | 说明 |
|------|------|------|
| `activeTab` | 获取当前标签页信息 | 用于获取当前页面数据 |

## 主机权限

```
*://www.xiaohongshu.com/*     # 小红书主站
*://pgy.xiaohongshu.com/*     # 蒲公英平台
*://ci.xiaohongshu.com/*      # 小红书 CDN
```

## 内容脚本配置

### 隔离环境脚本 (ISOLATED)

- **文件**: `content-scripts/content.js`
- **运行环境**: 隔离环境，无法直接访问页面 JS
- **职责**: 
  - 接收 inject.js 发送的数据
  - 管理 IndexedDB 存储
  - 渲染悬浮按钮
  - 与 Service Worker 通信

### 主世界脚本 (MAIN)

- **文件**: `content-scripts/inject.js`
- **运行环境**: 主世界，可访问页面所有 JS 对象
- **职责**:
  - 拦截 XHR/Fetch 请求
  - 提取页面初始状态
  - 通过 CustomEvent 发送数据

## 网络规则配置

### 规则文件

- **路径**: `xiaohongshu/rule.json`
- **用途**: 声明式网络请求拦截规则

### 规则示例

```json
{
  "rules": [
    {
      "id": 1,
      "priority": 1,
      "action": {
        "type": "redirect",
        "redirect": {
          "extensionPath": "/xiaohongshu/vendor-dynamic.js"
        }
      },
      "condition": {
        "urlFilter": "vendor-dynamic.*.js",
        "domains": ["www.xiaohongshu.com"]
      }
    }
  ]
}
```

## 图标规格

| 尺寸 | 用途 |
|------|------|
| 16x16 | 工具栏图标 |
| 32x32 | 工具栏图标（高分屏）|
| 48x48 | 扩展管理页面 |
| 128x128 | Chrome Web Store |

## 版本规范

采用语义化版本控制 (SemVer):

```
主版本号.次版本号.修订号
```

- **主版本号**: 重大功能变更或不兼容修改
- **次版本号**: 新增功能，向下兼容
- **修订号**: 问题修复，向下兼容

## 文件路径映射

```
manifest.json              -> 根目录
background.js              -> 根目录
sidepanel.html             -> 根目录
sidepanel.js               -> 根目录
sidepanel.css              -> 根目录
content-scripts/
  content.js               -> content-scripts/
  inject.js                -> content-scripts/
  content.css              -> content-scripts/
xiaohongshu/
  rule.json                -> xiaohongshu/
  vendor-dynamic.js        -> xiaohongshu/
icons/
  icon16.png               -> icons/
  icon32.png               -> icons/
  icon48.png               -> icons/
  icon128.png              -> icons/
```

## 注意事项

1. **Manifest V3 要求**: 必须使用 Service Worker 替代 background page
2. **CSP 限制**: 内联脚本需要使用 `script-src 'self'`
3. **跨域请求**: 通过 `host_permissions` 声明需要的域名
4. **内容脚本**: `world: "MAIN"` 需要 Chrome 95+ 版本支持
