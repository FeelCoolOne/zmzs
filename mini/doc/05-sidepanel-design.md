# sidepanel 侧边栏 UI 设计文档

## 概述

侧边栏是插件的主要操作界面，提供数据展示、筛选、导出等功能。

## 界面结构

```
sidepanel.html
├── Header (头部)
│   ├── Logo & Title
│   └── Stats (统计数据)
├── Toolbar (工具栏)
│   ├── Filter (筛选器)
│   └── Actions (操作按钮)
├── Content (内容区)
│   └── Data List (数据列表)
├── Footer (底部)
│   ├── Status (状态)
│   └── Version (版本)
└── Modal (弹窗)
    └── Detail View (详情查看)
```

## HTML 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>小红书采集助手</title>
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <!-- 头部 -->
  <header class="header">
    <div class="logo">
      <span class="logo-icon">📕</span>
      <h1>小红书采集助手</h1>
    </div>
    <div class="stats">
      <div class="stat-item">
        <span class="stat-value" id="stat-total">0</span>
        <span class="stat-label">已采集</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-notes">0</span>
        <span class="stat-label">笔记</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-users">0</span>
        <span class="stat-label">用户</span>
      </div>
    </div>
  </header>

  <!-- 工具栏 -->
  <div class="toolbar">
    <div class="filter-group">
      <select id="filter-type" class="select">
        <option value="all">全部类型</option>
        <option value="note_info">笔记</option>
        <option value="note_list">笔记列表</option>
        <option value="user_info">用户</option>
        <option value="comment_info">评论</option>
      </select>
      <input type="text" id="filter-search" class="input" placeholder="搜索标题/作者...">
    </div>
    <div class="action-group">
      <button id="btn-refresh" class="btn btn-icon" title="刷新">🔄</button>
      <button id="btn-export-json" class="btn">导出 JSON</button>
      <button id="btn-export-csv" class="btn">导出 CSV</button>
      <button id="btn-clear" class="btn btn-danger">清空</button>
    </div>
  </div>

  <!-- 数据列表 -->
  <div class="content">
    <div id="data-list" class="data-list">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>暂无采集数据</p>
        <p class="empty-hint">访问小红书页面开始采集</p>
      </div>
    </div>
  </div>

  <!-- 底部 -->
  <footer class="footer">
    <span id="status-text">就绪</span>
    <span id="version">v1.0.0</span>
  </footer>

  <!-- 详情弹窗 -->
  <div id="detail-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>数据详情</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <pre id="detail-content"></pre>
      </div>
    </div>
  </div>

  <script src="sidepanel.js"></script>
</body>
</html>
```

## CSS 样式

```css
/* sidepanel.css */

:root {
  --primary: #ff2442;
  --primary-hover: #e0203c;
  --bg: #f5f5f5;
  --card-bg: #ffffff;
  --text: #333333;
  --text-secondary: #666666;
  --border: #e0e0e0;
  --shadow: 0 2px 8px rgba(0,0,0,0.08);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.header {
  background: var(--card-bg);
  padding: 16px;
  box-shadow: var(--shadow);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.logo-icon {
  font-size: 24px;
}

.logo h1 {
  font-size: 16px;
  font-weight: 600;
}

.stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 工具栏 */
.toolbar {
  background: var(--card-bg);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-group {
  display: flex;
  gap: 8px;
}

.select, .input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
}

.select {
  min-width: 120px;
}

.input {
  flex: 1;
}

.action-group {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--primary);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  background: var(--primary-hover);
}

.btn-danger {
  background: #ff4d4f;
}

.btn-icon {
  padding: 8px;
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-item {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 12px;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.2s;
}

.data-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.item-type.note_info { background: #e6f7ff; color: #1890ff; }
.item-type.user_info { background: #f6ffed; color: #52c41a; }
.item-type.comment_info { background: #fff7e6; color: #fa8c16; }

.item-time {
  font-size: 11px;
  color: var(--text-secondary);
}

.item-title {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 12px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 12px;
  margin-top: 8px;
}

/* 底部 */
.footer {
  background: var(--card-bg);
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 弹窗 */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  align-items: center;
  justify-content: center;
}

.modal.active {
  display: flex;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 12px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
  overflow: auto;
}

.modal-body pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  overflow-x: auto;
}
```

## JavaScript 逻辑

```javascript
// sidepanel.js

const state = {
  data: [],
  filteredData: [],
  filters: { type: 'all', search: '' },
  isLoading: false
};

const elements = {
  dataList: document.getElementById('data-list'),
  filterType: document.getElementById('filter-type'),
  filterSearch: document.getElementById('filter-search'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnClear: document.getElementById('btn-clear'),
  stats: {
    total: document.getElementById('stat-total'),
    notes: document.getElementById('stat-notes'),
    users: document.getElementById('stat-users')
  },
  statusText: document.getElementById('status-text'),
  modal: document.getElementById('detail-modal'),
  detailContent: document.getElementById('detail-content')
};

function init() {
  bindEvents();
  loadData();
  setInterval(loadData, 5000);
}

function bindEvents() {
  elements.filterType.addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    applyFilters();
  });
  
  elements.filterSearch.addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase();
    applyFilters();
  });
  
  elements.btnRefresh.addEventListener('click', loadData);
  elements.btnExportJson.addEventListener('click', () => exportData('json'));
  elements.btnExportCsv.addEventListener('click', () => exportData('csv'));
  elements.btnClear.addEventListener('click', clearAllData);
  
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });
}

async function loadData() {
  state.isLoading = true;
  updateStatus('加载中...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      updateStatus('无法获取当前页面');
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_ALL_DATA',
      filters: {}
    });
    
    if (response?.data) {
      state.data = response.data;
      applyFilters();
      updateStats();
      updateStatus(`已加载 ${state.data.length} 条数据`);
    }
  } catch (err) {
    updateStatus('加载失败');
  } finally {
    state.isLoading = false;
  }
}

function applyFilters() {
  let result = state.data;
  
  if (state.filters.type !== 'all') {
    result = result.filter(item => item.type === state.filters.type);
  }
  
  if (state.filters.search) {
    const keyword = state.filters.search;
    result = result.filter(item => {
      const data = item.data || {};
      return (
        (data.title && data.title.toLowerCase().includes(keyword)) ||
        (data.nickname && data.nickname.toLowerCase().includes(keyword)) ||
        (data.desc && data.desc.toLowerCase().includes(keyword))
      );
    });
  }
  
  state.filteredData = result;
  renderDataList();
}

function renderDataList() {
  if (state.filteredData.length === 0) {
    elements.dataList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>${state.data.length === 0 ? '暂无采集数据' : '无匹配结果'}</p>
      </div>
    `;
    return;
  }
  
  const typeLabels = {
    note_info: '笔记',
    note_list: '笔记列表',
    user_info: '用户',
    comment_info: '评论',
    search_result: '搜索'
  };
  
  elements.dataList.innerHTML = state.filteredData.map(item => {
    const title = getItemTitle(item);
    const meta = getItemMeta(item);
    
    return `
      <div class="data-item" data-id="${item.id}">
        <div class="item-header">
          <span class="item-type ${item.type}">${typeLabels[item.type] || item.type}</span>
          <span class="item-time">${formatTime(item.timestamp)}</span>
        </div>
        <div class="item-title">${escapeHtml(title)}</div>
        <div class="item-meta">${meta}</div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.data-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = state.data.find(d => d.id === el.dataset.id);
      if (item) showDetail(item);
    });
  });
}

function getItemTitle(item) {
  const data = item.data || {};
  switch(item.type) {
    case 'note_info':
    case 'note_list':
      return data.title || data.desc?.slice(0, 50) || '无标题';
    case 'user_info':
      return data.nickname || '未知用户';
    case 'comment_info':
      return data.content?.slice(0, 50) || '无内容';
    default:
      return '未知数据';
  }
}

function getItemMeta(item) {
  const data = item.data || {};
  const parts = [];
  
  if (data.author?.nickname) {
    parts.push(`👤 ${data.author.nickname}`);
  }
  if (data.likes !== undefined) {
    parts.push(`❤️ ${data.likes}`);
  }
  if (data.comments !== undefined) {
    parts.push(`💬 ${data.comments}`);
  }
  
  return parts.join(' · ') || '暂无详情';
}

function updateStats() {
  elements.stats.total.textContent = state.data.length;
  elements.stats.notes.textContent = state.data.filter(i => i.type === 'note_info').length;
  elements.stats.users.textContent = state.data.filter(i => i.type === 'user_info').length;
}

async function exportData(format) {
  if (state.data.length === 0) {
    alert('暂无数据可导出');
    return;
  }
  
  updateStatus('导出中...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EXPORT_DATA',
      data: state.data,
      format
    });
    
    if (response?.success) {
      updateStatus(`已导出 ${response.count} 条数据`);
    }
  } catch (err) {
    updateStatus('导出失败');
  }
}

async function clearAllData() {
  if (!confirm('确定要清空所有数据吗？')) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_ALL' });
      state.data = [];
      state.filteredData = [];
      renderDataList();
      updateStats();
      updateStatus('数据已清空');
    }
  } catch (err) {
    updateStatus('清空失败');
  }
}

function showDetail(item) {
  elements.detailContent.textContent = JSON.stringify(item, null, 2);
  elements.modal.classList.add('active');
}

function closeModal() {
  elements.modal.classList.remove('active');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateStatus(text) {
  elements.statusText.textContent = text;
}

init();
```

## 交互流程

```
用户操作 -> 更新状态 -> 发送消息 -> 接收响应 -> 更新UI
```

## 注意事项

1. **性能优化**: 大数据量时使用虚拟列表
2. **错误处理**: 所有异步操作需要 try-catch
3. **状态管理**: 使用单一状态对象管理数据
4. **实时更新**: 定时刷新保持数据同步
