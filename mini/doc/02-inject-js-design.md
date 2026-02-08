# inject.js 注入脚本设计文档

## 概述

inject.js 在主世界（MAIN world）中运行，负责拦截页面的 XHR 和 Fetch 请求，提取小红书 API 数据，并通过 CustomEvent 发送到隔离环境。

## 核心功能

1. **XHR 请求拦截** - 重写 XMLHttpRequest 原型方法
2. **Fetch 请求拦截** - 重写 fetch 全局函数
3. **数据解析** - 按 URL 模式解析不同类型的数据
4. **初始状态提取** - 从 `__INITIAL_STATE__` 提取数据

## 完整代码实现

```javascript
// content-scripts/inject.js
(function() {
  'use strict';
  
  // ==================== 配置区域 ====================
  const CONFIG = {
    DEBUG: false,
    INTERCEPT_TYPES: ['note_info', 'user_info', 'comment_info', 'search_result'],
    EXCLUDE_URLS: ['/log/', '/track/', '/monitor/', '/metrics/']
  };
  
  // ==================== 工具函数 ====================
  const utils = {
    log: (...args) => CONFIG.DEBUG && console.log('[XHS-Inject]', ...args),
    
    generateId: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    
    isExcluded: (url) => CONFIG.EXCLUDE_URLS.some(ex => url.includes(ex)),
    
    safeJSONParse: (text) => {
      try {
        return JSON.parse(text);
      } catch(e) {
        return null;
      }
    }
  };
  
  // ==================== XHR 拦截器 ====================
  function interceptXHR() {
    const OriginalXHR = window.XMLHttpRequest;
    
    function PatchedXHR() {
      const xhr = new OriginalXHR();
      const xhrWrapper = this;
      
      // 保存原始方法引用
      let originalOpen = xhr.open.bind(xhr);
      let originalSend = xhr.send.bind(xhr);
      
      // 请求信息存储
      let requestInfo = {
        method: null,
        url: null,
        headers: {},
        body: null,
        startTime: null
      };
      
      // 重写 open 方法
      xhrWrapper.open = function(method, url, ...args) {
        requestInfo.method = method;
        requestInfo.url = url;
        requestInfo.startTime = Date.now();
        return originalOpen(method, url, ...args);
      };
      
      // 重写 send 方法
      xhrWrapper.send = function(body) {
        requestInfo.body = body;
        
        // 监听响应完成
        xhr.addEventListener('load', function() {
          if (utils.isExcluded(requestInfo.url)) return;
          
          const response = utils.safeJSONParse(xhr.responseText);
          if (response) {
            processResponse(requestInfo, response, 'xhr');
          }
        });
        
        return originalSend(body);
      };
      
      // 代理属性和方法
      ['responseText', 'status', 'statusText', 'readyState'].forEach(prop => {
        Object.defineProperty(xhrWrapper, prop, {
          get: () => xhr[prop],
          configurable: true
        });
      });
      
      xhrWrapper.addEventListener = function(...args) {
        return xhr.addEventListener(...args);
      };
      
      return xhrWrapper;
    }
    
    PatchedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
    
    utils.log('XHR interceptor installed');
  }
  
  // ==================== Fetch 拦截器 ====================
  function interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(resource, init = {}) {
      const url = typeof resource === 'string' ? resource : resource.url;
      const requestInfo = {
        method: init.method || 'GET',
        url: url,
        headers: init.headers || {},
        body: init.body,
        startTime: Date.now()
      };
      
      if (utils.isExcluded(requestInfo.url)) {
        return originalFetch(resource, init);
      }
      
      try {
        const response = await originalFetch(resource, init);
        
        // 克隆响应以读取数据
        const clonedResponse = response.clone();
        
        try {
          const data = await clonedResponse.json();
          processResponse(requestInfo, data, 'fetch');
        } catch(e) {
          // 非 JSON 响应，忽略
        }
        
        return response;
      } catch(error) {
        throw error;
      }
    };
    
    utils.log('Fetch interceptor installed');
  }
  
  // ==================== 数据解析器 ====================
  const parsers = {
    
    /**
     * 解析笔记列表数据
     */
    parseNoteList(url, data) {
      const patterns = [
        '/user/profile/notes',
        '/notes/list',
        '/api/sns/web/v1/notes'
      ];
      
      if (!patterns.some(p => url.includes(p))) return null;
      
      const notes = data.data?.notes || data.notes || [];
      
      return {
        type: 'note_list',
        data: notes.map(note => ({
          noteId: note.note_id || note.id,
          title: note.title || note.display_title,
          desc: note.desc,
          cover: note.cover?.url || note.cover_url,
          likes: note.likes || note.liked_count || 0,
          collects: note.collects || note.collected_count || 0,
          comments: note.comments || note.comments_count || 0,
          shares: note.shares || note.share_count || 0,
          author: {
            userId: note.user?.user_id || note.user_id,
            nickname: note.user?.nickname || note.user_name,
            avatar: note.user?.avatar
          },
          createTime: note.create_time || note.time
        }))
      };
    },
    
    /**
     * 解析笔记详情数据
     */
    parseNoteDetail(url, data) {
      const patterns = ['/note/detail', '/notes/detail', '/galaxy/v1/notes/detail'];
      
      if (!patterns.some(p => url.includes(p))) return null;
      
      const note = data.data?.note || data.note || data.data;
      if (!note) return null;
      
      return {
        type: 'note_info',
        data: {
          noteId: note.note_id || note.id,
          title: note.title || note.display_title,
          desc: note.desc,
          content: note.content,
          cover: note.cover?.url || note.cover_url,
          images: (note.images || []).map(img => img.url || img),
          video: note.video?.url || note.video_url,
          likes: note.likes || note.liked_count || 0,
          collects: note.collects || note.collected_count || 0,
          comments: note.comments || note.comments_count || 0,
          shares: note.shares || note.share_count || 0,
          author: {
            userId: note.user?.user_id || note.user_id,
            nickname: note.user?.nickname || note.user_name,
            avatar: note.user?.avatar,
            followCount: note.user?.follows,
            fansCount: note.user?.fans
          },
          createTime: note.create_time || note.time,
          tags: (note.tag_list || []).map(t => t.name),
          location: note.location?.name
        }
      };
    },
    
    /**
     * 解析用户详情数据
     */
    parseUserInfo(url, data) {
      const patterns = ['/user/profile', '/user/info', '/api/user/'];
      
      if (!patterns.some(p => url.includes(p))) return null;
      
      const user = data.data?.user || data.user || data.data;
      if (!user) return null;
      
      return {
        type: 'user_info',
        data: {
          userId: user.user_id || user.id,
          nickname: user.nickname || user.name,
          avatar: user.avatar,
          desc: user.desc || user.description,
          follows: user.follows || user.follow_count || 0,
          fans: user.fans || user.fans_count || 0,
          notes: user.notes || user.note_count || 0,
          collected: user.collected || user.collected_count || 0,
          liked: user.liked || user.liked_count || 0,
          verifyStatus: user.verify_status,
          verifyName: user.verify_name,
          location: user.location,
          tags: user.tags || []
        }
      };
    },
    
    /**
     * 解析评论数据
     */
    parseComments(url, data) {
      if (!url.includes('/comment')) return null;
      
      const comments = data.data?.comments || data.comments || [];
      
      return {
        type: 'comment_info',
        data: comments.map(c => ({
          commentId: c.comment_id || c.id,
          content: c.content || c.text,
          likes: c.likes || c.liked_count || 0,
          author: {
            userId: c.user?.user_id || c.user_id,
            nickname: c.user?.nickname || c.user_name
          },
          replyTo: c.reply_to?.user_id,
          createTime: c.create_time || c.time,
          subComments: (c.sub_comments || []).map(sub => ({
            commentId: sub.comment_id || sub.id,
            content: sub.content,
            author: sub.user?.nickname
          }))
        }))
      };
    },
    
    /**
     * 解析搜索结果
     */
    parseSearch(url, data) {
      if (!url.includes('/search')) return null;
      
      const items = data.data?.items || data.items || [];
      
      return {
        type: 'search_result',
        data: {
          keyword: data.data?.keyword,
          total: data.data?.total || items.length,
          items: items.map(item => {
            if (item.note) {
              return { 
                type: 'note', 
                noteId: item.note.note_id || item.note.id,
                title: item.note.title,
                cover: item.note.cover?.url,
                likes: item.note.likes || 0,
                author: item.note.user?.nickname
              };
            } else if (item.user) {
              return { 
                type: 'user',
                userId: item.user.user_id || item.user.id,
                nickname: item.user.nickname,
                avatar: item.user.avatar
              };
            }
            return item;
          })
        }
      };
    }
  };
  
  // ==================== 响应处理 ====================
  function processResponse(requestInfo, response, source) {
    let parsedData = null;
    
    // 依次尝试各个解析器
    const parserNames = ['parseNoteList', 'parseNoteDetail', 'parseUserInfo', 'parseComments', 'parseSearch'];
    
    for (const name of parserNames) {
      try {
        parsedData = parsers[name](requestInfo.url, response);
        if (parsedData) break;
      } catch(e) {
        utils.log('Parser error:', name, e);
      }
    }
    
    if (!parsedData) return;
    
    // 构建事件数据
    const eventData = {
      id: utils.generateId(),
      type: parsedData.type,
      data: parsedData.data,
      source,
      url: requestInfo.url,
      method: requestInfo.method,
      timestamp: Date.now(),
      platform: 'xiaohongshu'
    };
    
    // 发送事件到 content.js
    window.dispatchEvent(new CustomEvent('smzs:response', {
      detail: eventData
    }));
    
    // 调试支持
    if (CONFIG.DEBUG) {
      window._lastInterceptedData = eventData;
    }
    
    utils.log('Intercepted:', parsedData.type, requestInfo.url);
  }
  
  // ==================== 初始状态提取 ====================
  function extractInitialState() {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      // 尝试多个可能的状态变量名
      const state = window.__INITIAL_STATE__ || 
                    window.__INITIAL_SSR_STATE__ ||
                    window._SSR_HYDRATED_DATA;
      
      if (state) {
        clearInterval(checkInterval);
        
        const eventData = {
          id: utils.generateId(),
          type: 'initial_state',
          data: state,
          source: 'initial',
          url: location.href,
          timestamp: Date.now(),
          platform: 'xiaohongshu'
        };
        
        window.dispatchEvent(new CustomEvent('smzs:initialState', {
          detail: eventData
        }));
        
        utils.log('Initial state extracted');
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        utils.log('Initial state extraction timeout');
      }
    }, 500);
  }
  
  // ==================== 初始化 ====================
  function init() {
    utils.log('Initializing interceptors...');
    
    // 安装拦截器
    interceptXHR();
    interceptFetch();
    
    // 提取初始状态
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', extractInitialState);
    } else {
      extractInitialState();
    }
    
    // 暴露调试接口
    window._smzsInject = {
      version: '1.0.0',
      config: CONFIG,
      getLastData: () => window._lastInterceptedData,
      parsers: Object.keys(parsers)
    };
    
    utils.log('Injectors initialized');
  }
  
  // 立即执行
  init();
})();
```

## 关键设计点

### 1. 双重拦截机制

| 拦截方式 | 优点 | 缺点 |
|---------|------|------|
| XHR | 兼容旧代码 | 现代应用使用较少 |
| Fetch | 现代标准 | 需要处理 Promise |

### 2. 数据解析策略

```
URL 匹配 -> 数据提取 -> 格式化 -> 发送事件
```

### 3. 错误处理

- 使用 try-catch 包裹解析逻辑
- 非 JSON 响应自动忽略
- 解析失败不影响页面正常运行

### 4. 性能优化

- 排除日志/监控请求
- 使用响应克隆避免干扰原始请求
- 批量数据使用 map 处理

## 调试方法

```javascript
// 在页面控制台执行
_smzsInject.getLastData()  // 查看最后拦截的数据
_smzsInject.parsers        // 查看可用解析器
_smzsInject.config.DEBUG = true  // 开启调试日志
```

## 注意事项

1. **执行时机**: 必须在 `document_start` 注入，确保在页面脚本之前执行
2. **原型链保护**: 正确维护 XHR 原型链，避免破坏页面功能
3. **内存泄漏**: 避免在闭包中持有大量引用
4. **跨域限制**: 无法拦截跨域请求的响应详情
