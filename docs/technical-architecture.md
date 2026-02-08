# 社媒助手 - 技术架构分析文档

## 📊 项目技术架构总览

### 一、项目基本信息

| 属性 | 详情 |
|------|------|
| **项目名称** | 社媒助手 (Social Media Assistant) |
| **类型** | Chrome 浏览器扩展 (Manifest V3) |
| **版本** | 3.1.1 |
| **构建框架** | WXT (现代浏览器扩展开发框架) |
| **前端技术栈** | React + Ant Design + TypeScript |

---

### 二、整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chrome 浏览器扩展                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Side Panel  │  │ Options Page │  │  Content Scripts     │  │
│  │  (侧边栏)     │  │  (设置页)     │  │  (内容脚本注入)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│              ┌────────────▼────────────┐                       │
│              │   Service Worker        │                       │
│              │   (background.js)       │                       │
│              │   - 后台任务调度         │                       │
│              │   - 数据采集上传         │                       │
│              │   - 跨页面通信           │                       │
│              └────────────┬────────────┘                       │
│                           │                                     │
│              ┌────────────▼────────────┐                       │
│              │  Declarative Net Request │                       │
│              │  (网络请求拦截)           │                       │
│              └─────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ 小红书  │          │  抖音   │          │  快手   │
   │(XHS)    │          │(Douyin) │          │(Kuaishou)│
   └─────────┘          └─────────┘          └─────────┘
```

---

### 三、核心模块详解

#### 1. **Manifest V3 配置** (`manifest.json`)

```json
{
  "manifest_version": 3,
  "permissions": [
    "tabs",           // 标签页管理
    "downloads",      // 下载功能
    "storage",        // 本地存储
    "scripting",      // 脚本注入
    "cookies",        // Cookie访问
    "alarms",         // 定时任务
    "declarativeNetRequestWithHostAccess",  // 网络请求拦截
    "sidePanel"       // 侧边栏
  ],
  "host_permissions": ["<all_urls>"]
}
```

**支持的平台：**
- 小红书 (www.xiaohongshu.com, pgy.xiaohongshu.com)
- 抖音 (www.douyin.com)
- 快手 (www.kuaishou.com)
- TikTok (www.tiktok.com)
- 星图 (www.xingtu.cn)

---

#### 2. **后台服务 Worker** (`background.js`)

**核心功能模块：**

| 功能 | 说明 |
|------|------|
| `openSidepanel` | 打开侧边栏面板 |
| `executeScript` | 在页面主世界执行脚本 |
| `collect` | 数据采集与上传 |
| `upload` | 文件上传功能 |
| `fetch` | 网络请求代理 |
| `chrome` | Chrome API 代理 |

**数据加密上传流程：**
1. 生成随机 16 字节 XOR 密钥
2. 收集账号信息、Cookies、设备ID、版本号
3. 使用 XOR 加密数据
4. 上传到 `https://smzs.xisence.com/api/collect`

---

#### 3. **内容脚本架构** (`content-scripts/`)

**双脚本注入模式：**

| 脚本 | 运行环境 | 作用 |
|------|----------|------|
| `content.js` | `ISOLATED` (隔离环境) | 主逻辑，与扩展后台通信，React UI |
| `mian.js` | `MAIN` (主世界) | 直接访问页面 DOM 和 JS 对象，拦截请求 |
| `content.css` | - | 注入样式 |

**mian.js 核心能力：**
- 拦截 `XMLHttpRequest` 请求
- 拦截 `fetch` 请求
- 劫持平台原生 HTTP 函数获取 API 数据
- 各平台特定的请求签名计算

---

#### 4. **网络请求拦截机制**

**小红书平台：**
- 规则文件: `xiaohongshu/rule.json`
- 拦截目标: `vendor-dynamic.*.js`
- 注入脚本: `xiaohongshu/vendor-dynamic.js`
- 注入对象: `window._smzsRequest`

**抖音平台：**
- 规则文件: `douyin/rule.json`
- 拦截目标: `client-entry~*.js`
- 注入脚本: `douyin/client-entry.js`
- 注入对象: `window._smzsHttpGet` / `window._smzsHttpPost`

**拦截原理：**
```javascript
// 通过 declarativeNetRequest 重定向 JS 文件
// 在目标 JS 执行前注入代码，暴露平台内部请求函数
function injectRegisterHttpSimple(code) {
  // 将平台请求函数暴露到 window 对象
  window._smzsRequest = param;
}
```

---

#### 5. **前端 UI 架构** (`chunks/`)

| 文件 | 功能 |
|------|------|
| `sidepanel-xxx.js` | 侧边栏 React 应用 |
| `options-xxx.js` | 设置页面 React 应用 |
| `index-xxx.js` | 通用工具函数库 |
| `feishu-config-xxx.js` | 飞书集成配置 |

**UI 技术栈：**
- React 18
- Ant Design 5.x
- CSS-in-JS (emotion/styled)
- Lucide React Icons

---

### 四、数据采集流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户操作    │────▶│  页面请求    │────▶│ 请求拦截注入 │
│ (浏览/搜索)  │     │ (XHR/fetch)  │     │(vendor-dynamic)│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  数据展示    │◀────│  数据处理    │◀────│  获取原始数据 │
│ (Side Panel)│     │ (mian.js)   │     │(_smzsRequest)│
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  加密上传    │
                    │(XOR + Upload)│
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ smzs.xisence │
                    │  .com/api   │
                    └─────────────┘
```

---

### 五、安全与权限机制

**白名单机制**（小红书蒲公英平台）：
```javascript
const whiteListUserIds = [
  "5ebb50b0000000000101d586",
  "5e742ff700000000010059c9",
  // ... 特定用户ID
];

const whiteListCompanies = [
  "云智达创科技",
  "行吟信息科技",
  "小红书科技",
  "薯一薯二"
];
```

**频率控制：**
- 同一平台 1 小时内只上传一次采集数据

---

### 六、构建产物结构

```
采集器/
├── manifest.json              # 扩展配置
├── background.js              # Service Worker (已混淆)
├── sidepanel.html             # 侧边栏入口
├── options.html               # 设置页入口
├── content-scripts/
│   ├── content.js             # 隔离环境脚本 (2MB+, React应用)
│   ├── mian.js                # 主世界脚本 (已混淆)
│   └── content.css            # 样式
├── chunks/                    # 代码分割
│   ├── sidepanel-B3lP_Hh9.js  # 侧边栏逻辑
│   ├── options-COlEbkb2.js    # 设置页逻辑
│   └── ...
├── xiaohongshu/               # 小红书特定
│   ├── rule.json              # 网络规则
│   └── vendor-dynamic.js      # 请求拦截注入
├── douyin/                    # 抖音特定
│   ├── rule.json
│   └── client-entry.js
└── assets/                    # 静态资源
```

---

### 七、关键技术点总结

| 技术点 | 实现方式 |
|--------|----------|
| **请求拦截** | Declarative Net Request API + JS 注入 |
| **跨域通信** | Chrome Message Passing + Custom Events |
| **数据加密** | XOR 加密 + 随机密钥 |
| **UI 框架** | React + Ant Design |
| **构建工具** | WXT 框架 |
| **代码保护** | 混淆 + 压缩 |
| **定时任务** | Chrome Alarms API |

---

### 八、核心文件说明

| 文件路径 | 作用 |
|----------|------|
| `manifest.json` | 扩展配置文件，声明权限、入口文件、规则等 |
| `background.js` | Service Worker，处理后台任务和通信 |
| `content-scripts/content.js` | 隔离环境内容脚本，React应用主逻辑 |
| `content-scripts/mian.js` | 主世界脚本，拦截页面请求 |
| `xiaohongshu/rule.json` | 小红书网络请求拦截规则 |
| `xiaohongshu/vendor-dynamic.js` | 小红书请求函数注入脚本 |
| `douyin/rule.json` | 抖音网络请求拦截规则 |
| `douyin/client-entry.js` | 抖音请求函数注入脚本 |
| `chunks/sidepanel-xxx.js` | 侧边栏UI代码 |
| `chunks/options-xxx.js` | 设置页面UI代码 |

---

*文档生成时间: 2026-02-06*
