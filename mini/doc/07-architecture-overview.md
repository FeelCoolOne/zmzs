# 架构总览文档

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome 浏览器                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Service Worker                        │   │
│  │                   (background.js)                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ 侧边栏管理  │  │ 文件下载    │  │ 数据导出        │  │   │
│  │  │             │  │             │  │                 │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Side Panel                          │   │
│  │                  (sidepanel.html/js)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ 数据展示    │  │ 筛选搜索    │  │ 导出功能        │  │   │
│  │  │             │  │             │  │                 │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Content Scripts                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  ┌─────────────────┐      ┌─────────────────┐          │   │
│  │  │   ISOLATED      │◀────▶│      MAIN       │          │   │
│  │  │  (content.js)   │      │  (inject.js)    │          │   │
│  │  │                 │      │                 │          │   │
│  │  │ • IndexedDB     │      │ • XHR 拦截      │          │   │
│  │  │ • 悬浮按钮      │      │ • Fetch 拦截    │          │   │
│  │  │ • 消息通信      │      │ • 数据解析      │          │   │
│  │  └─────────────────┘      └─────────────────┘          │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              小红书页面 (xiaohongshu.com)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ XHR 请求    │  │ Fetch 请求  │  │ __INITIAL_STATE__│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流向

### 1. 数据采集流程

```
小红书页面
    │
    ├── XHR/Fetch 请求
    │
    ▼
inject.js (MAIN world)
    │
    ├── 拦截请求
    ├── 解析数据
    │
    ▼
CustomEvent (smzs:response)
    │
    ▼
content.js (ISOLATED world)
    │
    ├── 接收事件
    ├── 存储到 IndexedDB
    │
    ▼
IndexedDB
```

### 2. 数据展示流程

```
Side Panel
    │
    ├── 发送 GET_ALL_DATA 消息
    │
    ▼
content.js
    │
    ├── 查询 IndexedDB
    │
    ▼
返回数据列表
    │
    ▼
渲染到 UI
```

### 3. 数据导出流程

```
Side Panel
    │
    ├── 点击导出按钮
    ├── 发送 EXPORT_DATA 消息
    │
    ▼
background.js
    │
    ├── 接收数据
    ├── 转换为 JSON/CSV
    ├── 创建 Blob
    │
    ▼
chrome.downloads.download()
    │
    ▼
保存到本地文件
```

## 模块职责

### background.js (Service Worker)

| 功能 | 说明 |
|------|------|
| 侧边栏管理 | 控制侧边栏的打开和关闭 |
| 文件下载 | 处理媒体文件下载请求 |
| 数据导出 | JSON/CSV 格式转换和下载 |
| 消息转发 | 在 content 和 sidepanel 之间转发消息 |

### content.js (ISOLATED)

| 功能 | 说明 |
|------|------|
| 数据存储 | IndexedDB 的增删改查 |
| 悬浮按钮 | 页面悬浮操作按钮的渲染和交互 |
| 消息处理 | 响应 background 和 sidepanel 的消息 |
| 事件监听 | 监听 inject.js 发送的 CustomEvent |

### inject.js (MAIN)

| 功能 | 说明 |
|------|------|
| 请求拦截 | 重写 XHR 和 Fetch API |
| 数据解析 | 按 URL 模式解析不同类型的数据 |
| 初始状态 | 提取 `__INITIAL_STATE__` 中的数据 |
| 事件发送 | 通过 CustomEvent 发送数据到 content.js |

### sidepanel.js

| 功能 | 说明 |
|------|------|
| 数据展示 | 列表展示采集的数据 |
| 筛选搜索 | 按类型和关键词筛选 |
| 统计信息 | 显示采集数量统计 |
| 导出操作 | 触发数据导出 |

## 通信机制

### 1. CustomEvent (inject -> content)

```javascript
// inject.js 发送
window.dispatchEvent(new CustomEvent('smzs:response', {
  detail: { type: 'note_info', data: {...} }
}));

// content.js 接收
window.addEventListener('smzs:response', (e) => {
  console.log(e.detail);
});
```

### 2. Chrome Message (content <-> background <-> sidepanel)

```javascript
// 发送消息
chrome.runtime.sendMessage({ type: 'EXPORT_DATA', data, format });

// 接收消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理消息
  sendResponse({ success: true });
  return true; // 保持异步通道
});
```

### 3. Chrome Storage (可选)

```javascript
// 保存设置
chrome.storage.local.set({ settings: {...} });

// 读取设置
chrome.storage.local.get('settings', (result) => {
  console.log(result.settings);
});
```

## 安全设计

### 1. 内容脚本隔离

- **ISOLATED world**: 无法直接访问页面 JS 变量
- **MAIN world**: 可以访问页面所有 JS，但与扩展隔离

### 2. 数据存储安全

- 数据仅存储在本地 IndexedDB
- 不上传到任何服务器
- 导出文件由用户控制保存位置

### 3. 权限最小化

- 仅申请必需的权限
- 主机权限限定在小红书域名
- 不使用 `activeTab` 以外的敏感权限

## 性能考虑

### 1. 请求拦截性能

- 使用原型重写而非代理，减少性能损耗
- 排除日志/监控请求，减少无效处理
- 异步解析，不阻塞原始请求

### 2. 存储性能

- 使用索引加速查询
- 批量操作减少事务开销
- 分页加载大数据量

### 3. UI 性能

- 虚拟列表处理大量数据
- 防抖处理搜索输入
- 按需渲染详情弹窗

## 扩展性设计

### 1. 添加新平台

```
1. 在 manifest.json 中添加 host_permissions
2. 创建新的 inject-{platform}.js
3. 实现平台特定的数据解析器
4. 更新 content.js 支持新平台
```

### 2. 添加新数据类型

```
1. 在 inject.js 中添加新的解析器
2. 更新数据库索引（如需要）
3. 在 sidepanel 中添加类型筛选选项
4. 更新导出格式处理
```

### 3. 添加导出格式

```
1. 在 background.js 中添加转换函数
2. 在 sidepanel 中添加导出按钮
3. 更新 MIME 类型和文件扩展名处理
```

## 调试支持

### 1. 全局调试接口

```javascript
// inject.js 暴露
window._smzsInject = {
  version: '1.0.0',
  config: CONFIG,
  getLastData: () => window._lastInterceptedData,
  parsers: Object.keys(parsers)
};
```

### 2. 日志输出

```javascript
const CONFIG = {
  DEBUG: true  // 开启调试日志
};

const utils = {
  log: (...args) => CONFIG.DEBUG && console.log('[XHS-Inject]', ...args)
};
```

### 3. 开发工具

- Chrome DevTools -> Sources -> Content scripts
- Chrome DevTools -> Application -> IndexedDB
- Chrome DevTools -> Network -> 查看拦截的请求

## 部署结构

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
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```
