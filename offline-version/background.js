// 社媒助手离线版 - Service Worker
// 参照docs文档重新设计，支持定时任务、脚本注入等完整功能

importScripts('lib/indexeddb.js');

// ==================== 平台配置 ====================
const PLATFORMS = {
  xiaohongshu: {
    code: 'xiaohongshu',
    name: '小红书',
    domains: ['xiaohongshu.com', 'pgy.xiaohongshu.com'],
    origin: 'https://www.xiaohongshu.com',
    icon: 'xiaohongshu',
    injectScript: 'inject-xiaohongshu.js',
    injectUI: true,
    hidden: false
  },
  douyin: {
    code: 'douyin',
    name: '抖音',
    domains: ['douyin.com'],
    origin: 'https://www.douyin.com',
    icon: 'douyin',
    injectScript: 'inject-douyin.js',
    injectUI: true,
    hidden: false
  },
  kuaishou: {
    code: 'kuaishou',
    name: '快手',
    domains: ['kuaishou.com'],
    origin: 'https://www.kuaishou.com',
    icon: 'kuaishou',
    injectScript: 'inject-kuaishou.js',
    injectUI: true,
    hidden: false
  },
  tiktok: {
    code: 'tiktok',
    name: 'TikTok',
    domains: ['tiktok.com'],
    origin: 'https://www.tiktok.com',
    icon: 'tiktok',
    injectScript: 'inject-tiktok.js',
    injectUI: true,
    hidden: false
  },
  xingtu: {
    code: 'xingtu',
    name: '星图',
    domains: ['xingtu.cn'],
    origin: 'https://www.xingtu.cn',
    icon: 'xingtu',
    injectScript: null,
    injectUI: true,
    hidden: true
  },
  'pgy.xiaohongshu': {
    code: 'pgy.xiaohongshu',
    name: '蒲公英',
    domains: ['pgy.xiaohongshu.com'],
    origin: 'https://pgy.xiaohongshu.com',
    icon: 'pgy.xiaohongshu',
    injectScript: null,
    injectUI: true,
    hidden: true
  }
};

// ==================== 存储管理 (模拟WXT Storage) ====================
const storage = {
  local: {
    async get(key) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    }
  },
  session: {
    async get(key) {
      const result = await chrome.storage.session.get(key);
      return result[key];
    },
    async set(key, value) {
      await chrome.storage.session.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.session.remove(key);
    }
  }
};

// 存储项定义
const taskAlarmsStore = {
  key: 'local:taskAlarms',
  async getValue() {
    const value = await storage.local.get('taskAlarms');
    return value || [];
  },
  async setValue(value) {
    await storage.local.set('taskAlarms', value);
  }
};

const lastCollectTimeStore = {
  key: 'session:lastCollectTime',
  async getValue() {
    const value = await storage.session.get('lastCollectTime');
    return value || {};
  },
  async setValue(value) {
    await storage.session.set('lastCollectTime', value);
  }
};

const deviceIdStore = {
  key: 'local:deviceId',
  async getValue() {
    let value = await storage.local.get('deviceId');
    if (!value) {
      value = generateDeviceId();
      await this.setValue(value);
    }
    return value;
  },
  async setValue(value) {
    await storage.local.set('deviceId', value);
  }
};

// ==================== 工具函数 ====================
function generateDeviceId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function detectPlatform(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    for (const [key, platform] of Object.entries(PLATFORMS)) {
      if (platform.domains.some(domain => hostname.includes(domain))) {
        return platform;
      }
    }
  } catch (e) {
    console.error('Error detecting platform:', e);
  }
  return null;
}

function detectPlatformCode(url) {
  const platform = detectPlatform(url);
  return platform ? platform.code : null;
}

// XOR 加密类
class XorEncryptor {
  constructor() {
    this.key = this.generateRandomKey(16);
  }

  generateRandomKey(length) {
    const key = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(key);
    } else {
      for (let i = 0; i < length; i++) {
        key[i] = Math.floor(Math.random() * 256);
      }
    }
    return key;
  }

  encryptBytes(data) {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ this.key[i % this.key.length];
    }
    return result;
  }

  encrypt(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    return this.encryptBytes(data);
  }

  getHexKey() {
    return Array.from(this.key)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ==================== 定时任务管理 ====================
const taskAlarmManager = {
  // 初始化定时任务
  async init() {
    const tasks = await taskAlarmsStore.getValue();
    if (!tasks || tasks.length === 0) return;

    const alarms = await chrome.alarms.getAll();
    
    for (const task of tasks) {
      if (!task.enabled) continue;
      
      const existingAlarm = alarms.find(a => a.name === task.id);
      if (!existingAlarm) {
        let when = task.when;
        if (when && task.periodInMinutes) {
          while (when < Date.now()) {
            when += task.periodInMinutes * 60 * 1000;
          }
        }
        
        await chrome.alarms.create(task.id, {
          periodInMinutes: task.periodInMinutes,
          delayInMinutes: task.delayInMinutes,
          when: when
        });
      }
    }
  },

  // 创建任务
  async create(task) {
    const tasks = await taskAlarmsStore.getValue();
    tasks.unshift(task);
    await taskAlarmsStore.setValue(tasks);

    if (task.enabled) {
      await chrome.alarms.create(task.id, {
        periodInMinutes: task.periodInMinutes,
        delayInMinutes: task.delayInMinutes,
        when: task.when
      });
    }
  },

  // 更新任务
  async update(id, updates) {
    const tasks = await taskAlarmsStore.getValue();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
    await taskAlarmsStore.setValue(tasks);

    // 重新创建alarm
    await chrome.alarms.clear(id);
    if (updates.enabled) {
      let when = updates.when;
      if (when && updates.periodInMinutes) {
        while (when < Date.now()) {
          when += updates.periodInMinutes * 60 * 1000;
        }
      }
      await chrome.alarms.create(id, {
        periodInMinutes: updates.periodInMinutes,
        delayInMinutes: updates.delayInMinutes,
        when: when
      });
    }
  },

  // 删除任务
  async remove(id) {
    const tasks = await taskAlarmsStore.getValue();
    await taskAlarmsStore.setValue(tasks.filter(t => t.id !== id));
    await chrome.alarms.clear(id);
  },

  // 获取所有任务
  async getAll() {
    return await taskAlarmsStore.getValue();
  }
};

// ==================== 消息处理器 ====================
const messageHandlers = {
  // 打开侧边栏
  async openSidepanel({ sender }) {
    if (sender.tab?.id) {
      try {
        await chrome.sidePanel.open({ 
          tabId: sender.tab.id, 
          windowId: sender.tab.windowId 
        });
        return true;
      } catch (error) {
        console.error('Failed to open side panel:', error);
        return false;
      }
    }
    return true;
  },

  // 在页面执行脚本 (MAIN世界)
  async executeScript({ data, sender }) {
    if (!sender.tab?.id) return null;

    const script = data.script.trim();
    const isAsync = script.startsWith('async');
    const scriptBody = isAsync ? script.slice(5).trim() : script;
    
    // 解析函数参数和体
    const funcMatch = scriptBody.match(/^function\s*[^\(]*\(\s*([^\)]*)\)/) ||
                      scriptBody.match(/^\(?\s*([^\)=]*)\s*\)?\s*=>/);
    const bodyMatch = scriptBody.match(/\{([\s\S]*)\}$/) ||
                      scriptBody.match(/=>\s*(.*)/);
    
    const params = funcMatch ? 
      funcMatch[1].split(',').map(p => p.trim()).filter(Boolean) : [];
    const body = bodyMatch ? bodyMatch[1].trim() : scriptBody;

    const results = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: (funcParams, funcBody, args) => {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction(...funcParams, funcBody);
        return fn(...args);
      },
      args: [params, body, data.args || []]
    });

    return results?.[0]?.result;
  },

  // Chrome API 代理
  async chrome({ data }) {
    const { paths, args = [] } = data;
    let target = chrome;
    let context = target;
    
    for (const path of paths) {
      context = target;
      target = target[path];
      if (!target) break;
    }
    
    if (typeof target === 'function') {
      return await target.apply(context, args);
    }
    return target;
  },

  // 代理 fetch 请求
  async fetch({ data }) {
    const { url, dataType, ...options } = data;
    const response = await fetch(url, options);
    
    switch (dataType) {
      case 'url':
        return response.url;
      case 'text':
        return await response.text();
      case 'json':
        return await response.json();
      default:
        return response;
    }
  },

  // 文件上传
  async upload({ data }) {
    const { url, fileUrl, fileName, formData = {}, ...options } = data;
    
    // 下载远程文件
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`文件下载失败: ${fileResponse.status}`);
    }

    // 检查文件大小 (20MB限制)
    const contentLength = Number(fileResponse.headers.get('content-length'));
    if (contentLength > 20 * 1024 * 1024) {
      throw new Error('文件大小超过20MB，无法上传');
    }

    const blob = await fileResponse.blob();
    const form = new FormData();
    
    // 添加额外表单数据
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    form.append('file', blob, fileName);
    form.append('size', blob.size.toString());

    const response = await fetch(url, {
      ...options,
      method: 'POST',
      body: form
    });

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  },

  // 数据采集 (离线版存储到本地，不上传)
  async collect({ data, sender }) {
    if (!sender.tab?.url) return { success: false };

    const platform = detectPlatformCode(sender.tab.url);
    if (!platform) return { success: false };

    // 频率限制检查 (1小时内不重复采集同一平台)
    const lastCollectTime = await lastCollectTimeStore.getValue();
    if (lastCollectTime[platform] && 
        Date.now() - lastCollectTime[platform] < 3600 * 1000) {
      return { success: false, reason: 'rate_limited' };
    }

    // 更新采集时间
    lastCollectTime[platform] = Date.now();
    await lastCollectTimeStore.setValue(lastCollectTime);

    // 获取设备ID
    const deviceId = await deviceIdStore.getValue();
    
    // 收集数据
    const collectData = {
      id: crypto.randomUUID(),
      platform,
      account: data,
      deviceId,
      url: sender.tab.url,
      collectedAt: Date.now(),
      userAgent: navigator.userAgent
    };

    // 存储到 IndexedDB
    await dbManager.add('collectedItems', collectData);

    return { success: true, id: collectData.id };
  },

  // 定时任务执行
  async taskAlarm({ data }) {
    const { task, tabId } = data;
    
    try {
      // 向内容脚本发送任务执行消息
      await chrome.tabs.sendMessage(tabId, {
        type: 'executeTaskAlarm',
        task
      });
      return true;
    } catch (error) {
      console.error('Task alarm execution failed:', error);
      return false;
    }
  },

  // 定时任务管理
  async createTaskAlarm({ data }) {
    await taskAlarmManager.create(data);
    return { success: true };
  },

  async updateTaskAlarm({ data }) {
    const { id, updates } = data;
    await taskAlarmManager.update(id, updates);
    return { success: true };
  },

  async deleteTaskAlarm({ data }) {
    await taskAlarmManager.remove(data.id);
    return { success: true };
  },

  async getTaskAlarms() {
    const tasks = await taskAlarmManager.getAll();
    return { success: true, data: tasks };
  },

  // 获取统计数据
  async getStatistics() {
    const stats = await dbManager.getStatistics();
    return { success: true, data: stats };
  },

  // 获取采集的项目
  async getCollectedItems({ data = {} }) {
    const { platform, type, limit } = data;
    
    let items;
    if (platform) {
      items = await dbManager.getByIndex('collectedItems', 'platform', platform);
    } else {
      items = await dbManager.getAll('collectedItems');
    }
    
    if (limit) {
      items = items.slice(-limit);
    }
    
    return { success: true, data: items };
  },

  // 删除项目
  async deleteItem({ data }) {
    const { id, storeName = 'collectedItems' } = data;
    await dbManager.delete(storeName, id);
    return { success: true };
  },

  // 清空数据
  async clearAll({ data = {} }) {
    const { storeName } = data;
    if (storeName) {
      await dbManager.clear(storeName);
    } else {
      await dbManager.clear('collectedItems');
      await dbManager.clear('mediaFiles');
      await dbManager.clear('downloadHistory');
      await dbManager.clear('exportTasks');
    }
    return { success: true };
  },

  // 导出数据
  async exportData({ data }) {
    const { format, items, storeName = 'collectedItems' } = data;

    let exportItems = items;
    if (!exportItems) {
      exportItems = await dbManager.getAll(storeName);
    }

    if (!exportItems || exportItems.length === 0) {
      throw new Error('没有可导出的数据');
    }

    let blob;
    let filename;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    switch (format) {
      case 'json':
        blob = new Blob([JSON.stringify(exportItems, null, 2)], { type: 'application/json' });
        filename = `社媒助手导出_${timestamp}.json`;
        break;

      case 'csv':
        blob = new Blob([convertToCSV(exportItems)], { type: 'text/csv;charset=utf-8;' });
        filename = `社媒助手导出_${timestamp}.csv`;
        break;

      default:
        throw new Error('不支持的导出格式');
    }

    const url = URL.createObjectURL(blob);
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: true
    });
    URL.revokeObjectURL(url);

    // 记录导出任务
    await dbManager.add('exportTasks', {
      id: crypto.randomUUID(),
      format,
      itemCount: exportItems.length,
      downloadId,
      exportedAt: Date.now()
    });

    return { success: true, downloadId };
  },

  // 下载媒体
  async downloadMedia({ data }) {
    const { url, itemId, type } = data;
    
    const filename = generateFilename(url, type);
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: false
    });

    // 记录下载历史
    await dbManager.add('downloadHistory', {
      id: crypto.randomUUID(),
      itemId,
      url,
      type,
      filename,
      downloadId,
      downloadedAt: Date.now()
    });

    return { success: true, downloadId };
  },

  // 获取设置
  async getSettings() {
    const defaultSettings = {
      autoExport: false,
      exportFormat: 'json',
      downloadPath: '社媒助手',
      maxFileSize: 50,
      collectMode: 'manual',
      theme: 'light'
    };

    try {
      const settings = await dbManager.get('settings', 'user');
      return { success: true, data: { ...defaultSettings, ...settings } };
    } catch (error) {
      return { success: true, data: defaultSettings };
    }
  },

  // 保存设置
  async saveSettings({ data }) {
    const settings = {
      key: 'user',
      ...data,
      updatedAt: Date.now()
    };
    await dbManager.put('settings', settings);
    return { success: true };
  }
};

// ==================== 辅助函数 ====================
function convertToCSV(items) {
  if (!items || items.length === 0) return '';

  const flattenObject = (obj, prefix = '') => {
    const result = {};
    for (const key in obj) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flattenObject(obj[key], newKey));
      } else {
        result[newKey] = obj[key];
      }
    }
    return result;
  };

  const flattenedItems = items.map(item => flattenObject(item));
  const headers = Object.keys(flattenedItems[0]);
  const csvRows = [headers.join(',')];

  for (const item of flattenedItems) {
    const values = headers.map(header => {
      const value = item[header];
      const stringValue = value === null || value === undefined ? '' : String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

function generateFilename(url, type) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const ext = type === 'video' ? 'mp4' : 'jpg';
  return `社媒助手/${timestamp}.${ext}`;
}

// ==================== 事件监听 ====================

// 消息总线
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const handler = messageHandlers[message.type];
      if (handler) {
        const result = await handler({ data: message.data, sender });
        sendResponse(result);
      } else {
        sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // 保持消息通道开启
});

// 安装/启动事件
chrome.runtime.onInstalled.addListener(async () => {
  console.log('社媒助手离线版已安装');
  await dbManager.init();
  await taskAlarmManager.init();
  
  // 设置侧边栏行为
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ 
      openPanelOnActionClick: true 
    }).catch(err => console.error('设置侧边栏行为失败:', err));
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await dbManager.init();
  await taskAlarmManager.init();
});

// 点击扩展图标
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  }
});

// 标签页更新事件 - 注入脚本
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const platform = detectPlatform(tab.url);
    if (platform) {
      console.log(`社媒助手: 检测到平台 - ${platform.name}`);

      // 注入UI脚本
      if (platform.injectUI) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/inject-ui.js']
          });
        } catch (error) {
          console.error('注入UI脚本失败:', error);
        }
      }

      // 注入平台特定脚本
      if (platform.injectScript) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: [`content-scripts/${platform.injectScript}`]
          });
        } catch (error) {
          console.error(`注入${platform.injectScript}失败:`, error);
        }
      }
    }
  }
});

// 定时任务触发
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const tasks = await taskAlarmManager.getAll();
  const task = tasks.find(t => t.id === alarm.name);
  
  if (!task || !task.enabled) {
    await chrome.alarms.clear(alarm.name);
    return;
  }

  const platform = PLATFORMS[task.platform];
  if (!platform) {
    await chrome.alarms.clear(alarm.name);
    return;
  }

  console.log(`${platform.name}的定时任务【${task.name}】开始执行`);

  // 创建新标签页打开平台
  const tab = await chrome.tabs.create({ url: platform.origin });
  
  // 重试机制：最多10次，间隔2秒
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const success = await messageHandlers.taskAlarm({
        data: { task, tabId: tab.id }
      });
      if (success) break;
    } catch (error) {
      console.error('定时任务执行重试:', error);
    }
  }
});

// 下载完成事件
chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('下载完成:', delta.id);
  }
});

console.log('社媒助手离线版后台服务已启动');
