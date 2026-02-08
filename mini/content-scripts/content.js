// content.js - 隔离环境脚本

const CONFIG = {
  DB_NAME: 'XHSCollectorDB',
  DB_VERSION: 1,
  STORE_NAME: 'collectedItems',
  MAX_ITEMS: 10000
};

// IndexedDB 管理器
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

// 悬浮按钮管理器 - 参考原版设计
class FloatingButtonManager {
  constructor() {
    this.container = null;
    this.currentNoteData = null;
    this.currentUserData = null;
    this.currentComments = []; // 存储当前笔记的评论
    this.isVisible = true;
  }

  create() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'smzs-function-buttons';
    this.container.innerHTML = this.getHTML();

    document.head.appendChild(this.getStyles());
    document.body.appendChild(this.container);

    this.bindEvents();
    this.startDataWatcher();
  }

  getHTML() {
    return `
      <div class="smzs-btn-group">
        <button class="smzs-btn smzs-btn-download" title="下载图片/视频">
          <span class="smzs-icon">📥</span>
          <span class="smzs-text">下载图片</span>
        </button>
        
        <div class="smzs-dropdown">
          <button class="smzs-btn smzs-btn-copy" title="复制笔记信息">
            <span class="smzs-icon">📋</span>
            <span class="smzs-text">复制笔记信息 ▼</span>
          </button>
          <div class="smzs-dropdown-menu">
            <div class="smzs-menu-item" data-action="noteId">📋 复制笔记ID</div>
            <div class="smzs-menu-item" data-action="title">📝 复制笔记标题</div>
            <div class="smzs-menu-item" data-action="desc">📄 复制笔记内容</div>
            <div class="smzs-menu-item" data-action="authorId">👤 复制博主ID</div>
            <div class="smzs-menu-item" data-action="authorNickname">🏷️ 复制博主昵称</div>
          </div>
        </div>
        
        <button class="smzs-btn smzs-btn-feishu" title="同步到飞书">
          <span class="smzs-icon">🚀</span>
          <span class="smzs-text">同步飞书</span>
        </button>
        
        <button class="smzs-btn smzs-btn-report" title="数据上报">
          <span class="smzs-icon">📊</span>
          <span class="smzs-text">数据上报</span>
        </button>
        
        <div class="smzs-dropdown">
          <button class="smzs-btn smzs-btn-export" title="导出评论">
            <span class="smzs-icon">�</span>
            <span class="smzs-text">导出评论 ▼</span>
          </button>
          <div class="smzs-dropdown-menu">
            <div class="smzs-menu-item" data-action="export-txt">📝 导出为 TXT</div>
            <div class="smzs-menu-item" data-action="export-json">📋 导出为 JSON</div>
            <div class="smzs-menu-item" data-action="export-csv">📊 导出为 CSV</div>
          </div>
        </div>
      </div>
    `;
  }

  getStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #smzs-function-buttons {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      
      .smzs-btn-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .smzs-btn {
        padding: 10px 16px;
        border-radius: 20px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        color: white;
        min-width: 130px;
        justify-content: flex-start;
      }
      
      .smzs-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      
      .smzs-btn-download {
        background: linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%);
      }
      
      .smzs-btn-copy {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
      
      .smzs-btn-export {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }
      
      .smzs-btn-collect {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }
      
      .smzs-btn-feishu {
        background: linear-gradient(135deg, #3370ff 0%, #7b61ff 100%);
      }
      
      .smzs-btn-report {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }
      
      .smzs-icon {
        font-size: 14px;
      }
      
      .smzs-text {
        white-space: nowrap;
      }
      
      .smzs-dropdown {
        position: relative;
      }
      
      .smzs-dropdown-menu {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-top: 4px;
        overflow: hidden;
        z-index: 100000;
        min-width: 150px;
      }
      
      .smzs-dropdown.active .smzs-dropdown-menu {
        display: block;
      }
      
      .smzs-menu-item {
        padding: 10px 16px;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        transition: background 0.2s;
        white-space: nowrap;
      }
      
      .smzs-menu-item:hover {
        background: #f5f5f5;
      }
      
      .smzs-notification {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        animation: smzsSlideDown 0.3s ease-out;
      }
      
      .smzs-notification-success {
        background: #52c41a;
        color: white;
      }
      
      .smzs-notification-error {
        background: #ff4d4f;
        color: white;
      }
      
      @keyframes smzsSlideDown {
        from {
          transform: translateX(-50%) translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes smzsSlideUp {
        from {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        to {
          transform: translateX(-50%) translateY(-100%);
          opacity: 0;
        }
      }
    `;
    return style;
  }

  bindEvents() {
    // 下载按钮
    document.querySelector('.smzs-btn-download').addEventListener('click', () => this.downloadMedia());
    
    // 复制下拉菜单
    const dropdown = document.querySelector('.smzs-dropdown');
    const copyBtn = document.querySelector('.smzs-btn-copy');
    
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
    
    document.querySelectorAll('.smzs-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.copyToClipboard(item.dataset.action);
        dropdown.classList.remove('active');
      });
    });
    
    // 导出按钮（下拉菜单）
    const exportDropdown = document.querySelector('.smzs-btn-export').parentElement;
    const exportBtn = document.querySelector('.smzs-btn-export');
    
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (!exportDropdown.contains(e.target)) {
        exportDropdown.classList.remove('active');
      }
    });
    
    exportDropdown.querySelectorAll('.smzs-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const format = item.dataset.action.replace('export-', '');
        this.exportComments(format);
        exportDropdown.classList.remove('active');
      });
    });
    
    // 数据上报按钮
    document.querySelector('.smzs-btn-report').addEventListener('click', () => this.reportData());
    
    // 飞书同步按钮
    document.querySelector('.smzs-btn-feishu').addEventListener('click', () => this.syncToFeishu());
  }
  
  // 数据上报功能
  async reportData() {
    console.log('[XHS-Collector] Report data button clicked');
    
    if (!this.currentNoteData && !this.currentUserData) {
      this.showNotification('❌ 暂无数据可上报', 'error');
      return;
    }
    
    try {
      // 准备上报数据
      const reportData = {
        platform: 'xiaohongshu',
        url: location.href,
        timestamp: Date.now(),
        note: this.currentNoteData,
        user: this.currentUserData,
        comments: this.currentComments
      };
      
      // 保存到数据库
      await dbManager.save({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'reported_data',
        data: reportData,
        timestamp: Date.now(),
        platform: 'xiaohongshu',
        url: location.href,
        source: 'manual_report'
      });
      
      this.showNotification('📊 数据上报成功', 'success');
      console.log('[XHS-Collector] Data reported successfully');
      
    } catch (error) {
      console.error('[XHS-Collector] Report data failed:', error);
      this.showNotification('❌ 数据上报失败', 'error');
    }
  }

  startDataWatcher() {
    // 定期从页面提取数据
    const extractData = () => {
      try {
        const state = window.__INITIAL_STATE__;
        if (state) {
          if (state.note?.noteDetailMap) {
            const notes = Object.values(state.note.noteDetailMap);
            if (notes.length > 0) {
              this.currentNoteData = notes[0];
            }
          }
          if (state.user?.user) {
            this.currentUserData = state.user.user;
          }
        }
      } catch (error) {
        console.error('提取数据失败:', error);
      }
    };
    
    extractData();
    setInterval(extractData, 2000);
  }

  // 生成安全的文件名（移除非法字符）
  sanitizeFilename(name) {
    if (!name) return '';
    // 移除Windows和Unix文件系统中的非法字符
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  // 生成下载文件夹路径
  generateFolderPath() {
    const author = this.currentNoteData?.author;
    const authorName = this.sanitizeFilename(author?.nickname) || '未知作者';
    const noteId = this.currentNoteData?.noteId || '';
    
    // 文件夹结构: 小红书/作者昵称/笔记ID/
    return `小红书/${authorName}/${noteId}`;
  }

  // 生成媒体文件名
  generateMediaFilename(type, index = 0) {
    const note = this.currentNoteData;
    const title = this.sanitizeFilename(note?.title) || '无标题';
    
    // 获取日期格式: YYYYMMDD
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
                   String(now.getMonth() + 1).padStart(2, '0') +
                   String(now.getDate()).padStart(2, '0');

    if (type === 'video') {
      // 视频文件名: 日期-标题.mp4
      return `${dateStr}-${title}.mp4`;
    } else {
      // 图片文件名: 日期-标题-图序号.jpg
      return `${dateStr}-${title}-图${index + 1}.jpg`;
    }
  }

  // 将 webp 图片转换为 jpg 格式并下载
  async convertWebpToJpg(imageUrl, filename) {
    try {
      console.log('[XHS-Collector] Converting webp to jpg:', imageUrl);

      // 创建图片对象加载图片
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // 创建 canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      // 绘制图片到 canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // 转换为 jpg 格式的 base64 数据
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      // 将 base64 转换为 blob
      const response = await fetch(jpgDataUrl);
      const blob = await response.blob();

      // 创建 blob URL
      const blobUrl = URL.createObjectURL(blob);

      // 下载转换后的图片
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        url: blobUrl,
        filename: filename
      }, () => {
        // 下载完成后释放 blob URL
        URL.revokeObjectURL(blobUrl);
      });

      console.log('[XHS-Collector] Webp converted and download started');
    } catch (error) {
      console.error('[XHS-Collector] Failed to convert webp to jpg:', error);
      // 如果转换失败，直接下载原始图片
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        url: imageUrl,
        filename: filename
      });
    }
  }

  downloadMedia() {
    console.log('[XHS-Collector] =========================================');
    console.log('[XHS-Collector] Download button clicked');
    console.log('[XHS-Collector] Current noteId:', this.currentNoteData?.noteId);
    console.log('[XHS-Collector] Current title:', this.currentNoteData?.title);
    console.log('[XHS-Collector] Current author:', this.currentNoteData?.author?.nickname);
    console.log('[XHS-Collector] Full currentNoteData:', JSON.stringify(this.currentNoteData, null, 2));
    
    if (!this.currentNoteData) {
      this.showNotification('❌ 暂无笔记数据，请先浏览笔记', 'error');
      console.log('[XHS-Collector] No note data available');
      return;
    }

    const folderPath = this.generateFolderPath();
    console.log('[XHS-Collector] Folder path:', folderPath);
    console.log('[XHS-Collector] =========================================');

    // 尝试获取视频URL（标准化后的字段名）
    const videoUrl = this.currentNoteData?.video;
    console.log('[XHS-Collector] Video URL:', videoUrl);

    if (videoUrl && typeof videoUrl === 'string') {
      const filename = `${folderPath}/${this.generateMediaFilename('video')}`;
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        url: videoUrl,
        filename: filename
      });
      this.showNotification('📥 视频下载已启动', 'success');
      return;
    }

    // 尝试下载图片（标准化后的字段名）
    const images = this.currentNoteData?.images;
    console.log('[XHS-Collector] Images:', images);

    if (images && Array.isArray(images) && images.length > 0) {
      // 下载所有图片
      let downloadCount = 0;
      images.forEach((img, index) => {
        const imageUrl = typeof img === 'string' ? img : img?.url;
        if (imageUrl && typeof imageUrl === 'string') {
          const filename = `${folderPath}/${this.generateMediaFilename('image', index)}`;
          // 如果URL包含webp，先转换为jpg再下载
          if (imageUrl.includes('webp')) {
            this.convertWebpToJpg(imageUrl, filename);
          } else {
            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_FILE',
              url: imageUrl,
              filename: filename
            });
          }
          downloadCount++;
        }
      });

      if (downloadCount > 0) {
        this.showNotification(`📥 ${downloadCount}张图片下载已启动`, 'success');
      } else {
        this.showNotification('❌ 未找到有效的图片链接', 'error');
      }
    } else {
      this.showNotification('❌ 未找到媒体文件', 'error');
    }
  }

  copyToClipboard(action) {
    console.log('[XHS-Collector] Copy button clicked, action:', action);
    console.log('[XHS-Collector] currentNoteData:', this.currentNoteData);
    console.log('[XHS-Collector] currentUserData:', this.currentUserData);
    
    let text = '';
    let label = '';

    // 使用标准化后的字段名（与 inject.js 解析器一致）
    switch(action) {
      case 'noteId':
        text = this.currentNoteData?.noteId || '';
        label = '笔记ID';
        break;
      case 'title':
        text = this.currentNoteData?.title || '';
        label = '笔记标题';
        break;
      case 'desc':
        text = this.currentNoteData?.desc || this.currentNoteData?.content || '';
        label = '笔记内容';
        break;
      case 'authorId':
        // 优先从用户数据获取，否则从笔记的 author 字段获取
        text = this.currentUserData?.userId ||
               this.currentNoteData?.author?.userId || '';
        label = '博主ID';
        break;
      case 'authorNickname':
        // 优先从用户数据获取，否则从笔记的 author 字段获取
        text = this.currentUserData?.nickname ||
               this.currentNoteData?.author?.nickname || '';
        label = '博主昵称';
        break;
    }

    console.log('[XHS-Collector] Copy text:', text);

    if (text) {
      this.copyText(text);
      this.showNotification(`✅ ${label}已复制`, 'success');
    } else {
      this.showNotification(`❌ 未找到${label}`, 'error');
    }
  }

  copyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  // 导出评论功能 - 支持多种格式
  async exportComments(format = 'txt') {
    console.log('[XHS-Collector] Export comments button clicked, format:', format);
    console.log('[XHS-Collector] Current comments:', this.currentComments);

    // 检查是否有评论数据
    if (!this.currentComments || this.currentComments.length === 0) {
      this.showNotification('❌ 暂无评论数据，请先加载评论', 'error');
      return;
    }

    try {
      const noteTitle = this.currentNoteData?.title || '无标题';
      const noteId = this.currentNoteData?.noteId || '';
      const sanitizedTitle = this.sanitizeFilename(noteTitle).slice(0, 20);
      
      let content, mimeType, extension, filename;

      switch (format) {
        case 'txt':
          // TXT 格式 - 易读的文本格式
          content = this.formatCommentsAsTxt(noteTitle, noteId);
          mimeType = 'text/plain;charset=utf-8';
          extension = 'txt';
          filename = `评论_${sanitizedTitle}_${this.currentComments.length}条.txt`;
          break;
          
        case 'json':
          // JSON 格式 - 结构化数据
          content = this.formatCommentsAsJson(noteTitle, noteId);
          mimeType = 'application/json';
          extension = 'json';
          filename = `评论_${sanitizedTitle}_${this.currentComments.length}条.json`;
          break;
          
        case 'csv':
          // CSV 格式 - 表格数据
          content = this.formatCommentsAsCsv();
          mimeType = 'text/csv;charset=utf-8';
          extension = 'csv';
          filename = `评论_${sanitizedTitle}_${this.currentComments.length}条.csv`;
          break;
          
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }

      // 创建 Blob 对象
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // 下载文件
      await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        url: url,
        filename: filename
      });

      // 释放 URL 对象
      URL.revokeObjectURL(url);

      this.showNotification(`📤 成功导出 ${this.currentComments.length} 条评论 (${format.toUpperCase()})`, 'success');
      console.log('[XHS-Collector] Comments exported successfully');

    } catch (error) {
      console.error('[XHS-Collector] Export comments failed:', error);
      this.showNotification('❌ 导出评论失败: ' + error.message, 'error');
    }
  }

  // 格式化为 TXT 格式
  formatCommentsAsTxt(noteTitle, noteId) {
    const exportTime = new Date().toLocaleString('zh-CN');

    let content = `================================\n`;
    content += `📄 笔记标题: ${noteTitle}\n`;
    content += `📝 笔记ID: ${noteId}\n`;
    content += `💬 评论数量: ${this.currentComments.length}条\n`;
    content += `⏰ 导出时间: ${exportTime}\n`;
    content += `================================\n\n`;

    this.currentComments.forEach((comment, index) => {
      const author = comment.author?.nickname || comment.user?.nickname || '匿名用户';
      const authorId = comment.author?.userId || comment.author?.user_id || '';
      const level = comment.author?.level || '';
      const ipLocation = comment.author?.ipLocation || '';
      const commentContent = comment.content || comment.text || '';
      const likes = comment.likes || comment.liked_count || 0;
      const time = comment.createTime || comment.create_time || '';
      const isAuthor = comment.isAuthor ? ' [作者]' : '';
      const replyTo = comment.replyToNickname || '';

      content += `[${index + 1}] 👤 ${author}${isAuthor}\n`;
      if (level) content += `    🏅 等级: ${level}\n`;
      if (ipLocation) content += `    📍 IP属地: ${ipLocation}\n`;
      if (replyTo) content += `    ↩️ 回复给: ${replyTo}\n`;
      content += `    💬 ${commentContent}\n`;
      content += `    👍 ${likes}  ${time ? '🕐 ' + time : ''}\n`;
      if (authorId) content += `    🆔 用户ID: ${authorId}\n`;
      content += `\n`;

      // 子评论
      const subComments = comment.subComments || comment.sub_comments || [];
      if (subComments.length > 0) {
        subComments.forEach((sub) => {
          const subAuthor = sub.author || sub.user?.nickname || '匿名用户';
          const subContent = sub.content || sub.text || '';
          const subLikes = sub.likes || sub.liked_count || 0;
          content += `    ↳ [回复] 👤 ${subAuthor} 👍${subLikes}: ${subContent}\n`;
        });
        content += `\n`;
      }
    });

    content += `================================\n`;
    content += `导出完成 - 共 ${this.currentComments.length} 条评论\n`;
    content += `================================`;

    return content;
  }

  // 格式化为 JSON 格式
  formatCommentsAsJson(noteTitle, noteId) {
    const exportData = {
      meta: {
        noteTitle: noteTitle,
        noteId: noteId,
        exportTime: new Date().toISOString(),
        totalComments: this.currentComments.length,
        platform: 'xiaohongshu'
      },
      comments: this.currentComments.map((comment, index) => ({
        index: index + 1,
        commentId: comment.commentId || comment.id || '',
        content: comment.content || comment.text || '',
        author: {
          userId: comment.author?.userId || comment.author?.user_id || comment.user?.user_id || '',
          nickname: comment.author?.nickname || comment.user?.nickname || '匿名用户',
          avatar: comment.author?.avatar || '',
          level: comment.author?.level || '',
          ipLocation: comment.author?.ipLocation || ''
        },
        likes: comment.likes || comment.liked_count || 0,
        createTime: comment.createTime || comment.create_time || '',
        isAuthor: comment.isAuthor || false,
        isLiked: comment.isLiked || false,
        replyTo: comment.replyTo || '',
        replyToNickname: comment.replyToNickname || '',
        subComments: (comment.subComments || comment.sub_comments || []).map(sub => ({
          commentId: sub.commentId || sub.id || '',
          content: sub.content || sub.text || '',
          author: sub.author || sub.user?.nickname || '匿名用户',
          authorId: sub.authorId || sub.user?.user_id || '',
          likes: sub.likes || sub.liked_count || 0,
          createTime: sub.createTime || sub.time || ''
        }))
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  // 格式化为 CSV 格式 - 使用固定字段顺序（与原版一致）
  formatCommentsAsCsv() {
    if (!this.currentComments || this.currentComments.length === 0) {
      return '\ufeff暂无评论数据';
    }

    // 固定的字段列表（与原版一致）
    const fieldArray = [
      '评论ID',
      '评论内容',
      '点赞量',
      '评论时间',
      'IP地址',
      '子评论数',
      '笔记ID',
      '笔记链接',
      '用户ID',
      '用户链接',
      '用户名称',
      '一级评论ID',
      '一级评论内容',
      '评论图片链接',
      '应用的评论ID',
      '引用的评论内容'
    ];

    let csv = '\ufeff' + fieldArray.join(',') + '\n';

    // 获取笔记信息
    const currentNoteId = this.currentNoteData?.noteId || '';
    const currentNoteLink = location.href || '';

    this.currentComments.forEach((comment) => {
      const row = fieldArray.map(field => {
        let value = '';

        switch (field) {
          case '评论ID':
            value = comment.commentId || comment.id || '';
            break;
          case '评论内容':
            value = comment.content || comment.text || '';
            break;
          case '点赞量':
            value = comment.likes || comment.liked_count || 0;
            break;
          case '评论时间':
            value = comment.createTime || comment.create_time || comment.time || '';
            break;
          case 'IP地址':
            value = comment.ipLocation || comment.author?.ipLocation || '';
            break;
          case '子评论数':
            value = comment.subCommentCount || comment.sub_comments?.length || 0;
            break;
          case '笔记ID':
            value = comment.noteId || currentNoteId || '';
            break;
          case '笔记链接':
            value = comment.noteLink || currentNoteLink || '';
            break;
          case '用户ID':
            value = comment.userId || comment.author?.userId || comment.author?.user_id || '';
            break;
          case '用户链接':
            value = comment.userLink || '';
            break;
          case '用户名称':
            value = comment.userName || comment.author?.nickname || comment.author?.user_name || '';
            break;
          case '一级评论ID':
            value = comment.parentCommentId || comment.parent_id || comment.replyTo || '';
            break;
          case '一级评论内容':
            value = comment.parentCommentContent || '';
            break;
          case '评论图片链接':
            const images = comment.commentImages || comment.pictures || [];
            value = Array.isArray(images) ? images.join(';') : images;
            break;
          case '应用的评论ID':
            value = comment.appCommentId || '';
            break;
          case '引用的评论内容':
            value = comment.quotedCommentContent || '';
            break;
        }

        if (value === null || value === undefined) {
          value = '';
        }

        // 处理对象类型
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }

        // 转义双引号
        value = String(value).replace(/"/g, '""');

        // 如果包含逗号、引号或换行，需要用引号包裹
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`;
        }

        return value;
      });

      csv += row.join(',') + '\n';
    });

    return csv;
  }

  async collectCurrentPage() {
    try {
      let collectedCount = 0;
      
      // 优先使用已缓存的数据
      if (this.currentNoteData) {
        await dbManager.save({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'note_info',
          data: this.currentNoteData,
          timestamp: Date.now(),
          platform: 'xiaohongshu',
          url: location.href,
          source: 'manual_collect'
        });
        collectedCount++;
      }
      
      if (this.currentUserData) {
        await dbManager.save({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'user_info',
          data: this.currentUserData,
          timestamp: Date.now(),
          platform: 'xiaohongshu',
          url: location.href,
          source: 'manual_collect'
        });
        collectedCount++;
      }
      
      // 如果没有缓存数据，尝试从页面状态提取
      if (collectedCount === 0) {
        const state = window.__INITIAL_STATE__ || 
                      window.__INITIAL_SSR_STATE__ || 
                      window._SSR_HYDRATED_DATA;
        
        if (state) {
          // 提取笔记数据
          if (state.note?.noteDetailMap) {
            const notes = Object.values(state.note.noteDetailMap);
            for (const note of notes) {
              if (note) {
                await dbManager.save({
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'note_info',
                  data: note,
                  timestamp: Date.now(),
                  platform: 'xiaohongshu',
                  url: location.href,
                  source: 'manual_collect'
                });
                collectedCount++;
              }
            }
          }
          
          // 提取搜索/推荐流的笔记
          if (state.search?.notes) {
            for (const note of state.search.notes) {
              if (note) {
                await dbManager.save({
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'note_info',
                  data: note,
                  timestamp: Date.now(),
                  platform: 'xiaohongshu',
                  url: location.href,
                  source: 'manual_collect'
                });
                collectedCount++;
              }
            }
          }
          
          // 提取用户主页笔记
          if (state.userPosted?.notes) {
            for (const note of state.userPosted.notes) {
              if (note) {
                await dbManager.save({
                  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'note_info',
                  data: note,
                  timestamp: Date.now(),
                  platform: 'xiaohongshu',
                  url: location.href,
                  source: 'manual_collect'
                });
                collectedCount++;
              }
            }
          }
          
          // 提取用户数据
          if (state.user?.user) {
            await dbManager.save({
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'user_info',
              data: state.user.user,
              timestamp: Date.now(),
              platform: 'xiaohongshu',
              url: location.href,
              source: 'manual_collect'
            });
            collectedCount++;
          }
        }
      }
      
      if (collectedCount > 0) {
        this.showNotification(`💾 成功采集${collectedCount}条数据`, 'success');
      } else {
        this.showNotification('❌ 未找到可采集的数据，请先浏览笔记或用户页面', 'error');
      }
    } catch (error) {
      console.error('采集失败:', error);
      this.showNotification('❌ 采集失败: ' + error.message, 'error');
    }
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `smzs-notification smzs-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'smzsSlideUp 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // 飞书同步功能
  async syncToFeishu() {
    try {
      // 获取飞书配置
      const config = await this.getFeishuConfig();
      if (!config || !config.appToken || !config.tableId) {
        this.showNotification('❌ 请先配置飞书多维表格', 'error');
        this.openFeishuConfig();
        return;
      }

      // 准备要同步的数据
      const syncData = this.prepareSyncData();
      if (!syncData || syncData.length === 0) {
        this.showNotification('❌ 没有可同步的数据', 'error');
        return;
      }

      this.showNotification('🚀 正在同步到飞书...', 'success');

      // 获取 access_token
      const accessToken = await this.getFeishuAccessToken(config);
      if (!accessToken) {
        this.showNotification('❌ 飞书认证失败，请检查配置', 'error');
        return;
      }

      // 同步数据到飞书
      const result = await this.sendToFeishu(config, accessToken, syncData);
      
      if (result.success) {
        this.showNotification(`✅ 成功同步 ${result.count} 条数据到飞书`, 'success');
      } else {
        this.showNotification(`❌ 同步失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('飞书同步失败:', error);
      this.showNotification('❌ 飞书同步失败: ' + error.message, 'error');
    }
  }

  // 获取飞书配置
  async getFeishuConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['feishuConfig'], (result) => {
        resolve(result.feishuConfig || null);
      });
    });
  }

  // 打开飞书配置弹窗
  openFeishuConfig() {
    const modal = document.createElement('div');
    modal.id = 'smzs-feishu-config-modal';
    modal.innerHTML = `
      <div class="smzs-modal-overlay">
        <div class="smzs-modal-content">
          <div class="smzs-modal-header">
            <h3>🚀 飞书多维表格配置</h3>
            <button class="smzs-modal-close">&times;</button>
          </div>
          <div class="smzs-modal-body">
            <div class="smzs-form-group">
              <label>App ID (应用ID)</label>
              <input type="text" id="feishu-app-id" placeholder="cli_xxxxxxxxxxxx">
            </div>
            <div class="smzs-form-group">
              <label>App Secret (应用密钥)</label>
              <input type="password" id="feishu-app-secret" placeholder="请输入应用密钥">
            </div>
            <div class="smzs-form-group">
              <label>多维表格 Token (App Token)</label>
              <input type="text" id="feishu-app-token" placeholder="Bascnxxxxxxxxxxxxxxxx">
              <small>从飞书多维表格URL中获取，如: https://feishu.cn/base/Bascnxxx</small>
            </div>
            <div class="smzs-form-group">
              <label>表格 ID (Table ID)</label>
              <input type="text" id="feishu-table-id" placeholder="tblxxxxxxxx">
              <small>从飞书多维表格URL中获取，如: https://feishu.cn/base/xxx?table=tblxxx</small>
            </div>
            <div class="smzs-form-tips">
              <p>💡 获取方式：</p>
              <ol>
                <li>打开飞书多维表格</li>
                <li>点击右上角「...」→「添加文档应用」</li>
                <li>创建或选择自建应用</li>
                <li>复制 App ID 和 App Secret</li>
                <li>从URL中复制 Token 和 Table ID</li>
              </ol>
            </div>
          </div>
          <div class="smzs-modal-footer">
            <button class="smzs-btn-cancel">取消</button>
            <button class="smzs-btn-save">保存配置</button>
          </div>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .smzs-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000000;
      }
      .smzs-modal-content {
        background: white;
        border-radius: 12px;
        width: 500px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      .smzs-modal-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .smzs-modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: #333;
      }
      .smzs-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
      }
      .smzs-modal-body {
        padding: 20px;
        max-height: 50vh;
        overflow-y: auto;
      }
      .smzs-form-group {
        margin-bottom: 16px;
      }
      .smzs-form-group label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }
      .smzs-form-group input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
      }
      .smzs-form-group input:focus {
        outline: none;
        border-color: #3370ff;
      }
      .smzs-form-group small {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: #999;
      }
      .smzs-form-tips {
        background: #f5f7fa;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        color: #666;
      }
      .smzs-form-tips ol {
        margin: 8px 0 0 16px;
        padding: 0;
      }
      .smzs-form-tips li {
        margin-bottom: 4px;
      }
      .smzs-modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .smzs-btn-cancel, .smzs-btn-save {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      .smzs-btn-cancel {
        background: #f5f5f5;
        color: #666;
      }
      .smzs-btn-save {
        background: linear-gradient(135deg, #3370ff 0%, #7b61ff 100%);
        color: white;
      }
      .smzs-btn-cancel:hover {
        background: #e8e8e8;
      }
      .smzs-btn-save:hover {
        opacity: 0.9;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);

    // 加载已有配置
    this.getFeishuConfig().then(config => {
      if (config) {
        document.getElementById('feishu-app-id').value = config.appId || '';
        document.getElementById('feishu-app-secret').value = config.appSecret || '';
        document.getElementById('feishu-app-token').value = config.appToken || '';
        document.getElementById('feishu-table-id').value = config.tableId || '';
      }
    });

    // 绑定事件
    modal.querySelector('.smzs-modal-close').addEventListener('click', () => {
      modal.remove();
      style.remove();
    });
    modal.querySelector('.smzs-btn-cancel').addEventListener('click', () => {
      modal.remove();
      style.remove();
    });
    modal.querySelector('.smzs-btn-save').addEventListener('click', async () => {
      const config = {
        appId: document.getElementById('feishu-app-id').value.trim(),
        appSecret: document.getElementById('feishu-app-secret').value.trim(),
        appToken: document.getElementById('feishu-app-token').value.trim(),
        tableId: document.getElementById('feishu-table-id').value.trim()
      };

      if (!config.appId || !config.appSecret || !config.appToken || !config.tableId) {
        alert('请填写所有必填项');
        return;
      }

      await chrome.storage.local.set({ feishuConfig: config });
      this.showNotification('✅ 飞书配置已保存', 'success');
      modal.remove();
      style.remove();
    });
  }

  // 准备同步数据
  prepareSyncData() {
    const records = [];

    // 添加当前笔记数据（使用标准化后的字段名）
    if (this.currentNoteData) {
      const note = this.currentNoteData;
      records.push({
        fields: {
          '笔记ID': String(note.noteId || ''),
          '笔记标题': note.title || '',
          '笔记内容': (note.desc || '').substring(0, 500),
          '点赞数': note.likes || 0,
          '收藏数': note.collects || 0,
          '评论数': note.comments || 0,
          '分享数': note.shares || 0,
          '笔记链接': `https://www.xiaohongshu.com/explore/${note.noteId || ''}`,
          '采集时间': new Date().toLocaleString('zh-CN'),
          '平台': '小红书'
        }
      });
    }

    // 添加当前用户数据（使用标准化后的字段名）
    if (this.currentUserData) {
      const user = this.currentUserData;
      records.push({
        fields: {
          '博主ID': String(user.userId || ''),
          '博主昵称': user.nickname || '',
          '粉丝数': user.fans || 0,
          '关注数': user.follows || 0,
          '获赞与收藏': user.liked || 0,
          '博主链接': `https://www.xiaohongshu.com/user/profile/${user.userId || ''}`,
          '采集时间': new Date().toLocaleString('zh-CN'),
          '平台': '小红书-用户'
        }
      });
    }

    return records;
  }

  // 获取飞书 access_token
  async getFeishuAccessToken(config) {
    try {
      // 检查缓存的 token
      const cached = await new Promise(resolve => {
        chrome.storage.local.get(['feishuToken', 'feishuTokenExpire'], resolve);
      });

      if (cached.feishuToken && cached.feishuTokenExpire && Date.now() < cached.feishuTokenExpire) {
        return cached.feishuToken;
      }

      // 请求新的 token
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: config.appId,
          app_secret: config.appSecret
        })
      });

      const data = await response.json();

      if (data.code !== 0 || !data.tenant_access_token) {
        throw new Error(data.msg || '获取 access_token 失败');
      }

      // 缓存 token（提前5分钟过期）
      const expireTime = Date.now() + (data.expire - 300) * 1000;
      await chrome.storage.local.set({
        feishuToken: data.tenant_access_token,
        feishuTokenExpire: expireTime
      });

      return data.tenant_access_token;
    } catch (error) {
      console.error('获取飞书 token 失败:', error);
      return null;
    }
  }

  // 发送数据到飞书
  async sendToFeishu(config, accessToken, records) {
    try {
      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/batch_create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ records })
        }
      );

      const data = await response.json();

      if (data.code !== 0) {
        // 处理特定错误码
        const errorMessages = {
          91402: '未找到指定的多维表格，请检查 Token 和 Table ID',
          91403: '没有权限访问此表格，请确保应用已添加到表格',
          99991663: '访问凭证无效，请检查 App ID 和 App Secret'
        };
        
        return {
          success: false,
          error: errorMessages[data.code] || data.msg || `错误码: ${data.code}`
        };
      }

      return {
        success: true,
        count: records.length,
        data: data.data
      };
    } catch (error) {
      console.error('发送数据到飞书失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 初始化
const dbManager = new DBManager();
const floatManager = new FloatingButtonManager();

// 监听 inject.js 数据（使用 postMessage，与原版一致）
window.addEventListener('message', async (e) => {
  // 只处理来自同页面的消息
  if (e.source !== window) return;

  // 只处理社媒助手相关的消息
  if (e.data?.type !== 'SMZS_MAIN_WORLD_DATA') return;

  console.log('[XHS-Collector] Received message:', e.data);

  const { dataType, data, platform } = e.data;
  if (!dataType || !data) {
    console.warn('[XHS-Collector] Received empty data');
    return;
  }

  // 解析数据 - inject.js 发送的数据结构是 { result: parsedData }
  const resultData = data.result || data;

  console.log('[XHS-Collector] Parsed resultData:', resultData);
  console.log('[XHS-Collector] DataType:', dataType);
  console.log('[XHS-Collector] floatManager exists:', !!floatManager);

  // 更新浮动按钮管理器的当前数据
  if (dataType === 'note_info' && resultData) {
    console.log('[XHS-Collector] =========================================');
    console.log('[XHS-Collector] Updating currentNoteData...');
    console.log('[XHS-Collector] Old noteId:', floatManager.currentNoteData?.noteId);
    console.log('[XHS-Collector] New noteId:', resultData.noteId);
    console.log('[XHS-Collector] New title:', resultData.title);
    console.log('[XHS-Collector] New author:', resultData.author?.nickname);
    
    floatManager.currentNoteData = resultData;
    
    console.log('[XHS-Collector] Updated currentNoteData. noteId:', resultData.noteId);
    console.log('[XHS-Collector] Current note data available:', !!floatManager.currentNoteData);
    console.log('[XHS-Collector] =========================================');
    
    // 显示一个视觉提示，表示数据已更新
    floatManager.showNotification(`📥 笔记数据已加载: ${resultData.title?.substring(0, 20) || '无标题'}`, 'success');
  } else if ((dataType === 'home_feed' || dataType === 'explore') && resultData) {
    // 从 feed 中提取第一个笔记作为当前笔记
    let notesArray = null;
    if (Array.isArray(resultData)) {
      notesArray = resultData;
    } else if (resultData && Array.isArray(resultData.items)) {
      notesArray = resultData.items;
    } else if (resultData && Array.isArray(resultData.notes)) {
      notesArray = resultData.notes;
    }
    
    if (notesArray && notesArray.length > 0) {
      const firstNote = notesArray[0];
      console.log('[XHS-Collector] =========================================');
      console.log('[XHS-Collector] Updating currentNoteData from feed...');
      console.log('[XHS-Collector] Old noteId:', floatManager.currentNoteData?.noteId);
      console.log('[XHS-Collector] New noteId:', firstNote.noteId);
      console.log('[XHS-Collector] New title:', firstNote.title);
      console.log('[XHS-Collector] New author:', firstNote.author?.nickname);
      
      floatManager.currentNoteData = firstNote;
      
      console.log('[XHS-Collector] Updated currentNoteData from feed. noteId:', firstNote.noteId);
      console.log('[XHS-Collector] =========================================');
      
      // 显示一个视觉提示，表示数据已更新
      floatManager.showNotification(`📥 笔记数据已加载: ${firstNote.title?.substring(0, 20) || '无标题'}`, 'success');
    }
  } else if (dataType === 'user_info' && resultData) {
    console.log('[XHS-Collector] Updating currentUserData...');
    floatManager.currentUserData = resultData;
    console.log('[XHS-Collector] Updated currentUserData. userId:', resultData.userId);
    console.log('[XHS-Collector] Current user data available:', !!floatManager.currentUserData);
  } else if (dataType === 'comment_info' && resultData) {
    console.log('[XHS-Collector] Received comment data:', resultData);
    // 评论数据可能是数组或对象
    if (Array.isArray(resultData)) {
      floatManager.currentComments = resultData;
    } else if (resultData.comments && Array.isArray(resultData.comments)) {
      floatManager.currentComments = resultData.comments;
    } else {
      floatManager.currentComments = [resultData];
    }
    console.log('[XHS-Collector] Updated currentComments. Count:', floatManager.currentComments.length);
  }

  // 构建存储数据对象
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: dataType,
    data: resultData,
    timestamp: Date.now(),
    platform: platform || 'xiaohongshu',
    url: data.url || location.href,
    source: 'intercept'
  };

  try {
    await dbManager.save(item);
    console.log('[XHS-Collector] Saved to DB:', dataType);
  } catch(err) {
    console.error('[XHS-Collector] Save failed:', err);
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
