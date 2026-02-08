class SidePanel {
  constructor() {
    this.dbManager = new IndexedDBManager();
    this.init();
  }

  async init() {
    try {
      await this.dbManager.init();
      this.bindEvents();
      await this.loadStatistics();
      await this.loadRecentItems();
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败，请刷新页面重试');
    }
  }

  bindEvents() {
    document.getElementById('refreshBtn').addEventListener('click', () => this.refresh());
    document.getElementById('testBtn').addEventListener('click', () => this.runTests());
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('collectBtn').addEventListener('click', () => this.collectCurrentPage());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('clearBtn').addEventListener('click', () => this.clearData());
  }

  async loadStatistics() {
    try {
      const stats = await this.sendMessage('getStatistics');
      if (stats && stats.success) {
        document.getElementById('collectedCount').textContent = stats.data.collectedItems || 0;
        document.getElementById('mediaCount').textContent = stats.data.mediaFiles || 0;
        document.getElementById('downloadCount').textContent = stats.data.downloads || 0;
        document.getElementById('exportCount').textContent = stats.data.exports || 0;
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  async loadRecentItems() {
    try {
      const result = await this.sendMessage('getCollectedItems', { limit: 5 });
      if (result && result.success) {
        this.renderRecentItems(result.data);
      }
    } catch (error) {
      console.error('加载最近采集失败:', error);
    }
  }

  renderRecentItems(items) {
    const container = document.getElementById('recentItems');

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>暂无采集数据</p>
        </div>
      `;
      return;
    }

    const platformNames = {
      xiaohongshu: '小红书',
      douyin: '抖音',
      kuaishou: '快手',
      tiktok: 'TikTok',
      xingtu: '星图'
    };

    const platformIcons = {
      xiaohongshu: 'assets/xiaohongshu.svg',
      douyin: 'assets/douyin.svg',
      kuaishou: 'assets/kuaishou.svg',
      tiktok: 'assets/tiktok.svg',
      xingtu: 'assets/xingtu.svg'
    };

    container.innerHTML = items.map(item => {
      const platformName = platformNames[item.platform] || item.platform;
      const platformIcon = platformIcons[item.platform] || '';
      const time = this.formatTime(item.collectedAt);
      const title = this.getItemTitle(item);

      return `
        <div class="recent-item">
          <img src="${platformIcon}" class="recent-item-icon" alt="${platformName}" onerror="this.style.display='none'">
          <div class="recent-item-content">
            <div class="recent-item-title">${title}</div>
            <div class="recent-item-time">${time}</div>
          </div>
          <div class="recent-item-actions">
            <button class="recent-item-action" onclick="sidePanel.deleteItem('${item.id}')" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  getItemTitle(item) {
    if (item.rawData && item.rawData.title) {
      return item.rawData.title;
    }
    if (item.rawData && item.rawData.desc) {
      return item.rawData.desc;
    }
    if (item.rawData && item.rawData.nickname) {
      return item.rawData.nickname;
    }
    return `${item.type} - ${item.platform}`;
  }

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)} 分钟前`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)} 小时前`;
    } else {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  }

  async collectCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        this.showError('无法获取当前标签页');
        return;
      }

      const result = await chrome.tabs.sendMessage(tab.id, { type: 'getPageInfo' });
      if (result && result.success) {
        this.showSuccess('开始采集当前页面...');
        await this.refresh();
      } else {
        this.showError('无法获取页面信息');
      }
    } catch (error) {
      console.error('采集失败:', error);
      this.showError('采集失败，请确保在支持的平台上');
    }
  }

  async exportData() {
    try {
      const format = await this.showExportDialog();
      if (!format) return;

      this.showSuccess('正在导出数据...');
      await this.sendMessage('exportData', { format });
      this.showSuccess('导出成功！');
      await this.refresh();
    } catch (error) {
      console.error('导出失败:', error);
      this.showError('导出失败');
    }
  }

  async showExportDialog() {
    return new Promise((resolve) => {
      const format = prompt('请选择导出格式:\n1. JSON\n2. CSV\n3. XLSX\n\n请输入数字 (1-3):', '1');

      if (format === null) {
        resolve(null);
        return;
      }

      switch (format.trim()) {
        case '1':
          resolve('json');
          break;
        case '2':
          resolve('csv');
          break;
        case '3':
          resolve('xlsx');
          break;
        default:
          alert('无效的格式选择');
          resolve(null);
      }
    });
  }

  async clearData() {
    const confirmed = confirm('确定要清空所有数据吗？此操作不可恢复！');
    if (!confirmed) return;

    try {
      await this.sendMessage('clearAll');
      this.showSuccess('数据已清空');
      await this.refresh();
    } catch (error) {
      console.error('清空数据失败:', error);
      this.showError('清空数据失败');
    }
  }

  async deleteItem(id) {
    const confirmed = confirm('确定要删除这条数据吗？');
    if (!confirmed) return;

    try {
      await this.sendMessage('deleteItem', { id });
      this.showSuccess('删除成功');
      await this.refresh();
    } catch (error) {
      console.error('删除失败:', error);
      this.showError('删除失败');
    }
  }

  async refresh() {
    await this.loadStatistics();
    await this.loadRecentItems();
  }

  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  async runTests() {
    this.showSuccess('开始运行测试...');

    const tests = [];

    tests.push({
      name: '扩展是否加载',
      test: async () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          return { success: true, message: '扩展已加载' };
        }
        return { success: false, message: '扩展未加载' };
      }
    });

    tests.push({
      name: 'IndexedDB 是否可用',
      test: async () => {
        return new Promise((resolve) => {
          const request = indexedDB.open('SocialMediaAssistant', 1);
          request.onsuccess = () => {
            request.result.close();
            resolve({ success: true, message: 'IndexedDB 可用' });
          };
          request.onerror = () => {
            resolve({ success: false, message: 'IndexedDB 不可用' });
          };
        });
      }
    });

    tests.push({
      name: '后台服务是否运行',
      test: async () => {
        try {
          const response = await this.sendMessage('getStatistics');
          if (response && response.success) {
            return { success: true, message: '后台服务运行正常' };
          }
          return { success: false, message: '后台服务无响应' };
        } catch (error) {
          return { success: false, message: `错误: ${error.message}` };
        }
      }
    });

    tests.push({
      name: '侧边栏是否可用',
      test: async () => {
        if (chrome.sidePanel) {
          return { success: true, message: '侧边栏功能可用' };
        }
        return { success: false, message: '侧边栏功能不可用' };
      }
    });

    const results = [];
    for (const test of tests) {
      try {
        const result = await test.test();
        results.push({ name: test.name, ...result });
      } catch (error) {
        results.push({ name: test.name, success: false, message: `错误: ${error.message}` });
      }
    }

    console.log('=== 测试结果 ===');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${index + 1}. ${result.name}: ${result.message}`);
    });

    const passedCount = results.filter(r => r.success).length;
    this.showSuccess(`测试完成！${passedCount}/${results.length} 通过`);
  }

  sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#52c41a' : type === 'error' ? '#ff4d4f' : '#1890ff'};
      color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

const sidePanel = new SidePanel();
window.sidePanel = sidePanel;
