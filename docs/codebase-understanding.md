# 社媒助手 - 代码库结构理解

## 项目概述

这是一个基于 **Manifest V3** 的 Chrome 浏览器扩展，名为**"社媒助手"**，是一个社交媒体数据采集工具。项目使用现代前端技术栈（React + WXT 框架）构建。

## 目录结构

```
采集器/
├── manifest.json              # 扩展配置文件（Manifest V3）
├── background.js              # Service Worker 后台脚本
├── sidepanel.html             # 侧边栏页面入口
├── options.html               # 选项设置页面入口
├── content-scripts/           # 内容脚本（注入到目标页面）
│   ├── content.js             # 隔离环境脚本（主逻辑，266KB）
│   ├── mian.js                # 主世界脚本（可能拼写应为 main）
│   └── content.css            # 样式
├── chunks/                    # 代码分割块（构建产物）
│   ├── sidepanel-xxx.js       # 侧边栏逻辑
│   ├── options-xxx.js         # 选项页面逻辑
│   ├── index-xxx.js           # 通用工具函数
│   ├── feishu-config-xxx.js   # 飞书配置
│   └── _virtual_wxt-plugins-xxx.js  # WXT 框架插件
├── assets/                    # CSS 资源文件
├── xiaohongshu/               # 小红书平台特定代码
│   ├── rule.json              # 声明式网络请求规则（重定向）
│   └── vendor-dynamic.js      # 注入的脚本，用于拦截 HTTP 请求
├── douyin/                    # 抖音平台特定代码
│   ├── rule.json              # 声明式网络请求规则
│   └── client-entry.js        # 注入的脚本，用于拦截 HTTP 请求
├── _locales/                  # 国际化文件
│   └── zh_CN/messages.json    # 中文语言包
├── _metadata/                 # Chrome 商店验证元数据
├── icon/                      # 扩展图标（16/32/48/96/128px）
└── assets/                    # 其他静态资源
```

## 核心功能

1. **多平台支持**：小红书、抖音、快手、TikTok、星图
2. **数据采集**：达人信息、作品、评论数据
3. **无水印下载**：视频/图片一键下载
4. **飞书同步**：支持将数据同步到飞书
5. **批量导出**：数据批量导出功能

## 技术实现细节

### 1. 后台脚本（background.js）

- 处理侧边栏打开 (`openSidepanel`)
- 执行远程脚本 (`executeScript`)
- 处理数据采集和上传 (`collect`)
- 定时任务（闹钟）执行采集
- 文件上传功能 (`upload`)
- 网络请求代理 (`fetch`)

### 2. 内容脚本（content-scripts/）

- **content.js**: 在隔离环境中运行，负责与扩展后台通信
- **mian.js**: 在主世界（MAIN world）中运行，可直接访问页面 DOM 和 JS 对象
- **content.css**: 注入样式到目标页面

### 3. 网络请求拦截机制

使用 `declarativeNetRequest` API 重定向平台关键 JS 文件：

- **小红书**: 重定向 `vendor-dynamic.*.js` 到自定义脚本，注入 `window._smzsRequest`
- **抖音**: 重定向 `client-entry~*.js` 到自定义脚本，注入 `window._smzsHttpGet` 和 `window._smzsHttpPost`

这些注入的脚本用于拦截平台的 HTTP 请求函数，从而获取 API 调用和数据。

### 4. 数据加密上传

- 使用 XOR 加密算法加密采集的数据
- 随机生成 16 字节密钥
- 上传地址: `https://smzs.xisence.com/api/collect`
- 包含信息: 账号信息、设备ID、Cookies、版本号、平台类型、CPU架构、操作系统

### 5. 权限配置

```json
{
  "permissions": [
    "tabs",
    "downloads",
    "storage",
    "scripting",
    "cookies",
    "alarms",
    "declarativeNetRequestWithHostAccess",
    "sidePanel"
  ],
  "host_permissions": ["<all_urls>"]
}
```

## 构建工具

项目使用 **WXT** 框架进行开发：
- 代码经过压缩和混淆
- 使用代码分割（chunks）优化加载性能
- 支持热更新和现代化开发体验

## 平台支持详情

| 平台 | 匹配域名 | 特殊处理 |
|------|----------|----------|
| 小红书 | www.xiaohongshu.com, pgy.xiaohongshu.com | vendor-dynamic.js 注入 |
| 抖音 | www.douyin.com | client-entry.js 注入 |
| 快手 | www.kuaishou.com | 基础支持 |
| TikTok | www.tiktok.com | 基础支持 |
| 星图 | www.xingtu.cn | 基础支持 |

## 特殊白名单逻辑

在小红书蒲公英平台（pgy.xiaohongshu.com），扩展对特定用户ID和公司名称启用了特殊权限：

```javascript
const whiteListUserIds = [
  "5ebb50b0000000000101d586",
  "5e742ff700000000010059c9",
  "61e670350000000010005938",
  "5dcd4d2f000000000100afb2",
  "5fa81333000000000100b1a0",
  "566edaffe4251d3d9b5732fb",
  "5fa6b524000000000100bb16"
];

const whiteListCompanies = [
  "云智达创科技",
  "行吟信息科技",
  "小红书科技",
  "薯一薯二"
];
```

---

*文档生成时间: 2026-02-06*
