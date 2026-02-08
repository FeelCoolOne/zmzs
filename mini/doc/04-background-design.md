# background.js Service Worker 设计文档

## 概述

background.js 作为 Service Worker 运行，负责：
1. 管理侧边栏生命周期
2. 处理文件下载
3. 数据导出功能
4. 消息转发和广播

## 核心功能

| 功能 | 说明 |
|------|------|
| 侧边栏管理 | 打开/关闭侧边栏面板 |
| 文件下载 | 处理媒体文件下载请求 |
| 数据导出 | JSON/CSV 格式导出 |
| 消息处理 | 接收并处理各类消息 |

## 完整代码实现

```javascript
// background.js

// ==================== 配置 ====================
const CONFIG = {
  EXPORT_CHUNK_SIZE: 1000,
  MAX_EXPORT_SIZE: 50000
};

// ==================== 初始化 ====================
chrome.sidePanel.setPanelBehavior({ 
  openPanelOnActionClick: true 
});

// ==================== 消息处理中心 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received:', request.type);
  
  switch(request.type) {
    case 'OPEN_SIDEPANEL':
      handleOpenSidepanel(sender.tab);
      sendResponse({ success: true });
      break;
      
    case 'DOWNLOAD_FILE':
      handleDownloadFile(request.url, request.filename);
      sendResponse({ success: true });
      break;
      
    case 'EXPORT_DATA':
      handleExportData(request.data, request.format)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ error: err.message }));
      return true;
      
    case 'DATA_UPDATED':
      broadcastToSidepanel(request);
      sendResponse({ success: true });
      break;
  }
});

// ==================== 功能处理函数 ====================

/**
 * 打开侧边栏
 */
async function handleOpenSidepanel(tab) {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('Failed to open sidepanel:', err);
  }
}

/**
 * 下载文件
 */
async function handleDownloadFile(url, filename) {
  try {
    await chrome.downloads.download({
      url: url,
      filename: `xhs-collector/${filename}`,
      saveAs: false
    });
  } catch (err) {
    console.error('Download failed:', err);
  }
}

/**
 * 导出数据
 */
async function handleExportData(data, format) {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }
  
  const timestamp = Date.now();
  let content, mimeType, extension, filename;
  
  switch(format) {
    case 'json':
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      extension = 'json';
      filename = `xhs-data-${timestamp}.json`;
      break;
      
    case 'csv':
      content = convertToCSV(data);
      mimeType = 'text/csv;charset=utf-8';
      extension = 'csv';
      filename = `xhs-data-${timestamp}.csv`;
      break;
      
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  await chrome.downloads.download({
    url: url,
    filename: `xhs-exports/${filename}`,
    saveAs: true
  });
  
  URL.revokeObjectURL(url);
  
  return { 
    success: true, 
    filename, 
    count: data.length,
    format 
  };
}

/**
 * 转换为 CSV 格式
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  // 提取所有字段
  const fields = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => fields.add(key));
    if (item.data) {
      Object.keys(item.data).forEach(key => fields.add(`data.${key}`));
    }
  });
  
  const fieldArray = Array.from(fields);
  
  // 表头
  let csv = '\ufeff' + fieldArray.join(',') + '\n';
  
  // 数据行
  data.forEach(item => {
    const row = fieldArray.map(field => {
      let value;
      
      if (field.startsWith('data.')) {
        const key = field.slice(5);
        value = item.data?.[key];
      } else {
        value = item[field];
      }
      
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // 转义 CSV 特殊字符
      value = String(value).replace(/"/g, '""');
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value}"`;
      }
      
      return value;
    });
    
    csv += row.join(',') + '\n';
  });
  
  return csv;
}

/**
 * 广播消息到侧边栏
 */
async function broadcastToSidepanel(data) {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    
    windows.forEach(window => {
      window.tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'BROADCAST_UPDATE',
          data
        }).catch(() => {
          // 忽略错误
        });
      });
    });
  } catch (err) {
    console.error('Broadcast failed:', err);
  }
}

// ==================== 生命周期事件 ====================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    
    // 初始化默认设置
    chrome.storage.local.set({
      settings: {
        autoCollect: false,
        exportFormat: 'json',
        maxItems: 10000
      }
    });
  }
  
  if (details.reason === 'update') {
    console.log('Extension updated from', details.previousVersion);
  }
});

// ==================== 错误处理 ====================

self.addEventListener('error', (e) => {
  console.error('Service Worker Error:', e.message);
});

self.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise Rejection:', e.reason);
});
```

## 消息类型说明

| 消息类型 | 方向 | 参数 | 返回值 |
|---------|------|------|--------|
| `OPEN_SIDEPANEL` | content -> background | - | `{ success: boolean }` |
| `DOWNLOAD_FILE` | content -> background | `url`, `filename` | `{ success: boolean }` |
| `EXPORT_DATA` | sidepanel -> background | `data`, `format` | `{ success, filename, count }` |
| `DATA_UPDATED` | content -> background | - | `{ success: boolean }` |
| `BROADCAST_UPDATE` | background -> all | `data` | - |

## CSV 导出格式

### 字段命名规则

```
基础字段: id, type, timestamp, platform, url, source
data 字段: data.noteId, data.title, data.likes, ...
```

### 示例输出

```csv
id,type,timestamp,data.noteId,data.title,data.likes
123,note_info,1704067200000,abc123,笔记标题,1000
```

## 注意事项

1. **Service Worker 生命周期**: 空闲时会被终止，不要依赖全局状态
2. **异步处理**: 使用 `return true` 保持消息通道开启
3. **错误处理**: 使用 try-catch 包裹异步操作
4. **资源释放**: 使用 `URL.revokeObjectURL` 释放 Blob URL
