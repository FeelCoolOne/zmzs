(function() {
  'use strict';

  console.log('社媒助手: 主世界拦截脚本已加载');

  // 平台配置
  const PLATFORMS = [
    { code: 'xiaohongshu', name: '小红书', origin: 'https://www.xiaohongshu.com' },
    { code: 'douyin', name: '抖音', origin: 'https://www.douyin.com' },
    { code: 'kuaishou', name: '快手', origin: 'https://www.kuaishou.com' },
    { code: 'tiktok', name: 'TikTok', origin: 'https://www.tiktok.com' },
    { code: 'xingtu', name: '星图', origin: 'https://www.xingtu.cn' },
    { code: 'pgy.xiaohongshu', name: '蒲公英', origin: 'https://pgy.xiaohongshu.com' }
  ];

  // 检测当前平台
  function detectPlatform() {
    const hostname = location.hostname;
    for (const platform of PLATFORMS) {
      if (hostname.includes(platform.code)) {
        return platform;
      }
    }
    return null;
  }

  const currentPlatform = detectPlatform();
  if (!currentPlatform) {
    console.log('社媒助手: 不支持当前平台');
    return;
  }

  console.log('社媒助手: 检测到平台 -', currentPlatform.name);

  // 存储拦截的数据
  const interceptedData = [];

  // 发送数据到 content script
  function sendToContentScript(type, data) {
    window.postMessage({
      type: 'SMZS_MAIN_WORLD_DATA',
      platform: currentPlatform.code,
      dataType: type,
      data: data,
      timestamp: Date.now()
    }, '*');
  }

  // 解析 JSON
  function tryParseJSON(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (!(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
        !(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  // 检查是否应该拦截此 URL
  function shouldIntercept(url) {
    if (!url || typeof url !== 'string') return false;
    if (!url.startsWith('http')) return false;
    
    const urlObj = new URL(url);
    
    // 小红书
    if (currentPlatform.code === 'xiaohongshu') {
      return url.includes('/sns/web/v1/') || 
             url.includes('/api/sns/') ||
             url.includes('/api/galaxy/');
    }
    
    // 抖音
    if (currentPlatform.code === 'douyin') {
      return url.includes('/aweme/v1/') || 
             url.includes('/web/api/') ||
             url.includes('/api/aweme/');
    }
    
    // 快手
    if (currentPlatform.code === 'kuaishou') {
      return url.includes('/rest/n/') || 
             url.includes('/api/') ||
             url.includes('/graphql');
    }
    
    // TikTok
    if (currentPlatform.code === 'tiktok') {
      return url.includes('/api/') || 
             url.includes('/node/');
    }
    
    return false;
  }

  // 处理响应数据
  function processResponse(url, method, requestBody, responseText) {
    const data = tryParseJSON(responseText);
    if (!data) return;

    // 过滤空数据
    if (Object.keys(data).length === 0) return;

    sendToContentScript('api_response', {
      url: url,
      method: method,
      requestBody: requestBody,
      response: data
    });

    // 解析业务数据
    parseBusinessData(data);
  }

  // 解析业务数据
  function parseBusinessData(data) {
    // 小红书
    if (currentPlatform.code === 'xiaohongshu') {
      // 笔记数据
      if (data.data?.noteData) {
        const notes = Object.values(data.data.noteData);
        notes.forEach(note => {
          sendToContentScript('note_info', note);
        });
      }
      
      // 用户数据
      if (data.data?.userData) {
        sendToContentScript('user_info', data.data.userData);
      }
      
      // 评论数据
      if (data.data?.comments) {
        sendToContentScript('comment_info', data.data.comments);
      }
    }
    
    // 抖音
    if (currentPlatform.code === 'douyin') {
      // 视频列表
      if (data.aweme_details) {
        data.aweme_details.forEach(video => {
          sendToContentScript('video_info', video);
        });
      }
      
      // 用户列表
      if (data.user_list) {
        data.user_list.forEach(user => {
          sendToContentScript('user_info', user);
        });
      }
      
      // 评论数据
      if (data.comments) {
        sendToContentScript('comment_info', data.comments);
      }
    }
    
    // 快手
    if (currentPlatform.code === 'kuaishou') {
      if (data.data?.video) {
        sendToContentScript('video_info', data.data.video);
      }
      if (data.data?.user) {
        sendToContentScript('user_info', data.data.user);
      }
    }
    
    // TikTok
    if (currentPlatform.code === 'tiktok') {
      if (data.data?.video) {
        sendToContentScript('video_info', data.data.video);
      }
      if (data.data?.user) {
        sendToContentScript('user_info', data.data.user);
      }
    }
  }

  // 拦截 XMLHttpRequest
  function interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._smzs_method = method;
      this._smzs_url = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      const xhr = this;
      
      // 保存请求体
      if (body && typeof body === 'string') {
        xhr._smzs_body = body;
      }

      // 拦截 onload
      const originalOnload = xhr.onload;
      xhr.onload = function() {
        if (xhr._smzs_url && shouldIntercept(xhr._smzs_url)) {
          try {
            const contentType = xhr.getResponseHeader('content-type');
            if (contentType && contentType.includes('application/json')) {
              processResponse(
                xhr._smzs_url,
                xhr._smzs_method,
                xhr._smzs_body,
                xhr.responseText
              );
            }
          } catch (e) {
            console.warn('社媒助手: XHR 处理错误', e);
          }
        }
        
        if (originalOnload) {
          originalOnload.apply(this, arguments);
        }
      };

      return originalSend.apply(this, arguments);
    };

    console.log('社媒助手: XMLHttpRequest 拦截已启用');
  }

  // 拦截 Fetch API
  function interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async function(url, options = {}) {
      // 小红书特殊处理：过滤扩展自身请求
      if (currentPlatform.code === 'xiaohongshu') {
        if (typeof url === 'string' && url.startsWith('chrome-extension://')) {
          url = 'chrome-extension://invalid/';
        }
      }

      const response = await originalFetch.apply(this, arguments);

      // 克隆响应（因为响应只能读取一次）
      if (shouldIntercept(response.url)) {
        try {
          const clonedResponse = response.clone();
          const contentType = clonedResponse.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            clonedResponse.text().then(text => {
              processResponse(
                response.url,
                options.method || 'GET',
                options.body,
                text
              );
            });
          }
        } catch (e) {
          console.warn('社媒助手: Fetch 处理错误', e);
        }
      }

      return response;
    };

    console.log('社媒助手: Fetch API 拦截已启用');
  }

  // 提取页面初始状态
  function extractInitialState() {
    setTimeout(() => {
      try {
        // 小红书
        if (currentPlatform.code === 'xiaohongshu' && window.__INITIAL_STATE__) {
          const state = window.__INITIAL_STATE__;
          
          if (state.note?.noteDetailMap) {
            const notes = Object.values(state.note.noteDetailMap);
            notes.forEach(note => {
              sendToContentScript('note_info', note);
            });
          }
          
          if (state.user?.user) {
            sendToContentScript('user_info', state.user.user);
          }
          
          if (state.comment?.comments) {
            sendToContentScript('comment_info', state.comment.comments);
          }
        }
        
        // 抖音
        if (currentPlatform.code === 'douyin' && window.__INITIAL_STATE__) {
          const state = window.__INITIAL_STATE__;
          
          if (state.videoData) {
            sendToContentScript('video_info', state.videoData);
          }
          
          if (state.user) {
            sendToContentScript('user_info', state.user);
          }
          
          if (state.comments) {
            sendToContentScript('comment_info', state.comments);
          }
        }
        
        // 快手
        if (currentPlatform.code === 'kuaishou' && window.__INITIAL_STATE__) {
          const state = window.__INITIAL_STATE__;
          
          if (state.video) {
            sendToContentScript('video_info', state.video);
          }
          
          if (state.user) {
            sendToContentScript('user_info', state.user);
          }
        }
        
        // TikTok
        if (currentPlatform.code === 'tiktok' && window.__REACT_DEFAULT_STATE__) {
          const state = window.__REACT_DEFAULT_STATE__;
          
          if (state.video) {
            sendToContentScript('video_info', state.video);
          }
          
          if (state.user) {
            sendToContentScript('user_info', state.user);
          }
        }
      } catch (e) {
        console.warn('社媒助手: 提取初始状态失败', e);
      }
    }, 1000);
  }

  // 初始化
  function init() {
    interceptXHR();
    interceptFetch();
    extractInitialState();
    
    // 定时刷新
    setInterval(() => {
      extractInitialState();
    }, 5000);

    console.log('社媒助手: 主世界拦截初始化完成');
  }

  // 立即执行
  init();

  // 暴露全局函数供外部调用
  window.smzsExtractData = function() {
    extractInitialState();
  };

  window.smzsGetInterceptedData = function() {
    return interceptedData;
  };

})();
