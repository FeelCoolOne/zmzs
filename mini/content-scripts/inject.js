// inject.js - 主世界注入脚本
(function() {
  'use strict';
  
  const CONFIG = {
    DEBUG: true,
    EXCLUDE_URLS: ['/log/', '/track/', '/monitor/', '/metrics/']
  };
  
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
  
  // XHR 拦截器
  function interceptXHR() {
    const OriginalXHR = window.XMLHttpRequest;
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;
    
    OriginalXHR.prototype.open = function(method, url, ...args) {
      this._smzs_method = method;
      this._smzs_url = url;
      this._smzs_startTime = Date.now();
      return originalOpen.apply(this, [method, url, ...args]);
    };
    
    OriginalXHR.prototype.send = function(body) {
      this._smzs_body = body;
      
      const xhr = this;
      
      this.addEventListener('load', function() {
        if (utils.isExcluded(xhr._smzs_url)) return;
        
        const response = utils.safeJSONParse(xhr.responseText);
        if (response) {
          const requestInfo = {
            method: xhr._smzs_method,
            url: xhr._smzs_url,
            startTime: xhr._smzs_startTime
          };
          processResponse(requestInfo, response, 'xhr');
        }
      });
      
      return originalSend.apply(this, arguments);
    };
    
    utils.log('XHR interceptor installed');
  }
  
  // Fetch 拦截器
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
        const clonedResponse = response.clone();
        
        try {
          const data = await clonedResponse.json();
          processResponse(requestInfo, data, 'fetch');
        } catch(e) {}
        
        return response;
      } catch(error) {
        throw error;
      }
    };
    
    utils.log('Fetch interceptor installed');
  }
  
  // 数据解析器
  const parsers = {
    parseNoteList(url, data) {
      const patterns = ['/user/profile/notes', '/notes/list', '/api/sns/web/v1/notes', '/sns/web/v1/user/profile/notes'];
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
    
    parseNoteDetail(url, data) {
      // 只匹配单个笔记详情 API 端点
      const detailPatterns = ['/note/detail', '/notes/detail', '/galaxy/v1/notes/detail'];
      
      if (!detailPatterns.some(p => url.includes(p))) return null;
      
      const note = data.data?.note || data.note || data.data;
      if (!note) return null;
      
      return this.normalizeNote(note);
    },
    
    // 标准化笔记数据
    normalizeNote(note) {
      if (!note) return null;
      
      return {
        type: 'note_info',
        data: {
          noteId: note.note_id || note.id || note.note_card_id,
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
    
    parseComments(url, data) {
      if (!url.includes('/comment')) return null;

      const comments = data.data?.comments || data.comments || [];

      return {
        type: 'comment_info',
        data: comments.map(c => ({
          // 评论ID
          commentId: c.comment_id || c.id,

          // 评论内容
          content: c.content || c.text,

          // 点赞量
          likes: c.likes || c.liked_count || 0,

          // 评论时间
          createTime: c.create_time || c.time,

          // IP地址
          ipLocation: c.user?.ip_location || c.ip_location,

          // 子评论数
          subCommentCount: c.sub_comment_count || c.sub_comments?.length || 0,

          // 笔记ID（从URL或其他字段获取）
          noteId: c.note_id || c.target_id || '',

          // 笔记链接
          noteLink: c.note_link || c.target_link || '',

          // 用户ID
          userId: c.user?.user_id || c.user_id || '',

          // 用户链接
          userLink: c.user?.user_link || c.user_link || '',

          // 用户名称
          userName: c.user?.nickname || c.user_name || c.user?.name || '',

          // 一级评论ID（如果是回复，则为父评论ID）
          parentCommentId: c.parent_comment_id || c.parent_id || c.reply_to?.comment_id || '',

          // 一级评论内容
          parentCommentContent: c.parent_comment_content || c.reply_to?.content || '',

          // 评论图片链接
          commentImages: c.pictures || c.images || c.comment_pics || [],

          // 应用的评论ID（可能是平台特定的ID）
          appCommentId: c.app_comment_id || c.app_id || '',

          // 引用的评论内容
          quotedCommentContent: c.quoted_comment_content || c.quote_content || '',

          // 作者信息对象（保留完整信息）
          author: {
            userId: c.user?.user_id || c.user_id,
            nickname: c.user?.nickname || c.user_name,
            avatar: c.user?.avatar,
            level: c.user?.level,
            ipLocation: c.user?.ip_location
          },

          // 回复信息
          replyTo: c.reply_to?.user_id,
          replyToNickname: c.reply_to?.nickname,

          // 其他可能的字段
          isAuthor: c.is_author || false,
          isLiked: c.is_liked || false,

          // 子评论列表
          subComments: (c.sub_comments || []).map(sub => ({
            commentId: sub.comment_id || sub.id,
            content: sub.content || sub.text,
            author: sub.user?.nickname || sub.user_name,
            authorId: sub.user?.user_id || sub.user_id,
            likes: sub.likes || sub.liked_count || 0,
            createTime: sub.create_time || sub.time
          }))
        }))
      };
    },
    
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
    },
    
    parseRelatedNotes(url, data) {
      if (!url.includes('/related') && !url.includes('/recommend')) return null;
      
      const notes = data.data?.notes || data.notes || data.data?.items || [];
      
      return {
        type: 'related_notes',
        data: notes.map(note => ({
          noteId: note.note_id || note.id,
          title: note.title || note.display_title,
          cover: note.cover?.url || note.cover_url,
          likes: note.likes || note.liked_count || 0,
          author: {
            userId: note.user?.user_id || note.user_id,
            nickname: note.user?.nickname || note.user_name
          }
        }))
      };
    },
    
    parseFollows(url, data) {
      if (!url.includes('/follows') && !url.includes('/following')) return null;
      
      const users = data.data?.users || data.users || [];
      
      return {
        type: 'follows_list',
        data: users.map(user => ({
          userId: user.user_id || user.id,
          nickname: user.nickname || user.name,
          avatar: user.avatar,
          desc: user.desc || user.description,
          isFollowed: user.is_followed || user.followed
        }))
      };
    },
    
    parseFans(url, data) {
      if (!url.includes('/fans')) return null;
      
      const users = data.data?.users || data.users || [];
      
      return {
        type: 'fans_list',
        data: users.map(user => ({
          userId: user.user_id || user.id,
          nickname: user.nickname || user.name,
          avatar: user.avatar,
          desc: user.desc || user.description
        }))
      };
    },
    
    parseLikedNotes(url, data) {
      if (!url.includes('/liked') && !url.includes('/likes')) return null;
      
      const notes = data.data?.notes || data.notes || [];
      
      return {
        type: 'liked_notes',
        data: notes.map(note => ({
          noteId: note.note_id || note.id,
          title: note.title || note.display_title,
          cover: note.cover?.url,
          likes: note.likes || 0,
          author: {
            userId: note.user?.user_id,
            nickname: note.user?.nickname
          }
        }))
      };
    },
    
    parseCollectedNotes(url, data) {
      if (!url.includes('/collected') && !url.includes('/collection')) return null;
      
      const notes = data.data?.notes || data.notes || [];
      
      return {
        type: 'collected_notes',
        data: notes.map(note => ({
          noteId: note.note_id || note.id,
          title: note.title || note.display_title,
          cover: note.cover?.url,
          likes: note.likes || 0,
          author: {
            userId: note.user?.user_id,
            nickname: note.user?.nickname
          }
        }))
      };
    },
    
    parseHomeFeed(url, data) {
      if (!url.includes('/feed') || url.includes('/rest/n/feed')) return null;
      
      const items = data.data?.items || data.items || [];
      
      return {
        type: 'home_feed',
        data: items.map(item => {
          const note = item.note_card || item;
          // 处理图片列表
          let images = [];
          if (note.images && Array.isArray(note.images)) {
            images = note.images.map(img => img.url || img);
          } else if (note.image_list && Array.isArray(note.image_list)) {
            images = note.image_list.map(img => {
              if (img.url_default) return img.url_default;
              if (img.url) return img.url;
              if (img.info_list && img.info_list.length > 0) {
                const dft = img.info_list.find(i => i.image_scene === 'WB_DFT');
                if (dft) return dft.url;
                return img.info_list[0].url;
              }
              return '';
            }).filter(url => url);
          }
          
          return {
            noteId: note.note_id || note.id || note.note_card_id,
            title: note.title || note.display_title,
            desc: note.desc || note.description,
            content: note.content,
            cover: note.cover?.url || note.cover_url || (images.length > 0 ? images[0] : ''),
            images: images,
            video: note.video?.url || note.video_url || '',
            likes: note.likes || note.liked_count || 0,
            collects: note.collected_count || 0,
            comments: note.comments_count || 0,
            shares: note.share_count || 0,
            author: {
              userId: note.user?.user_id || note.user_id,
              nickname: note.user?.nickname || note.user_name,
              avatar: note.user?.avatar,
              followCount: note.user?.follows || 0,
              fansCount: note.user?.fans || 0
            },
            createTime: note.create_time || note.time,
            tags: (note.tag_list || []).map(t => t.name).filter(name => name),
            location: note.location?.name || ''
          };
        })
      };
    },
    
    parseExplore(url, data) {
      if (!url.includes('/explore') && !url.includes('/discovery')) return null;
      
      const items = data.data?.items || data.items || [];
      
      return {
        type: 'explore',
        data: items.map(item => ({
          noteId: item.note_id || item.id,
          title: item.title || item.display_title,
          cover: item.cover?.url,
          likes: item.likes || 0,
          author: item.user?.nickname
        }))
      };
    },
    
    parseTagNotes(url, data) {
      if (!url.includes('/tag/') && !url.includes('/topic/')) return null;
      
      const notes = data.data?.notes || data.notes || [];
      const tagInfo = data.data?.tag || data.tag || {};
      
      return {
        type: 'tag_notes',
        data: {
          tagId: tagInfo.id,
          tagName: tagInfo.name,
          tagType: tagInfo.type,
          notes: notes.map(note => ({
            noteId: note.note_id || note.id,
            title: note.title || note.display_title,
            cover: note.cover?.url,
            likes: note.likes || 0,
            author: {
              userId: note.user?.user_id,
              nickname: note.user?.nickname
            }
          }))
        }
      };
    },
    
    parseNotifications(url, data) {
      if (!url.includes('/notification') && !url.includes('/message')) return null;
      
      const notifications = data.data?.notifications || data.notifications || [];
      
      return {
        type: 'notifications',
        data: notifications.map(notif => ({
          notificationId: notif.id,
          type: notif.type,
          title: notif.title,
          content: notif.content,
          time: notif.create_time,
          isRead: notif.is_read,
          relatedNote: notif.note ? {
            noteId: notif.note.note_id,
            title: notif.note.title
          } : null
        }))
      };
    },
    
    parseShopItems(url, data) {
      if (!url.includes('/shop/') && !url.includes('/goods/') && !url.includes('/product/')) return null;
      
      const items = data.data?.items || data.items || data.data?.goods || [];
      
      return {
        type: 'shop_items',
        data: items.map(item => ({
          itemId: item.id || item.item_id,
          name: item.name || item.title,
          price: item.price,
          originalPrice: item.original_price,
          cover: item.cover?.url || item.image,
          sales: item.sales || item.sales_count,
          shopName: item.shop?.name
        }))
      };
    },
    
    parseLiveInfo(url, data) {
      if (!url.includes('/live/') && !url.includes('/room/')) return null;
      
      const room = data.data?.room || data.room || data.data;
      if (!room) return null;
      
      return {
        type: 'live_info',
        data: {
          roomId: room.room_id || room.id,
          title: room.title,
          status: room.status,
          viewerCount: room.viewer_count || room.online_count,
          anchor: {
            userId: room.user?.user_id || room.anchor?.user_id,
            nickname: room.user?.nickname || room.anchor?.nickname,
            avatar: room.user?.avatar || room.anchor?.avatar
          },
          startTime: room.start_time,
          cover: room.cover?.url
        }
      };
    }
  };
  
  // 发送数据到 content script（与原版一致使用 postMessage）
  function sendToContentScript(dataType, data) {
    try {
      console.log('[XHS-Inject] Sending data:', dataType, data);
      window.postMessage({
        type: 'SMZS_MAIN_WORLD_DATA',
        platform: 'xiaohongshu',
        dataType: dataType,
        data: data,
        timestamp: Date.now()
      }, '*');
      utils.log('Sent to content script:', dataType);
      console.log('[XHS-Inject] Data sent successfully');
    } catch (error) {
      console.error('[XHS-Inject] Send failed:', error);
      utils.log('Send failed:', error);
    }
  }
  
  // 响应处理
  function processResponse(requestInfo, response, source) {
    let parsedData = null;
    const parserNames = [
      'parseHomeFeed',  // 优先处理 feed，避免被 parseNoteDetail 拦截
      'parseExplore',
      'parseNoteList', 
      'parseNoteDetail', 
      'parseUserInfo', 
      'parseComments', 
      'parseSearch',
      'parseRelatedNotes',
      'parseFollows',
      'parseFans',
      'parseLikedNotes',
      'parseCollectedNotes',
      'parseTagNotes',
      'parseNotifications',
      'parseShopItems',
      'parseLiveInfo'
    ];
    
    for (const name of parserNames) {
      try {
        parsedData = parsers[name](requestInfo.url, response);
        if (parsedData) break;
      } catch(e) {
        utils.log('Parser error:', name, e);
      }
    }
    
    if (!parsedData) return;

    // 使用 postMessage 发送解析后的数据（与 extractInitialState 格式一致）
    console.log('[XHS-Inject] Sending data to content script:', parsedData.type, 
                'data type:', typeof parsedData.data, 
                'isArray:', Array.isArray(parsedData.data),
                'data:', JSON.stringify(parsedData.data).substring(0, 200));
    sendToContentScript(parsedData.type, {
      url: requestInfo.url,
      method: requestInfo.method,
      body: requestInfo.body,
      result: parsedData.data
    });

    // 如果是 feed 类型的数据，同时发送第一个笔记作为当前笔记
    console.log('[XHS-Inject] Checking if should send note_info from feed:', parsedData.type);
    console.log('[XHS-Inject] parsedData.data type:', typeof parsedData.data, 'isArray:', Array.isArray(parsedData.data));
    if (parsedData.data && typeof parsedData.data === 'object') {
      console.log('[XHS-Inject] parsedData.data keys:', Object.keys(parsedData.data));
    }
    
    if ((parsedData.type === 'home_feed' || parsedData.type === 'explore')) {
      let notesArray = null;
      
      // 尝试多种可能的数据结构
      if (Array.isArray(parsedData.data)) {
        notesArray = parsedData.data;
      } else if (parsedData.data && Array.isArray(parsedData.data.items)) {
        notesArray = parsedData.data.items;
      } else if (parsedData.data && Array.isArray(parsedData.data.notes)) {
        notesArray = parsedData.data.notes;
      }
      
      console.log('[XHS-Inject] notesArray:', notesArray ? notesArray.length : 'null');
      
      if (notesArray && notesArray.length > 0) {
        const firstNote = notesArray[0];
        console.log('[XHS-Inject] Sending first note from feed as note_info:', firstNote.noteId || firstNote.id);
        sendToContentScript('note_info', {
          url: requestInfo.url,
          method: requestInfo.method,
          body: requestInfo.body,
          result: firstNote
        });
      } else {
        console.log('[XHS-Inject] Not sending note_info: data is not array or empty');
      }
    }

    // 同时发送原始响应数据
    sendToContentScript('api_response', {
      url: requestInfo.url,
      method: requestInfo.method,
      body: requestInfo.body,
      result: response
    });

    if (CONFIG.DEBUG) {
      window._lastInterceptedData = parsedData;
    }

    utils.log('Intercepted:', parsedData.type, requestInfo.url);
  }
  
  // 标准化笔记数据格式（与解析器一致）
  function normalizeNoteData(noteWrapper) {
    if (!noteWrapper) return null;
    
    // 实际的笔记数据在 noteWrapper.note 中，但如果 note 为空，则使用 noteWrapper 本身
    let note = noteWrapper.note;
    
    // 如果 note 为空对象或不存在，尝试使用 noteWrapper 本身
    if (!note || Object.keys(note).length === 0) {
      note = noteWrapper;
    }
    
    if (!note || Object.keys(note).length === 0) {
      console.warn('[XHS-Inject] No note data found!');
      return null;
    }
    
    // 调试：查看 note 对象的完整内容
    console.log('[XHS-Inject] Normalizing note, keys:', Object.keys(note));
    console.log('[XHS-Inject] Note sample:', JSON.stringify(note).substring(0, 200));
    
    // 尝试多种可能的 ID 字段
    const noteId = note.noteId || note.note_id || note.id || note.note_card_id;
    
    if (!noteId) {
      console.warn('[XHS-Inject] Could not find note ID!');
      console.log('[XHS-Inject] Note object:', JSON.stringify(note, null, 2));
      return null;
    }
    
    // 从 interactInfo 获取互动数据
    const interactInfo = note.interactInfo || {};
    
    // 处理图片列表 - 提取最高质量的图片URL
    let images = [];
    if (note.imageList && Array.isArray(note.imageList)) {
      images = note.imageList.map(img => {
        // 优先顺序: urlDefault > url > infoList[1].url (WB_DFT格式) > infoList[0].url (WB_PRV格式)
        if (img.urlDefault) return img.urlDefault;
        if (img.url) return img.url;
        if (img.infoList && img.infoList.length > 0) {
          // 尝试找到 WB_DFT (默认大图) 格式
          const dftImg = img.infoList.find(info => info.imageScene === 'WB_DFT');
          if (dftImg && dftImg.url) return dftImg.url;
          // 如果没有 WB_DFT，使用第一个可用的
          if (img.infoList[0].url) return img.infoList[0].url;
        }
        return '';
      }).filter(url => url);
    }
    
    return {
      noteId: noteId,
      title: note.title || note.displayTitle || '',
      desc: note.desc || note.description || '',
      content: note.content || '',
      cover: note.cover?.url || note.coverUrl || (images.length > 0 ? images[0] : ''),
      images: images,
      video: note.video?.url || note.videoUrl || '',
      likes: parseInt(interactInfo.likedCount) || 0,
      collects: parseInt(interactInfo.collectedCount) || 0,
      comments: parseInt(interactInfo.commentCount) || 0,
      shares: parseInt(interactInfo.shareCount) || 0,
      author: {
        userId: note.user?.userId || note.user?.user_id || '',
        nickname: note.user?.nickname || '',
        avatar: note.user?.avatar || '',
        followCount: note.user?.follows || 0,
        fansCount: note.user?.fans || 0
      },
      createTime: note.createTime || note.time || '',
      tags: (note.tagList || []).map(t => t.name || '').filter(name => name),
      location: note.location?.name || '',
      xsecToken: note.xsecToken || ''
    };
  }

  // 标准化用户数据格式（与解析器一致）
  function normalizeUserData(user) {
    if (!user) return null;
    return {
      userId: user.user_id || user.id,
      nickname: user.nickname || user.name,
      avatar: user.avatar,
      desc: user.desc || user.description,
      follows: user.follows || user.follow_count || 0,
      fans: user.fans || user.fans_count || 0,
      liked: user.liked || user.liked_count || 0,
      collected: user.collected || user.collected_count || 0,
      tags: user.tags || []
    };
  }

  // 初始状态提取（与原版一致）
  function extractInitialState() {
    console.log('[XHS-Inject] Starting extractInitialState...');
    let attempts = 0;
    const maxAttempts = 20;

    const checkInterval = setInterval(() => {
      attempts++;
      console.log('[XHS-Inject] Checking initial state, attempt:', attempts);

      const state = window.__INITIAL_STATE__ ||
                    window.__INITIAL_SSR_STATE__ ||
                    window._SSR_HYDRATED_DATA;

      if (state) {
        console.log('[XHS-Inject] Found initial state!');
        clearInterval(checkInterval);

        // 提取笔记数据
        if (state.note?.noteDetailMap) {
          const notes = Object.values(state.note.noteDetailMap);
          console.log('[XHS-Inject] Found', notes.length, 'notes in noteDetailMap');
          console.log('[XHS-Inject] First note keys:', notes.length > 0 ? Object.keys(notes[0]) : 'no notes');
          console.log('[XHS-Inject] First note sample:', notes.length > 0 ? JSON.stringify(notes[0]).substring(0, 300) : 'no notes');
          notes.forEach((note, index) => {
            console.log('[XHS-Inject] Processing note', index, 'keys:', Object.keys(note));
            const normalizedNote = normalizeNoteData(note);
            if (normalizedNote) {
              console.log('[XHS-Inject] Sending note', index, ':', normalizedNote.noteId);
              sendToContentScript('note_info', {
                url: location.href,
                method: 'GET',
                body: null,
                result: normalizedNote
              });
            } else {
              console.log('[XHS-Inject] Failed to normalize note', index);
            }
          });
        }

        // 提取搜索/推荐流的笔记
        if (state.search?.notes) {
          console.log('[XHS-Inject] Found', state.search.notes.length, 'notes in search');
          state.search.notes.forEach((note, index) => {
            const normalizedNote = normalizeNoteData(note);
            if (normalizedNote) {
              console.log('[XHS-Inject] Sending search note', index, ':', normalizedNote.noteId);
              sendToContentScript('note_info', {
                url: location.href,
                method: 'GET',
                body: null,
                result: normalizedNote
              });
            }
          });
        }

        // 提取用户主页笔记
        if (state.userPosted?.notes) {
          console.log('[XHS-Inject] Found', state.userPosted.notes.length, 'notes in userPosted');
          state.userPosted.notes.forEach((note, index) => {
            const normalizedNote = normalizeNoteData(note);
            if (normalizedNote) {
              console.log('[XHS-Inject] Sending userPosted note', index, ':', normalizedNote.noteId);
              sendToContentScript('note_info', {
                url: location.href,
                method: 'GET',
                body: null,
                result: normalizedNote
              });
            }
          });
        }

        // 提取用户信息
        if (state.user?.user) {
          const normalizedUser = normalizeUserData(state.user.user);
          if (normalizedUser) {
            console.log('[XHS-Inject] Sending user:', normalizedUser.userId);
            sendToContentScript('user_info', {
              url: location.href,
              method: 'GET',
              body: null,
              result: normalizedUser
            });
          }
        }

        // 不再发送完整的 state，因为它包含无法克隆的函数
        // sendToContentScript('initial_state', {...})

        utils.log('Initial state extracted');
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        utils.log('Initial state extraction timeout');
      }
    }, 500);
  }
  
  // 初始化
  function init() {
    console.log('[XHS-Inject] Initializing...');
    utils.log('Initializing interceptors...');
    
    interceptXHR();
    interceptFetch();
    
    console.log('[XHS-Inject] Interceptors set up. Document state:', document.readyState);
    
    if (document.readyState === 'loading') {
      console.log('[XHS-Inject] Waiting for DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', extractInitialState);
    } else {
      console.log('[XHS-Inject] Document already loaded, calling extractInitialState directly');
      extractInitialState();
    }
    
    // 监听路由变化（单页应用导航）
    let lastUrl = location.href;
    const observeUrlChange = () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        console.log('[XHS-Inject] URL changed from', lastUrl, 'to', currentUrl);
        lastUrl = currentUrl;
        // 延迟执行，等待新页面数据加载
        setTimeout(() => {
          console.log('[XHS-Inject] Re-extracting data after navigation...');
          extractInitialState();
        }, 1500);
      }
    };
    
    // 使用 MutationObserver 监听 URL 变化
    const urlObserver = new MutationObserver(observeUrlChange);
    urlObserver.observe(document, { subtree: true, childList: true });
    
    // 也监听 popstate 和 hashchange 事件
    window.addEventListener('popstate', () => {
      console.log('[XHS-Inject] Popstate event detected');
      setTimeout(extractInitialState, 1500);
    });
    
    window.addEventListener('hashchange', () => {
      console.log('[XHS-Inject] Hashchange event detected');
      setTimeout(extractInitialState, 1500);
    });
    
    console.log('[XHS-Inject] Route change observers installed');
    
    window._smzsInject = {
      version: '1.0.0',
      config: CONFIG,
      getLastData: () => window._lastInterceptedData,
      parsers: Object.keys(parsers)
    };
    
    utils.log('Injectors initialized');
  }
  
  init();
})();
