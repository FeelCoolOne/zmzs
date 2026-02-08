// background.js - Service Worker

const CONFIG = {
  EXPORT_CHUNK_SIZE: 1000,
  MAX_EXPORT_SIZE: 50000
};

// 初始化侧边栏行为
chrome.sidePanel.setPanelBehavior({ 
  openPanelOnActionClick: true 
});

// 消息处理中心
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

// 打开侧边栏
async function handleOpenSidepanel(tab) {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('Failed to open sidepanel:', err);
  }
}

// 下载文件
async function handleDownloadFile(url, filename) {
  try {
    // filename 已经包含完整路径: 小红书/作者/笔记ID/文件名.jpg
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });
    console.log('[Background] Download started:', filename);
  } catch (err) {
    console.error('[Background] Download failed:', err);
  }
}

// 导出数据
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

// 转换为 CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const fields = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => fields.add(key));
    if (item.data) {
      Object.keys(item.data).forEach(key => fields.add(`data.${key}`));
    }
  });
  
  const fieldArray = Array.from(fields);
  let csv = '\ufeff' + fieldArray.join(',') + '\n';
  
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

// 广播消息到侧边栏
async function broadcastToSidepanel(data) {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    
    windows.forEach(window => {
      window.tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'BROADCAST_UPDATE',
          data
        }).catch(() => {});
      });
    });
  } catch (err) {
    console.error('Broadcast failed:', err);
  }
}

// 安装/更新事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    
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

// 错误处理
self.addEventListener('error', (e) => {
  console.error('Service Worker Error:', e.message);
});

self.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise Rejection:', e.reason);
});
