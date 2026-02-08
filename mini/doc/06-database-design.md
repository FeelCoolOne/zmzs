# 数据库设计文档

## 概述

Mini 版小红书采集插件使用 IndexedDB 作为本地存储方案，存储采集的数据。

## 数据库结构

### 数据库信息

| 属性 | 值 |
|------|-----|
| 数据库名 | `XHSCollectorDB` |
| 版本 | `1` |
| 存储对象 | `collectedItems` |

### 存储对象 (Object Store)

```javascript
{
  name: 'collectedItems',
  keyPath: 'id',  // 主键
  indexes: [
    { name: 'type', keyPath: 'type', unique: false },
    { name: 'timestamp', keyPath: 'timestamp', unique: false },
    { name: 'noteId', keyPath: 'data.noteId', unique: false },
    { name: 'userId', keyPath: 'data.userId', unique: false }
  ]
}
```

## 数据模型

### 基础数据结构

```typescript
interface CollectedItem {
  id: string;                    // 唯一标识 (时间戳+随机数)
  type: DataType;                // 数据类型
  data: NoteData | UserData | CommentData | SearchData;
  timestamp: number;             // 采集时间戳
  platform: 'xiaohongshu';       // 平台标识
  url: string;                   // 采集页面URL
  source: DataSource;            // 数据来源
}

type DataType = 
  | 'note_info'      // 笔记详情
  | 'note_list'      // 笔记列表
  | 'user_info'      // 用户信息
  | 'comment_info'   // 评论数据
  | 'search_result'  // 搜索结果
  | 'initial_state'; // 初始状态

type DataSource = 
  | 'xhr'            // XHR 请求拦截
  | 'fetch'          // Fetch 请求拦截
  | 'initial_state'  // 页面初始状态
  | 'manual';        // 手动触发
```

### 笔记数据 (NoteData)

```typescript
interface NoteData {
  noteId: string;                // 笔记ID
  title: string;                 // 标题
  desc: string;                  // 描述
  content?: string;              // 正文内容
  cover: string;                 // 封面图URL
  images?: string[];             // 图片URL列表
  video?: string;                // 视频URL
  likes: number;                 // 点赞数
  collects: number;              // 收藏数
  comments: number;              // 评论数
  shares: number;                // 分享数
  author: {
    userId: string;              // 作者ID
    nickname: string;            // 作者昵称
    avatar?: string;             // 作者头像
    followCount?: number;        // 关注数
    fansCount?: number;          // 粉丝数
  };
  createTime: number;            // 创建时间
  tags?: string[];               // 标签
  location?: string;             // 位置
}
```

### 用户数据 (UserData)

```typescript
interface UserData {
  userId: string;                // 用户ID
  nickname: string;              // 昵称
  avatar?: string;               // 头像
  desc?: string;                 // 简介
  follows: number;               // 关注数
  fans: number;                  // 粉丝数
  notes: number;                 // 笔记数
  collected?: number;            // 获收藏数
  liked?: number;                // 获赞数
  verifyStatus?: number;         // 认证状态
  verifyName?: string;           // 认证名称
  location?: string;             // 位置
  tags?: string[];               // 标签
}
```

### 评论数据 (CommentData)

```typescript
interface CommentData {
  commentId: string;             // 评论ID
  content: string;               // 内容
  likes: number;                 // 点赞数
  author: {
    userId: string;              // 作者ID
    nickname: string;            // 作者昵称
  };
  replyTo?: string;              // 回复对象ID
  createTime: number;            // 创建时间
  subComments?: SubComment[];    // 子评论
}

interface SubComment {
  commentId: string;
  content: string;
  author: string;                // 作者昵称
}
```

### 搜索结果 (SearchData)

```typescript
interface SearchData {
  keyword?: string;              // 搜索关键词
  total: number;                 // 总数
  items: SearchItem[];           // 结果项
}

type SearchItem = 
  | { type: 'note'; noteId: string; title: string; cover?: string; likes: number; author?: string }
  | { type: 'user'; userId: string; nickname: string; avatar?: string; desc?: string };
```

## 数据示例

### 笔记详情示例

```json
{
  "id": "1704067200000-abc123",
  "type": "note_info",
  "data": {
    "noteId": "64a1b2c3d4e5f6",
    "title": "这是一篇测试笔记",
    "desc": "笔记描述内容",
    "cover": "https://ci.xiaohongshu.com/xxx.jpg",
    "images": ["https://ci.xiaohongshu.com/1.jpg", "https://ci.xiaohongshu.com/2.jpg"],
    "likes": 1000,
    "collects": 500,
    "comments": 100,
    "shares": 50,
    "author": {
      "userId": "user123",
      "nickname": "测试用户",
      "avatar": "https://img.xiaohongshu.com/avatar.jpg"
    },
    "createTime": 1704000000000,
    "tags": ["美食", "探店"],
    "location": "上海"
  },
  "timestamp": 1704067200000,
  "platform": "xiaohongshu",
  "url": "https://www.xiaohongshu.com/explore/64a1b2c3d4e5f6",
  "source": "xhr"
}
```

### 用户信息示例

```json
{
  "id": "1704067300000-user456",
  "type": "user_info",
  "data": {
    "userId": "user456",
    "nickname": "小红书达人",
    "avatar": "https://img.xiaohongshu.com/avatar.jpg",
    "desc": "分享生活点滴",
    "follows": 100,
    "fans": 10000,
    "notes": 50,
    "verifyStatus": 1,
    "verifyName": "美食博主"
  },
  "timestamp": 1704067300000,
  "platform": "xiaohongshu",
  "url": "https://www.xiaohongshu.com/user/profile/user456",
  "source": "fetch"
}
```

## CRUD 操作

### 创建 (Create)

```javascript
async function saveItem(item) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readwrite');
  const store = transaction.objectStore('collectedItems');
  
  // 检查是否已存在
  if (item.data?.noteId) {
    const existing = await store.index('noteId').get(item.data.noteId);
    if (existing) {
      item.id = existing.id;  // 更新已有数据
    }
  }
  
  await store.put(item);
}
```

### 读取 (Read)

```javascript
// 获取所有数据
async function getAllItems(filters = {}) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readonly');
  const store = transaction.objectStore('collectedItems');
  
  let data = await store.getAll();
  
  // 应用过滤器
  if (filters.type) {
    data = data.filter(item => item.type === filters.type);
  }
  
  // 排序
  data.sort((a, b) => b.timestamp - a.timestamp);
  
  return data;
}

// 通过索引查询
async function getByNoteId(noteId) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readonly');
  const store = transaction.objectStore('collectedItems');
  const index = store.index('noteId');
  
  return await index.get(noteId);
}
```

### 更新 (Update)

```javascript
async function updateItem(id, updates) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readwrite');
  const store = transaction.objectStore('collectedItems');
  
  const item = await store.get(id);
  if (item) {
    Object.assign(item, updates);
    await store.put(item);
  }
}
```

### 删除 (Delete)

```javascript
// 删除单条
async function deleteItem(id) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readwrite');
  const store = transaction.objectStore('collectedItems');
  
  await store.delete(id);
}

// 清空所有
async function clearAll() {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readwrite');
  const store = transaction.objectStore('collectedItems');
  
  await store.clear();
}
```

## 索引使用

### 索引说明

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `type` | `type` | 按类型筛选 |
| `timestamp` | `timestamp` | 按时间排序 |
| `noteId` | `data.noteId` | 笔记去重 |
| `userId` | `data.userId` | 用户去重 |

### 索引查询示例

```javascript
// 按类型查询
const index = store.index('type');
const request = index.openCursor(IDBKeyRange.only('note_info'));

// 按时间范围查询
const index = store.index('timestamp');
const request = index.openCursor(
  IDBKeyRange.bound(startTime, endTime)
);
```

## 存储限制

| 限制项 | 值 | 说明 |
|--------|-----|------|
| 单个数据库容量 | 约 60% 可用磁盘空间 | 浏览器限制 |
| 单个对象大小 | 无明确限制 | 但建议 < 10MB |
| 最大条目数 | 配置为 10000 | 可调整 |

## 性能优化

### 批量操作

```javascript
// 批量插入
async function batchInsert(items) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readwrite');
  const store = transaction.objectStore('collectedItems');
  
  items.forEach(item => store.put(item));
  
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = reject;
  });
}
```

### 分页查询

```javascript
async function getItemsPaged(page = 1, pageSize = 50) {
  const db = await openDB();
  const transaction = db.transaction(['collectedItems'], 'readonly');
  const store = transaction.objectStore('collectedItems');
  const index = store.index('timestamp');
  
  const items = [];
  let count = 0;
  const skip = (page - 1) * pageSize;
  
  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, 'prev');
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      
      if (!cursor) {
        resolve(items);
        return;
      }
      
      if (count >= skip) {
        items.push(cursor.value);
      }
      
      count++;
      
      if (items.length < pageSize) {
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    
    request.onerror = reject;
  });
}
```

## 数据迁移

### 版本升级

```javascript
// 版本 1 -> 2
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;
  
  if (oldVersion < 1) {
    // 创建初始存储
    const store = db.createObjectStore('collectedItems', { keyPath: 'id' });
    store.createIndex('type', 'type', { unique: false });
    store.createIndex('timestamp', 'timestamp', { unique: false });
  }
  
  if (oldVersion < 2) {
    // 版本 2: 添加新索引
    const store = request.transaction.objectStore('collectedItems');
    store.createIndex('noteId', 'data.noteId', { unique: false });
    store.createIndex('userId', 'data.userId', { unique: false });
  }
};
```

## 注意事项

1. **异步操作**: 所有 IndexedDB 操作都是异步的
2. **事务管理**: 读写操作必须在事务中执行
3. **错误处理**: 需要处理 `onerror` 和 `onabort` 事件
4. **存储空间**: 注意浏览器存储配额限制
5. **数据备份**: 重要数据建议定期导出备份
