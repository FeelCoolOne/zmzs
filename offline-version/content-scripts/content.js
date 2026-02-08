const PLATFORMS = {
  xiaohongshu: {
    name: '小红书',
    domains: ['xiaohongshu.com', 'pgy.xiaohongshu.com'],
    injectScript: 'inject-xiaohongshu.js',
    injectUI: true
  },
  douyin: {
    name: '抖音',
    domains: ['douyin.com'],
    injectScript: 'inject-douyin.js',
    injectUI: true
  },
  kuaishou: {
    name: '快手',
    domains: ['kuaishou.com'],
    injectScript: 'inject-kuaishou.js',
    injectUI: true
  },
  tiktok: {
    name: 'TikTok',
    domains: ['tiktok.com'],
    injectScript: 'inject-tiktok.js',
    injectUI: true
  },
  xingtu: {
    name: '星图',
    domains: ['xingtu.cn'],
    injectScript: null,
    injectUI: true
  }
};

function detectPlatform() {
  const hostname = window.location.hostname;
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (platform.domains.some(domain => hostname.includes(domain))) {
      return key;
    }
  }
  return null;
}

function sendMessageToBackground(type, data) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        if (chrome.runtime.lastError) {
          // 扩展上下文失效，静默处理
          if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
            console.warn('社媒助手: 扩展已重新加载，请刷新页面');
            resolve({ success: false, error: '扩展已重新加载，请刷新页面' });
          } else {
            reject(chrome.runtime.lastError);
          }
        } else if (response && response.success) {
          resolve(response.data || response);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    } catch (error) {
      // 扩展上下文完全失效
      if (error.message.includes('Extension context invalidated')) {
        console.warn('社媒助手: 扩展已重新加载，请刷新页面');
        resolve({ success: false, error: '扩展已重新加载，请刷新页面' });
      } else {
        reject(error);
      }
    }
  });
}

function injectScript(scriptPath) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(scriptPath);
  script.onerror = () => {
    console.error(`社媒助手: 无法加载脚本 ${scriptPath}`);
  };
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function initContentScript() {
  const platform = detectPlatform();
  if (!platform) return;

  console.log(`社媒助手: 检测到平台 - ${PLATFORMS[platform].name}`);

  const platformConfig = PLATFORMS[platform];

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    const messageData = event.data;
    if (!messageData) return;

    const type = messageData.type;
    const data = messageData.data;

    switch (type) {
      case 'SMZS_COLLECT':
        try {
          const result = await sendMessageToBackground('collect', data);
          event.source.postMessage({ type: 'SMZS_COLLECT_RESPONSE', success: true, data: result }, '*');
        } catch (error) {
          event.source.postMessage({ type: 'SMZS_COLLECT_RESPONSE', success: false, error: error.message }, '*');
        }
        break;

      case 'SMZS_DOWNLOAD':
        try {
          await sendMessageToBackground('downloadMedia', data);
          event.source.postMessage({ type: 'SMZS_DOWNLOAD_RESPONSE', success: true }, '*');
        } catch (error) {
          event.source.postMessage({ type: 'SMZS_DOWNLOAD_RESPONSE', success: false, error: error.message }, '*');
        }
        break;

      case 'SMZS_EXPORT':
        try {
          await sendMessageToBackground('exportData', data);
          event.source.postMessage({ type: 'SMZS_EXPORT_RESPONSE', success: true }, '*');
        } catch (error) {
          event.source.postMessage({ type: 'SMZS_EXPORT_RESPONSE', success: false, error: error.message }, '*');
        }
        break;

      case 'SMZS_MAIN_WORLD_DATA':
        // 接收来自 main.js 的数据
        try {
          await sendMessageToBackground('collect', {
            type: messageData.dataType || 'api_data',
            platform: messageData.platform,
            rawData: data,
            timestamp: messageData.timestamp
          });
        } catch (error) {
          // 静默处理扩展上下文失效错误
          if (!error.message?.includes('Extension context invalidated')) {
            console.error('社媒助手: 发送数据到后台失败', error);
          }
        }
        break;
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getPageInfo') {
      const pageInfo = {
        platform,
        url: window.location.href,
        title: document.title
      };
      sendResponse({ success: true, data: pageInfo });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

console.log('社媒助手内容脚本已加载');
