// sidepanel.js - 侧边栏逻辑

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
  btnFeishu: document.getElementById('btn-feishu'),
  stats: {
    total: document.getElementById('stat-total'),
    notes: document.getElementById('stat-notes'),
    users: document.getElementById('stat-users')
  },
  statusText: document.getElementById('status-text'),
  modal: document.getElementById('detail-modal'),
  detailContent: document.getElementById('detail-content'),
  feishuModal: document.getElementById('feishu-modal'),
  feishuAppId: document.getElementById('feishu-app-id'),
  feishuAppSecret: document.getElementById('feishu-app-secret'),
  feishuAppToken: document.getElementById('feishu-app-token'),
  feishuTableId: document.getElementById('feishu-table-id'),
  btnFeishuTest: document.getElementById('btn-feishu-test'),
  btnFeishuSave: document.getElementById('btn-feishu-save'),
  feishuModalClose: document.getElementById('feishu-modal-close')
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
  elements.btnFeishu.addEventListener('click', openFeishuModal);

  document.querySelector('.modal-close').addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });

  // 飞书配置弹窗事件
  elements.feishuModalClose.addEventListener('click', closeFeishuModal);
  elements.feishuModal.addEventListener('click', (e) => {
    if (e.target === elements.feishuModal) closeFeishuModal();
  });
  elements.btnFeishuTest.addEventListener('click', testFeishuConnection);
  elements.btnFeishuSave.addEventListener('click', saveFeishuConfig);
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
    search_result: '搜索',
    related_notes: '相关推荐',
    follows_list: '关注列表',
    fans_list: '粉丝列表',
    liked_notes: '点赞笔记',
    collected_notes: '收藏笔记',
    home_feed: '首页推荐',
    explore: '发现页',
    tag_notes: '标签笔记',
    notifications: '消息通知',
    shop_items: '商品',
    live_info: '直播间'
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

// 飞书配置相关函数
function openFeishuModal() {
  // 加载已有配置
  chrome.storage.local.get(['feishuConfig'], (result) => {
    if (result.feishuConfig) {
      elements.feishuAppId.value = result.feishuConfig.appId || '';
      elements.feishuAppSecret.value = result.feishuConfig.appSecret || '';
      elements.feishuAppToken.value = result.feishuConfig.appToken || '';
      elements.feishuTableId.value = result.feishuConfig.tableId || '';
    }
  });
  elements.feishuModal.classList.add('active');
}

function closeFeishuModal() {
  elements.feishuModal.classList.remove('active');
}

async function testFeishuConnection() {
  const config = {
    appId: elements.feishuAppId.value.trim(),
    appSecret: elements.feishuAppSecret.value.trim(),
    appToken: elements.feishuAppToken.value.trim(),
    tableId: elements.feishuTableId.value.trim()
  };

  if (!config.appId || !config.appSecret) {
    alert('请填写 App ID 和 App Secret');
    return;
  }

  updateStatus('正在测试飞书连接...');

  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret
      })
    });

    const data = await response.json();

    if (data.code === 0 && data.tenant_access_token) {
      if (config.appToken && config.tableId) {
        // 测试表格访问权限
        const tableResponse = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records?page_size=1`,
          {
            headers: { 'Authorization': `Bearer ${data.tenant_access_token}` }
          }
        );
        const tableData = await tableResponse.json();

        if (tableData.code === 0) {
          alert('✅ 连接成功！可以访问多维表格');
        } else {
          const errorMessages = {
            91402: '未找到指定的多维表格',
            91403: '没有权限访问此表格，请确保应用已添加到表格'
          };
          alert(`⚠️ 认证成功，但表格访问失败：${errorMessages[tableData.code] || tableData.msg}`);
        }
      } else {
        alert('✅ 认证成功！');
      }
    } else {
      alert('❌ 认证失败：' + (data.msg || '请检查 App ID 和 App Secret'));
    }
  } catch (error) {
    alert('❌ 连接失败：' + error.message);
  }

  updateStatus('就绪');
}

async function saveFeishuConfig() {
  const config = {
    appId: elements.feishuAppId.value.trim(),
    appSecret: elements.feishuAppSecret.value.trim(),
    appToken: elements.feishuAppToken.value.trim(),
    tableId: elements.feishuTableId.value.trim()
  };

  if (!config.appId || !config.appSecret || !config.appToken || !config.tableId) {
    alert('请填写所有必填项');
    return;
  }

  await chrome.storage.local.set({ feishuConfig: config });
  alert('✅ 飞书配置已保存');
  closeFeishuModal();
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
