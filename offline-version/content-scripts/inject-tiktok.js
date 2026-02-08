(function() {
  'use strict';

  console.log('社媒助手: TikTok 拦截脚本已加载');

  // 存储当前视频数据
  let currentVideoData = null;
  let currentUserData = null;

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const [url, options = {}] = args;

    try {
      const response = await originalFetch.apply(this, args);

      if (url.includes('/tiktok/v1/') || url.includes('/api/')) {
        const clonedResponse = response.clone();

        clonedResponse.json().then(data => {
          if (data && data.data) {
            // 保存视频数据
            if (data.data.video) {
              currentVideoData = data.data.video;
            }
            if (data.data.user) {
              currentUserData = data.data.user;
            }

            window.postMessage({
              type: 'SMZS_COLLECT',
              data: {
                type: 'tiktok_api',
                platform: 'tiktok',
                url,
                rawData: data,
                timestamp: Date.now()
              }
            }, '*');
          }
        }).catch(() => {});
      }

      return response;
    } catch (error) {
      console.error('社媒助手: TikTok Fetch 拦截错误', error);
      throw error;
    }
  };

  function extractVideoInfo() {
    try {
      const videoData = window.__REACT_DEFAULT_STATE__?.video;
      if (videoData) {
        currentVideoData = videoData;
        window.postMessage({
          type: 'SMZS_COLLECT',
          data: {
            type: 'video_info',
            platform: 'tiktok',
            rawData: videoData,
            timestamp: Date.now()
          }
        }, '*');
      }
    } catch (error) {
      console.error('社媒助手: 提取视频信息失败', error);
    }
  }

  function extractUserInfo() {
    try {
      const userData = window.__REACT_DEFAULT_STATE__?.user;
      if (userData) {
        currentUserData = userData;
        window.postMessage({
          type: 'SMZS_COLLECT',
          data: {
            type: 'user_info',
            platform: 'tiktok',
            rawData: userData,
            timestamp: Date.now()
          }
        }, '*');
      }
    } catch (error) {
      console.error('社媒助手: 提取用户信息失败', error);
    }
  }

  // 创建功能按钮组
  function createFunctionButtons() {
    if (document.getElementById('smzs-function-buttons')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'smzs-function-buttons';
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const buttonStyle = `
      padding: 8px 16px;
      border-radius: 20px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    `;

    // 下载视频按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = '📥 下载视频';
    downloadBtn.style.cssText = buttonStyle + `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    `;
    downloadBtn.onclick = () => downloadVideo();

    // 复制信息按钮组
    const copyContainer = document.createElement('div');
    copyContainer.style.cssText = `
      position: relative;
      display: inline-block;
    `;

    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '📋 复制视频信息 ▼';
    copyBtn.style.cssText = buttonStyle + `
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      width: 100%;
    `;

    const dropdown = document.createElement('div');
    dropdown.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-top: 4px;
      overflow: hidden;
      z-index: 100000;
    `;

    const menuItems = [
      { label: '📋 复制视频ID', action: () => copyVideoId() },
      { label: '📝 复制视频描述', action: () => copyVideoDesc() },
      { label: '👤 复制作者ID', action: () => copyAuthorId() },
      { label: '🏷️ 复制作者昵称', action: () => copyAuthorNickname() }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.textContent = item.label;
      menuItem.style.cssText = `
        padding: 10px 16px;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        transition: background 0.2s;
      `;
      menuItem.onmouseover = () => menuItem.style.background = '#f5f5f5';
      menuItem.onmouseout = () => menuItem.style.background = 'white';
      menuItem.onclick = () => {
        item.action();
        dropdown.style.display = 'none';
      };
      dropdown.appendChild(menuItem);
    });

    copyBtn.onclick = () => {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };

    copyContainer.appendChild(copyBtn);
    copyContainer.appendChild(dropdown);

    // 导出数据按钮
    const exportBtn = document.createElement('button');
    exportBtn.innerHTML = '📤 导出数据';
    exportBtn.style.cssText = buttonStyle + `
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: white;
    `;
    exportBtn.onclick = () => exportData();

    // 采集页面按钮
    const collectBtn = document.createElement('button');
    collectBtn.innerHTML = '💾 采集当前页面';
    collectBtn.style.cssText = buttonStyle + `
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      color: white;
    `;
    collectBtn.onclick = () => collectCurrentPage();

    container.appendChild(downloadBtn);
    container.appendChild(copyContainer);
    container.appendChild(exportBtn);
    container.appendChild(collectBtn);

    document.body.appendChild(container);

    document.addEventListener('click', (e) => {
      if (!copyContainer.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    console.log('社媒助手: 功能按钮组已添加');
  }

  // 下载视频
  function downloadVideo() {
    const videoUrl = currentVideoData?.playUrl || 
                    currentVideoData?.videoUrl ||
                    currentVideoData?.downloadAddr || '';
    
    if (videoUrl) {
      window.postMessage({
        type: 'SMZS_DOWNLOAD',
        data: {
          url: videoUrl,
          type: 'video',
          filename: `TikTok视频_${Date.now()}.mp4`
        }
      }, '*');
      showNotification('视频下载已启动', 'success');
    } else {
      showNotification('未找到视频链接', 'error');
    }
  }

  // 复制视频ID
  function copyVideoId() {
    const videoId = currentVideoData?.id || 
                   currentVideoData?.videoId || '';
    if (videoId) {
      copyToClipboard(videoId);
      showNotification('视频ID已复制', 'success');
    } else {
      showNotification('未找到视频ID', 'error');
    }
  }

  // 复制视频描述
  function copyVideoDesc() {
    const desc = currentVideoData?.desc || 
                currentVideoData?.description || '';
    if (desc) {
      copyToClipboard(desc);
      showNotification('视频描述已复制', 'success');
    } else {
      showNotification('未找到视频描述', 'error');
    }
  }

  // 复制作者ID
  function copyAuthorId() {
    const authorId = currentUserData?.id || 
                    currentUserData?.userId || '';
    if (authorId) {
      copyToClipboard(authorId);
      showNotification('作者ID已复制', 'success');
    } else {
      showNotification('未找到作者ID', 'error');
    }
  }

  // 复制作者昵称
  function copyAuthorNickname() {
    const nickname = currentUserData?.nickname || 
                    currentUserData?.uniqueId || '';
    if (nickname) {
      copyToClipboard(nickname);
      showNotification('作者昵称已复制', 'success');
    } else {
      showNotification('未找到作者昵称', 'error');
    }
  }

  // 导出数据
  function exportData() {
    window.postMessage({
      type: 'SMZS_EXPORT',
      data: {
        format: 'json',
        items: currentVideoData ? [{
          type: 'video_info',
          platform: 'tiktok',
          rawData: currentVideoData,
          timestamp: Date.now()
        }] : null
      }
    }, '*');
    showNotification('正在导出数据...', 'success');
  }

  // 采集当前页面
  function collectCurrentPage() {
    extractVideoInfo();
    extractUserInfo();
    showNotification('页面数据采集完成', 'success');
  }

  // 复制到剪贴板
  function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  // 显示通知
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: ${type === 'success' ? '#52c41a' : '#ff4d4f'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: smzsSlideDown 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'smzsSlideUp 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
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
  document.head.appendChild(style);

  // 初始化
  setTimeout(() => {
    extractVideoInfo();
    extractUserInfo();
    createFunctionButtons();
  }, 1500);

  setInterval(() => {
    extractVideoInfo();
  }, 5000);

  window.smzsExtractTiktokData = function() {
    extractVideoInfo();
    extractUserInfo();
  };

  window.smzsDownloadVideo = downloadVideo;
  window.smzsCopyVideoId = copyVideoId;
  window.smzsCopyVideoDesc = copyVideoDesc;
  window.smzsCopyAuthorId = copyAuthorId;
  window.smzsCopyAuthorNickname = copyAuthorNickname;
  window.smzsExportData = exportData;
  window.smzsCollectCurrentPage = collectCurrentPage;
})();
