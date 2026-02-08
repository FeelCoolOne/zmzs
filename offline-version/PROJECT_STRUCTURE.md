# 项目结构总览

```
offline-version/
│
├── manifest.json                    # 扩展配置文件（Manifest V3）
├── package.json                     # 项目配置文件
├── README.md                        # 项目说明文档
│
├── background.js                    # 后台服务脚本
│   ├── 平台检测
│   ├── 数据采集处理
│   ├── 媒体文件下载
│   ├── 数据导出（JSON/CSV/XLSX）
│   ├── IndexedDB 操作
│   └── 消息通信处理
│
├── sidepanel.html                   # 侧边栏页面
├── options.html                     # 选项设置页面
│
├── lib/
│   └── indexeddb.js                 # IndexedDB 本地存储模块
│       ├── 数据库初始化
│       ├── CRUD 操作
│       ├── 查询功能
│       ├── 统计功能
│       └── 数据导入导出
│
├── scripts/
│   ├── sidepanel.js                 # 侧边栏逻辑
│   │   ├── 统计数据加载
│   │   ├── 最近采集展示
│   │   ├── 数据采集
│   │   ├── 数据导出
│   │   ├── 数据删除
│   │   └── UI 交互
│   │
│   └── options.js                   # 设置页面逻辑
│       ├── 设置加载
│       ├── 设置保存
│       ├── 统计数据展示
│       ├── 数据导出
│       └── 数据清空
│
├── styles/
│   ├── sidepanel.css                # 侧边栏样式
│   │   ├── 响应式布局
│   │   ├── 组件样式
│   │   ├── 动画效果
│   │   └── 滚动条样式
│   │
│   └── options.css                  # 设置页面样式
│       ├── 表单样式
│       ├── 开关组件
│       ├── 统计卡片
│       └── 响应式设计
│
├── content-scripts/
│   ├── content.js                   # 内容脚本（隔离环境）
│   │   ├── 平台检测
│   │   ├── 脚本注入
│   │   ├── 消息监听
│   │   └── 与后台通信
│   │
│   ├── main.js                      # 主世界脚本
│   │   ├── Fetch 拦截
│   │   ├── XMLHttpRequest 拦截
│   │   ├── API 请求检测
│   │   ├── 数据收集
│   │   └── 全局函数暴露
│   │
│   ├── inject-xiaohongshu.js        # 小红书拦截脚本
│   │   ├── API 请求拦截
│   │   ├── 用户信息提取
│   │   ├── 笔记信息提取
│   │   └── 评论信息提取
│   │
│   ├── inject-douyin.js             # 抖音拦截脚本
│   │   ├── API 请求拦截
│   │   ├── 视频信息提取
│   │   ├── 用户信息提取
│   │   └── 评论列表提取
│   │
│   ├── inject-kuaishou.js           # 快手拦截脚本
│   │   ├── API 请求拦截
│   │   ├── 视频信息提取
│   │   └── 用户信息提取
│   │
│   └── inject-tiktok.js             # TikTok 拦截脚本
│       ├── API 请求拦截
│       ├── 视频信息提取
│       └── 用户信息提取
│
├── icon/
│   ├── icon.svg                     # SVG 图标
│   ├── icon16.png                   # 16x16 图标（待添加）
│   ├── icon32.png                   # 32x32 图标（待添加）
│   ├── icon48.png                   # 48x48 图标（待添加）
│   ├── icon128.png                  # 128x128 图标（待添加）
│   └── README.md                    # 图标说明
│
└── _locales/
    └── zh_CN/
        └── messages.json            # 中文语言包
```

## 核心功能模块

### 1. 数据采集模块

- **位置**: `content-scripts/`
- **功能**:
  - 拦截平台 API 请求
  - 提取用户、作品、评论数据
  - 自动收集页面数据
- **支持平台**: 小红书、抖音、快手、TikTok、星图

### 2. 数据存储模块

- **位置**: `lib/indexeddb.js`
- **功能**:
  - IndexedDB 数据库管理
  - CRUD 操作
  - 查询和统计
  - 数据导入导出

### 3. 后台服务模块

- **位置**: `background.js`
- **功能**:
  - 消息路由和处理
  - 数据采集协调
  - 媒体文件下载
  - 数据导出处理
  - 设置管理

### 4. 用户界面模块

- **侧边栏**: `sidepanel.html` + `scripts/sidepanel.js`
  - 统计数据展示
  - 最近采集列表
  - 快捷操作按钮
  - 平台状态显示

- **设置页面**: `options.html` + `scripts/options.js`
  - 基本设置
  - 采集设置
  - 数据管理
  - 关于信息

### 5. 样式模块

- **位置**: `styles/`
- **功能**:
  - 响应式布局
  - 现代化 UI 设计
  - 动画效果
  - 主题定制

## 数据流程

```
用户浏览平台页面
    ↓
content-scripts 拦截 API 请求
    ↓
提取数据并通过 postMessage 发送
    ↓
content.js 接收并发送到 background
    ↓
background.js 存储到 IndexedDB
    ↓
sidepanel 从 IndexedDB 读取并展示
    ↓
用户可以导出或删除数据
```

## 消息通信

### Content Script → Background

```javascript
chrome.runtime.sendMessage({
  type: 'collect',
  data: { type, rawData, userId }
});
```

### Sidepanel → Background

```javascript
chrome.runtime.sendMessage({
  type: 'getStatistics'
});

chrome.runtime.sendMessage({
  type: 'exportData',
  data: { format: 'json' }
});
```

### Background → Content Script

```javascript
chrome.tabs.sendMessage(tabId, {
  type: 'getPageInfo'
});
```

## 存储结构

### collectedItems

```javascript
{
  id: string,           // UUID
  platform: string,     // 平台名称
  type: string,         // 数据类型
  rawData: object,      // 原始数据
  userId: string,       // 用户ID
  collectedAt: number,  // 采集时间戳
  url: string           // 页面URL
}
```

### mediaFiles

```javascript
{
  id: string,           // UUID
  itemId: string,       // 关联的采集项ID
  url: string,          // 媒体URL
  type: string,         // image/video
  filename: string,     // 文件名
  downloadedAt: number  // 下载时间戳
}
```

### settings

```javascript
{
  key: 'user',
  autoExport: boolean,
  exportFormat: string,
  downloadPath: string,
  maxFileSize: number,
  collectMode: string,
  collectInterval: number,
  updatedAt: number
}
```

## 扩展权限

```json
{
  "permissions": [
    "tabs",           // 标签页操作
    "downloads",      // 文件下载
    "storage",        // 本地存储
    "scripting",      // 脚本注入
    "cookies",        // Cookie 访问
    "sidePanel"       // 侧边栏
  ],
  "host_permissions": [
    "*://*.xiaohongshu.com/*",
    "*://*.douyin.com/*",
    "*://*.kuaishou.com/*",
    "*://*.tiktok.com/*",
    "*://*.xingtu.cn/*"
  ]
}
```

## 开发建议

### 添加新功能

1. 在 `background.js` 中添加消息处理器
2. 在 `lib/indexeddb.js` 中添加数据存储逻辑（如需要）
3. 在 `scripts/` 中添加 UI 交互逻辑
4. 更新 `manifest.json`（如需要新权限）

### 调试技巧

1. 打开 `chrome://extensions/`
2. 找到扩展，点击"检查视图"
3. 查看 background、content script、sidepanel 的控制台
4. 使用 `console.log` 输出调试信息

### 性能优化

1. 减少不必要的 IndexedDB 查询
2. 使用分页加载大量数据
3. 避免频繁的消息通信
4. 使用防抖/节流处理高频事件

## 安全注意事项

1. 不存储敏感信息（密码、令牌等）
2. 验证所有用户输入
3. 使用 Content Security Policy
4. 定期清理过期数据
5. 遵守平台的使用条款

---

**最后更新**: 2026-02-06
**版本**: 1.0.0
