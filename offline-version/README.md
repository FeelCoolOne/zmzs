# 社媒助手 - 离线版

一个功能全面的社交媒体数据采集工具，完全离线运行，数据存储在本地。

## 功能特性

- ✅ **多平台支持**：小红书、抖音、快手、TikTok、星图
- ✅ **数据采集**：自动采集用户信息、作品、评论等数据
- ✅ **本地存储**：使用 IndexedDB 存储所有数据，无需联网
- ✅ **媒体下载**：支持无水印下载视频和图片
- ✅ **数据导出**：支持 JSON、CSV、XLSX 格式导出
- ✅ **侧边栏界面**：简洁美观的侧边栏操作界面
- ✅ **设置管理**：灵活的配置选项

## 项目结构

```
offline-version/
├── manifest.json              # 扩展配置文件
├── background.js              # 后台服务脚本
├── sidepanel.html             # 侧边栏页面
├── options.html               # 选项设置页面
├── lib/
│   └── indexeddb.js          # IndexedDB 本地存储模块
├── scripts/
│   ├── sidepanel.js          # 侧边栏逻辑
│   └── options.js            # 设置页面逻辑
├── styles/
│   ├── sidepanel.css         # 侧边栏样式
│   └── options.css           # 设置页面样式
├── content-scripts/
│   ├── content.js            # 内容脚本（隔离环境）
│   ├── main.js               # 主世界脚本
│   ├── inject-xiaohongshu.js # 小红书拦截脚本
│   ├── inject-douyin.js      # 抖音拦截脚本
│   ├── inject-kuaishou.js    # 快手拦截脚本
│   └── inject-tiktok.js      # TikTok拦截脚本
├── icon/                      # 图标资源
└── _locales/
    └── zh_CN/
        └── messages.json      # 国际化文件
```

## 安装方法

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `offline-version` 文件夹
5. 扩展安装完成！

## 使用说明

### 基本使用

1. **打开侧边栏**：点击扩展图标或使用快捷键 `Alt+C`
2. **采集数据**：在支持的平台上浏览，数据会自动采集
3. **导出数据**：在侧边栏点击"导出数据"按钮
4. **管理设置**：点击设置按钮打开设置页面

### 支持的平台

- **小红书**：www.xiaohongshu.com, pgy.xiaohongshu.com
- **抖音**：www.douyin.com
- **快手**：www.kuaishou.com
- **TikTok**：www.tiktok.com
- **星图**：www.xingtu.cn

### 数据导出

支持三种导出格式：

- **JSON**：完整的数据结构，适合程序处理
- **CSV**：表格格式，适合 Excel 打开
- **XLSX**：Excel 格式，支持复杂表格

## 技术架构

### 数据存储

使用 IndexedDB 存储数据，包含以下对象存储：

- `collectedItems`：采集的数据
- `mediaFiles`：媒体文件元数据
- `downloadHistory`：下载历史
- `exportTasks`：导出任务
- `settings`：用户设置
- `users`：用户信息

### 网络请求拦截

通过注入脚本拦截平台的 API 请求，获取数据：

- 小红书：拦截 `/sns/web/v1/` 和 `/api/sns/` 请求
- 抖音：拦截 `/aweme/v1/` 和 `/web/api/` 请求
- 快手：拦截 `/rest/n/` 和 `/api/` 请求
- TikTok：拦截 `/tiktok/v1/` 和 `/api/` 请求

### 消息通信

使用 Chrome Runtime API 进行组件间通信：

- content scripts ↔ background：数据采集和存储
- sidepanel ↔ background：数据查询和操作
- options ↔ background：设置管理

## 开发说明

### 修改图标

当前使用的是 SVG 占位图标，如需替换为实际图标：

1. 准备以下尺寸的 PNG 图标：
   - 16x16
   - 32x32
   - 48x48
   - 128x128

2. 将图标放入 `icon/` 目录，命名为：
   - icon16.png
   - icon32.png
   - icon48.png
   - icon128.png

3. 更新 `manifest.json` 中的图标路径

### 添加新平台

1. 在 `content-scripts/` 下创建新的注入脚本
2. 在 `content.js` 中添加平台配置
3. 在 `background.js` 中添加平台检测逻辑
4. 更新 `manifest.json` 的 `host_permissions`

### 自定义样式

所有样式文件位于 `styles/` 目录：

- `sidepanel.css`：侧边栏样式
- `options.css`：设置页面样式

使用 CSS 变量方便主题定制：

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #52c41a;
  --danger-color: #ff4d4f;
  --text-color: #333;
  --bg-color: #f5f5f5;
}
```

## 隐私说明

- 所有数据存储在本地浏览器，不会上传到任何服务器
- 网络请求仅在目标平台页面进行拦截
- 不收集任何用户个人信息

## 许可证

MIT License

## 版本历史

### v1.0.0 (2026-02-06)

- 初始版本发布
- 支持小红书、抖音、快手、TikTok、星图
- 实现本地数据存储
- 支持数据导出功能
- 完整的侧边栏和设置界面

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至项目维护者

---

**注意**：本工具仅供学习和研究使用，请遵守相关平台的使用条款和法律法规。
