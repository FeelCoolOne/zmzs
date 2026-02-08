# content.js 内容脚本设计文档

## 概述

content.js 在隔离环境（ISOLATED world）中运行，负责：
1. 接收 inject.js 发送的数据
2. 管理 IndexedDB 存储
3. 渲染悬浮操作按钮
4. 与 Service Worker 通信

## 模块结构

```
content.js
├── DBManager          # IndexedDB 管理类
├── FloatingButtonManager  # 悬浮按钮管理类
├── Event Handlers     # 事件监听处理
└── Message Handlers   # Chrome 消息处理
```

## 完整代码实现

```javascript
// content-scripts/content.js

// ==================== 配置 ====================
const CONFIG = {
  DB_NAME: 'XHSCollectorDB',
  DB_VERSION: 1,
  STORE_NAME: 'collectedItems',
  MAX_ITEMS: 10000
};

// ==================== IndexedDB 管理器 ====================
class DBManager {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
          const store = db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('noteId', 'data.noteId', { unique: false });
          store.createIndex('userId', 'data.userId', { unique: false });
        }
      };
    });
  }
  
  async save(item) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONFIG.STORE_NAME);
      
      // 检查是否已存在
      const checkIndex = item.data?.noteId ? 'noteId' : 
                        item.data?.userId ? 'userId' : null;
      
      if (checkIndex) {
        const checkRequest = store.index(checkIndex).get(item.data[checkIndex === 'noteId' ? 'noteId' : 'userId']);
        checkRequest.onsuccess = () => {
          if (checkRequest.result) {
            item.id = checkRequest.result.id;
          }
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve(item);
          putRequest.onerror = () => reject(putRequest.error);
        };
      } else {
        const request = store.put(item);
        request.onsuccess = () => resolve(item);
        request.onerror = () => reject(request.error);
      }
    });
  }
  
  async getAll(filters = {}) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_NAME], 'readonly');
      const store = transaction.objectStore(CONFIG.STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let data = request.result;
        
        if (filters.type) {
          data = data.filter(item => item.type === filters.type);
        }
        if (filters.startTime) {
          data = data.filter(item => item.timestamp >= filters.startTime);
        }
        if (filters.endTime) {
          data = data.filter(item => item.timestamp <= filters.endTime);
        }
        
        data.sort((a, b) => b.timestamp - a.timestamp);
        resolve(data);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async getStats() {
    const all = await this.getAll();
    const stats = { total: all.length, byType: {} };
    all.forEach(item => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
    });
    return stats;
  }
  
  async delete(id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONFIG.STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async clear() {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONFIG.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONFIG.STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ==================== 悬浮按钮管理器 ====================
class FloatingButtonManager {
  constructor() {
    this.container = null;
    this.isVisible = true;
    this.isExpanded = true;
  }
  
  create() {
    if (this.container) return;
    
    this.container = document.createElement('div');
    this.container.id = 'xhs-collector-float';
    this.container.innerHTML = this.getHTML();
    
    document.head.appendChild(this.getStyles());
    document.body.appendChild(this.container);
    
    this.bindEvents();
  }
  
  getHTML() {
    return `
      <div class="xhs-float-main">
        <button class="xhs-btn xhs-btn-primary" id="xhs-btn-collect" title="采集当前页面">💾</button>
        <button class="xhs-btn" id="xhs-btn-download" title="下载媒体">📥</button>
        <button class="xhs-btn" id="xhs-btn-copy" title="复制信息">📋</button>
        <button class="xhs-btn" id="xhs-btn-export" title="导出数据">📤</button>
        <button class="xhs-btn xhs-btn-toggle" id="xhs-btn-toggle" title="收起">◀</button>
      </div>
      <div class="xhs-float-collapsed" style="display: none;">
        <button class="xhs-btn xhs-btn-primary" id="xhs-btn-expand" title="展开">📕</button>
      </div>
    `;
  }
  
  getStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #xhs-collector-float {
        position: fixed;
        right: 20px;
        top: 100px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .xhs-float-main {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .xhs-btn {
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        cursor: pointer;
        font-size: 20px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .xhs-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .xhs-btn-primary {
        background: #ff2442;
        color: white;
      }
      .xhs-btn-toggle {
        font-size: 14px;
        color: #999;
      }
    `;
    return style;
  }
  
  bindEvents() {
    document.getElementById('xhs-btn-collect').addEventListener('click', () => this.collect());
    document.getElementById('xhs-btn-download').addEventListener('click', () => this.download());
    document.getElementById('xhs-btn-copy').addEventListener('click', () => this.showCopyMenu());
    document.getElementById('xhs-btn-export').addEventListener('click', () => this.export());
    document.getElementById('xhs-btn-toggle').addEventListener('click', () => this.toggle());
    document.getElementById('xhs-btn-expand').addEventListener('click', () => this.toggle());
  }
  
  toggle() {
    const main = this.container.querySelector('.xhs-float-main');
    const collapsed = this.container.querySelector('.xhs-float-collapsed');
    main.style.display = this.isExpanded ? 'none' : 'flex';
    collapsed.style.display = this.isExpanded ? 'block' : 'none';
    this.isExpanded = !this.isExpanded;
  }
  
  async collect() {
    const data = await this.extractPageData();
    if (data) {
      await dbManager.save({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: data.type,
        data: data.data,
        timestamp: Date.now(),
        platform: 'xiaohongshu',
        url: location.href,
        source: 'manual'
      });
      this.showToast('✅ 采集成功');
      chrome.runtime.sendMessage({ type: 'DATA_UPDATED' });
    } else {
      this.showToast('❌ 未找到数据');
    }
  }
  
  async extractPageData() {
    const state = window.__INITIAL_STATE__ || window.__INITIAL_SSR_STATE__;
    
    if (state?.note?.noteDetailMap) {
      const noteId = Object.keys(state.note.noteDetailMap)[0];
      return { type: 'note_info', data: state.note.noteDetailMap[noteId] };
    }
    
    if (state?.user?.userDetailMap) {
      const userId = Object.keys(state.user.userDetailMap)[0];
      return { type: 'user_info', data: state.user.userDetailMap[userId] };
    }
    
    return null;
  }
  
  async download() {
    const state = window.__INITIAL_STATE__;
    let url, filename;
    
    if (state?.note?.noteDetailMap) {
      const noteId = Object.keys(state.note.noteDetailMap)[0];
      const note = state.note.noteDetailMap[noteId];
      
      if (note.video?.url) {
        url = note.video.url;
        filename = `xhs_video_${noteId}.mp4`;
      } else if (note.images?.[0]) {
        url = note.images[0].url;
        filename = `xhs_image_${noteId}.jpg`;
      }
    }
    
    if (url) {
      chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE', url, filename });
      this.showToast('📥 开始下载');
    } else {
      this.showToast('❌ 未找到媒体');
    }
  }
  
  showCopyMenu() {
    const menu = document.createElement('div');
    menu.className = 'xhs-copy-menu';
    menu.innerHTML = `
      <div class="xhs-menu-item" data-action="title">复制标题</div>
      <div class="xhs-menu-item" data-action="desc">复制描述</div>
      <div class="xhs-menu-item" data-action="link">复制链接</div>
      <div class="xhs-menu-item" data-action="author">复制作者</div>
    `;
    
    menu.style.cssText = `
      position: absolute;
      right: 60px;
      top: 90px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 8px 0;
      min-width: 120px;
      z-index: 1000000;
    `;
    
    this.container.appendChild(menu);
    
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 100);
    
    menu.querySelectorAll('.xhs-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.copyToClipboard(item.dataset.action);
        menu.remove();
      });
    });
  }
  
  async copyToClipboard(action) {
    const state = window.__INITIAL_STATE__;
    let text = '';
    
    if (state?.note?.noteDetailMap) {
      const noteId = Object.keys(state.note.noteDetailMap)[0];
      const note = state.note.noteDetailMap[noteId];
      
      switch(action) {
        case 'title': text = note.title || ''; break;
        case 'desc': text = note.desc || ''; break;
        case 'link': text = `https://www.xiaohongshu.com/explore/${noteId}`; break;
        case 'author': text = note.user?.nickname || ''; break;
      }
    }
    
    if (text) {
      await navigator.clipboard.writeText(text);
      this.showToast('✅ 已复制');
    }
  }
  
  export() {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  }
  
  showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      right: 80px;
      top: 110px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000001;
    `;
    this.container.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

// ==================== 初始化 ====================
const dbManager = new DBManager();
const floatManager = new FloatingButtonManager();

// 监听 inject.js 数据
window.addEventListener('smzs:response', async (e) => {
  try {
    await dbManager.save(e.detail);
    console.log('[XHS-Collector] Saved:', e.detail.type);
  } catch(err) {
    console.error('[XHS-Collector] Save failed:', err);
  }
});

window.addEventListener('smzs:initialState', async (e) => {
  const { data } = e.detail;
  
  if (data?.note?.noteDetailMap) {
    for (const [noteId, note] of Object.entries(data.note.noteDetailMap)) {
      await dbManager.save({
        id: `${Date.now()}-${noteId}`,
        type: 'note_info',
        data: note,
        timestamp: Date.now(),
        platform: 'xiaohongshu',
        url: location.href,
        source: 'initial_state'
      });
    }
  }
  
  if (data?.user?.userDetailMap) {
    for (const [userId, user] of Object.entries(data.user.userDetailMap)) {
      await dbManager.save({
        id: `${Date.now()}-${userId}`,
        type: 'user_info',
        data: user,
        timestamp: Date.now(),
        platform: 'xiaohongshu',
        url: location.href,
        source: 'initial_state'
      });
    }
  }
});

// 监听 Service Worker 消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.type) {
    case 'GET_ALL_DATA':
      dbManager.getAll(request.filters).then(data => sendResponse({ data }));
      return true;
    case 'GET_STATS':
      dbManager.getStats().then(stats => sendResponse({ stats }));
      return true;
    case 'DELETE_ITEM':
      dbManager.delete(request.id).then(() => sendResponse({ success: true }));
      return true;
    case 'CLEAR_ALL':
      dbManager.clear().then(() => sendResponse({ success: true }));
      return true;
  }
});

// 页面加载完成后创建悬浮按钮
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => floatManager.create());
} else {
  floatManager.create();
}
```

## 关键设计点

### 1. IndexedDB 封装

| 方法 | 功能 | 说明 |
|------|------|------|
| `save()` | 保存数据 | 自动去重，更新已有数据 |
| `getAll()` | 查询所有 | 支持过滤器 |
| `getStats()` | 统计信息 | 按类型统计数量 |
| `delete()` | 删除单条 | 按 ID 删除 |
| `clear()` | 清空所有 | 删除全部数据 |

### 2. 悬浮按钮交互

```
采集 -> 提取页面数据 -> 保存到 IndexedDB -> 通知更新
下载 -> 提取媒体URL -> 发送下载消息
复制 -> 显示菜单 -> 复制到剪贴板
导出 -> 打开侧边栏
```

### 3. 数据流

```
inject.js (MAIN) 
    |
    v
CustomEvent (smzs:response / smzs:initialState)
    |
    v
content.js (ISOLATED)
    |
    v
IndexedDB (本地存储)
    |
    v
Chrome Message (响应查询请求)
```

## 注意事项

1. **隔离环境限制**: 无法直接访问页面 JS 变量，需通过 inject.js 传递
2. **IndexedDB 异步**: 所有操作返回 Promise
3. **消息通信**: 使用 `chrome.runtime.sendMessage` 与 background 通信
4. **DOM 操作**: 在隔离环境中操作 DOM 不会影响页面
