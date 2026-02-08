(function() {
  'use strict';

  console.log('社媒助手: 小红书拦截脚本已加载');

  // 平台配置
  const PLATFORM = {
    code: 'xiaohongshu',
    name: '小红书',
    origin: 'https://www.xiaohongshu.com',
    domains: ['xiaohongshu.com', 'pgy.xiaohongshu.com']
  };

  // 检查 URL 是否应该被拦截（与原版 Yn 函数逻辑一致）
  function shouldIntercept(url) {
    if (!url) return false;
    if (typeof url !== 'string') return true;

    // 检查是否是 HTTP/HTTPS 请求
    if (!url.startsWith('http')) return false;

    try {
      const urlObj = new URL(url);
      // 检查是否属于小红书域名
      return PLATFORM.domains.some(domain => urlObj.hostname.endsWith(domain));
    } catch (e) {
      return false;
    }
  }

  // 检查字符串是否是有效的 JSON（与原版 Tr 函数逻辑一致）
  function isValidJSON(str) {
    if (!str) return false;
    const trimmed = str.trim();
    if (!trimmed) return false;
    return !!(trimmed.startsWith('{') && trimmed.endsWith('}') ||
              trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  // 解析 JSON（与原版 bt 函数逻辑一致）
  function parseJSON(str) {
    if (isValidJSON(str)) {
      try {
        return JSON.parse(str);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // 检查对象是否为空（与原版 Xn 函数逻辑一致）
  function isEmptyObject(e) {
    if (e == null) return true;
    if (Array.isArray(e) || typeof e === 'string') return e.length === 0;
    if (e instanceof Map || e instanceof Set) return e.size === 0;
    if (typeof e === 'object') {
      for (const r in e) {
        if (Object.prototype.hasOwnProperty.call(e, r)) return false;
      }
      return true;
    }
    return false;
  }

  // 发送数据到 content script（与原版 yr("response", data) 逻辑一致）
  function sendResponse(data) {
    try {
      window.postMessage({
        type: 'SMZS_MAIN_WORLD_DATA',
        platform: PLATFORM.code,
        dataType: 'api_response',
        data: data,
        timestamp: Date.now()
      }, '*');
      console.log('社媒助手: 发送数据到 content script', data.url);
    } catch (error) {
      console.warn('社媒助手: 发送消息失败', error);
    }
  }

  // 发送特定类型数据到 content script
  function sendTypedResponse(dataType, data) {
    try {
      window.postMessage({
        type: 'SMZS_MAIN_WORLD_DATA',
        platform: PLATFORM.code,
        dataType: dataType,
        data: data,
        timestamp: Date.now()
      }, '*');
      console.log('社媒助手: 发送' + dataType + '到 content script');
    } catch (error) {
      console.warn('社媒助手: 发送消息失败', error);
    }
  }

  // 解析业务数据（从 API 响应中提取具体业务对象）
  function parseBusinessData(url, method, requestBody, responseData) {
    if (!responseData || typeof responseData !== 'object') return;

    const data = responseData.data || responseData;
    if (!data) return;

    // 笔记数据 - noteData
    if (data.noteData) {
      const notes = Object.values(data.noteData);
      notes.forEach(note => {
        if (note) {
          sendTypedResponse('note_info', {
            url: url,
            method: method,
            body: requestBody,
            result: note
          });
        }
      });
    }

    // 用户数据 - userData
    if (data.userData) {
      sendTypedResponse('user_info', {
        url: url,
        method: method,
        body: requestBody,
        result: data.userData
      });
    }

    // 评论数据 - comments
    if (data.comments) {
      sendTypedResponse('comment_info', {
        url: url,
        method: method,
        body: requestBody,
        result: data.comments
      });
    }

    // 搜索笔记列表
    if (data.notes && Array.isArray(data.notes)) {
      data.notes.forEach(note => {
        if (note) {
          sendTypedResponse('note_info', {
            url: url,
            method: method,
            body: requestBody,
            result: note
          });
        }
      });
    }

    // 用户列表
    if (data.users && Array.isArray(data.users)) {
      data.users.forEach(user => {
        if (user) {
          sendTypedResponse('user_info', {
            url: url,
            method: method,
            body: requestBody,
            result: user
          });
        }
      });
    }

    // 笔记详情（单个笔记）
    if (data.note && typeof data.note === 'object' && !Array.isArray(data.note)) {
      sendTypedResponse('note_info', {
        url: url,
        method: method,
        body: requestBody,
        result: data.note
      });
    }

    // 用户详情（单个用户）
    if (data.user && typeof data.user === 'object' && !Array.isArray(data.user)) {
      sendTypedResponse('user_info', {
        url: url,
        method: method,
        body: requestBody,
        result: data.user
      });
    }
  }

  // 处理 XHR 响应（与原版 da 函数逻辑一致）
  function handleXHRResponse(xhr) {
    if (!xhr) return;

    // 检查 content-type
    const contentType = xhr.getResponseHeader('content-type');
    if (!contentType || !contentType.includes('application/json')) return;

    // 检查 responseType
    if (!['', 'text'].includes(xhr.responseType)) return;

    // 检查 URL
    if (!shouldIntercept(xhr.responseURL)) return;

    // 检查响应文本
    if (!isValidJSON(xhr.responseText)) return;

    // 解析响应
    const result = parseJSON(xhr.responseText);
    if (isEmptyObject(result)) return;

    // 解析请求体
    let body = null;
    if (xhr._smzs_data) {
      body = parseJSON(xhr._smzs_data);
    }

    // 构建数据对象
    const data = {
      url: xhr.responseURL,
      method: xhr._smzs_method || 'GET',
      body: body,
      result: result
    };

    // 延迟发送（与原版一致）
    setTimeout(() => sendResponse(data), 500);

    // 解析并发送业务数据
    parseBusinessData(xhr.responseURL, xhr._smzs_method || 'GET', body, result);
  }

  // 处理 Fetch 响应（与原版 ha 函数逻辑一致）
  async function handleFetchResponse(response, options) {
    if (!response || !response.ok) return;
    if (!shouldIntercept(response.url)) return;

    // 检查 content-type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return;

    try {
      // 克隆响应（因为 response 只能读取一次）
      const clonedResponse = response.clone();
      let result = null;

      // 特殊处理抖音搜索流（原版逻辑）
      if (response.url.includes('/aweme/v1/web/general/search/stream/')) {
        const text = await clonedResponse.text();
        const parts = text.split('\n').filter((part, index) => (index + 1) % 2 === 0);
        const dataList = [];
        for (const part of parts) {
          const parsed = parseJSON(part);
          if (parsed) {
            if (dataList.length > 0 && parsed.ack === -1) {
              dataList.pop();
            } else if ('status_code' in parsed) {
              dataList.push(parsed);
            }
          }
        }
        if (dataList.length >= 1) {
          const allData = dataList.flatMap(item => Array.isArray(item.data) ? item.data : []);
          result = dataList[dataList.length - 1];
          result.data = allData;
        }
      } else {
        const text = await clonedResponse.text();
        result = parseJSON(text);
      }

      if (isEmptyObject(result)) return;

      // 解析请求体
      let body = null;
      if (options && options.body && typeof options.body === 'string') {
        body = parseJSON(options.body);
      }

      // 构建数据对象
      const data = {
        url: response.url,
        method: options?.method || 'GET',
        body: body,
        result: result
      };

      // 延迟发送（与原版一致）
      setTimeout(() => sendResponse(data), 500);

      // 解析并发送业务数据
      parseBusinessData(response.url, options?.method || 'GET', body, result);
    } catch (error) {
      console.warn('社媒助手: 处理 Fetch 响应失败', error);
    }
  }

  // 拦截 XMLHttpRequest（与原版 pa 函数逻辑一致）
  function interceptXHR() {
    const originalSend = XMLHttpRequest.prototype.send;
    const originalOpen = XMLHttpRequest.prototype.open;

    // 拦截 open 方法保存 method
    XMLHttpRequest.prototype.open = function() {
      if (arguments.length > 0) {
        this._smzs_method = arguments[0];
      }
      return originalOpen.apply(this, arguments);
    };

    // 拦截 send 方法
    XMLHttpRequest.prototype.send = function() {
      const xhr = this;
      const originalOnload = xhr.onload;

      // 保存请求体
      if (arguments.length > 0 && typeof arguments[0] === 'string') {
        if (isValidJSON(arguments[0])) {
          xhr._smzs_data = arguments[0];
        }
      }

      // 拦截 onload
      xhr.onload = function() {
        try {
          handleXHRResponse(xhr);
        } catch (error) {
          console.warn('社媒助手: 处理 XHR 响应失败', error);
        }
        if (originalOnload) {
          originalOnload.apply(this, arguments);
        }
      };

      return originalSend.apply(this, arguments);
    };
  }

  // 拦截 Fetch API（与原版 ga 函数逻辑一致）
  function interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async function() {
      // 小红书特殊处理：过滤扩展自身请求（原版逻辑）
      try {
        if (location.hostname.endsWith('xiaohongshu.com') &&
            arguments.length > 0 &&
            typeof arguments[0] === 'string' &&
            arguments[0].startsWith('chrome-extension://')) {
          arguments[0] = 'chrome-extension://invalid/';
        }
      } catch (error) {
        console.warn(error);
      }

      // 执行原始请求
      const response = await originalFetch.apply(this, arguments);

      // 处理响应
      try {
        handleFetchResponse(response, arguments.length > 1 ? arguments[1] : {});
      } catch (error) {
        console.warn(error);
      }

      return response;
    };
  }

  // 从页面初始状态提取数据
  function extractFromInitialState() {
    try {
      const state = window.__INITIAL_STATE__;
      if (!state) return;

      console.log('社媒助手: 从 __INITIAL_STATE__ 提取数据');

      const notes = [];

      // 提取笔记详情
      if (state.note?.noteDetailMap) {
        Object.values(state.note.noteDetailMap).forEach(note => {
          if (note) notes.push(note);
        });
      }

      // 提取搜索/推荐流的笔记
      if (state.search?.notes) {
        state.search.notes.forEach(note => {
          if (note) notes.push(note);
        });
      }

      // 提取用户主页笔记
      if (state.userPosted?.notes) {
        state.userPosted.notes.forEach(note => {
          if (note) notes.push(note);
        });
      }

      // 发送提取的笔记
      if (notes.length > 0) {
        window.postMessage({
          type: 'SMZS_MAIN_WORLD_DATA',
          platform: PLATFORM.code,
          dataType: 'initial_state_notes',
          data: {
            url: window.location.href,
            method: 'GET',
            body: null,
            result: { notes: notes }
          },
          timestamp: Date.now()
        }, '*');
        console.log('社媒助手: 从初始状态提取到', notes.length, '条笔记');
      }

      // 提取用户信息
      if (state.user?.user) {
        window.postMessage({
          type: 'SMZS_MAIN_WORLD_DATA',
          platform: PLATFORM.code,
          dataType: 'user_info',
          data: {
            url: window.location.href,
            method: 'GET',
            body: null,
            result: state.user.user
          },
          timestamp: Date.now()
        }, '*');
      }
    } catch (error) {
      console.error('社媒助手: 提取初始状态失败', error);
    }
  }

  // 监听页面变化
  function observePageChanges() {
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('社媒助手: 页面变化，重新提取数据');
        setTimeout(extractFromInitialState, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听 history 变化
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(extractFromInitialState, 1000);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(extractFromInitialState, 1000);
    };

    window.addEventListener('popstate', () => {
      setTimeout(extractFromInitialState, 1000);
    });
  }

  // 初始化
  function init() {
    console.log('社媒助手: 初始化小红书拦截脚本');

    // 拦截 XHR 和 Fetch
    interceptXHR();
    interceptFetch();

    // 提取初始状态数据
    setTimeout(extractFromInitialState, 1500);

    // 监听页面变化
    observePageChanges();

    // 定期提取数据
    setInterval(extractFromInitialState, 5000);
  }

  // 启动
  init();

})();
