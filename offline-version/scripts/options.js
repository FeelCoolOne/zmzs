class OptionsPage {
  constructor() {
    this.dbManager = new IndexedDBManager();
    this.settings = {};
    this.init();
  }

  async init() {
    try {
      await this.dbManager.init();
      await this.loadSettings();
      await this.loadStatistics();
      this.bindEvents();
    } catch (error) {
      console.error('初始化失败:', error);
      this.showToast('初始化失败，请刷新页面重试', 'error');
    }
  }

  bindEvents() {
    document.getElementById('saveBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAll());
    document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
  }

  async loadSettings() {
    try {
      const result = await this.sendMessage('getSettings');
      if (result && result.success) {
        this.settings = result.data;
        this.applySettings();
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  applySettings() {
    document.getElementById('autoExport').checked = this.settings.autoExport || false;
    document.getElementById('exportFormat').value = this.settings.exportFormat || 'json';
    document.getElementById('downloadPath').value = this.settings.downloadPath || '社媒助手';
    document.getElementById('maxFileSize').value = this.settings.maxFileSize || 50;
    document.getElementById('collectMode').value = this.settings.collectMode || 'manual';
    document.getElementById('collectInterval').value = this.settings.collectInterval || 5;
  }

  async loadStatistics() {
    try {
      const result = await this.sendMessage('getStatistics');
      if (result && result.success) {
        const stats = result.data;
        document.getElementById('statCollected').textContent = stats.collectedItems || 0;
        document.getElementById('statMedia').textContent = stats.mediaFiles || 0;
        document.getElementById('statDownloads').textContent = stats.downloads || 0;
        document.getElementById('statExports').textContent = stats.exports || 0;
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  async saveSettings() {
    try {
      const settings = {
        autoExport: document.getElementById('autoExport').checked,
        exportFormat: document.getElementById('exportFormat').value,
        downloadPath: document.getElementById('downloadPath').value.trim() || '社媒助手',
        maxFileSize: parseInt(document.getElementById('maxFileSize').value) || 50,
        collectMode: document.getElementById('collectMode').value,
        collectInterval: parseInt(document.getElementById('collectInterval').value) || 5
      };

      await this.sendMessage('saveSettings', settings);
      this.settings = settings;
      this.showToast('设置已保存', 'success');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showToast('保存设置失败', 'error');
    }
  }

  async exportAll() {
    try {
      const format = await this.showExportDialog();
      if (!format) return;

      this.showToast('正在导出所有数据...', 'info');
      await this.sendMessage('exportData', { format });
      this.showToast('导出成功！', 'success');
      await this.loadStatistics();
    } catch (error) {
      console.error('导出失败:', error);
      this.showToast('导出失败', 'error');
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

  async clearAll() {
    const confirmed = confirm('确定要清空所有数据吗？此操作不可恢复！\n\n请输入 "确认" 来继续操作。');

    if (confirmed !== '确认') {
      this.showToast('操作已取消', 'info');
      return;
    }

    try {
      await this.sendMessage('clearAll');
      this.showToast('所有数据已清空', 'success');
      await this.loadStatistics();
    } catch (error) {
      console.error('清空数据失败:', error);
      this.showToast('清空数据失败', 'error');
    }
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

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

const optionsPage = new OptionsPage();
