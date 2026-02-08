# 开发指南

## 开发环境准备

### 必需工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Chrome 浏览器 | 95+ | 支持 `world: "MAIN"` |
| 文本编辑器 | - | VS Code / WebStorm 等 |
| 图片编辑工具 | - | 制作扩展图标 |

### 推荐扩展

- **Chrome DevTools**: 内置调试工具
- **JSON Viewer**: 格式化 JSON 数据
- **EditThisCookie**: 查看和编辑 Cookie

## 项目初始化

### 1. 创建目录结构

```bash
mkdir mini-xhs-collector
cd mini-xhs-collector

# 创建目录
mkdir content-scripts
mkdir xiaohongshu
mkdir icons
mkdir doc

# 创建文件
touch manifest.json
touch background.js
touch sidepanel.html
touch sidepanel.css
touch sidepanel.js
touch content-scripts/content.js
touch content-scripts/inject.js
touch content-scripts/content.css
touch xiaohongshu/rule.json
```

### 2. 准备图标

创建以下尺寸的 PNG 图标：

- `icons/icon16.png` - 16x16
- `icons/icon32.png` - 32x32
- `icons/icon48.png` - 48x48
- `icons/icon128.png` - 128x128

可以使用在线工具生成：[favicon.io](https://favicon.io/)

## 开发流程

### 1. 编写 manifest.json

参考 [01-manifest-design.md](./01-manifest-design.md)

### 2. 开发 inject.js

参考 [02-inject-js-design.md](./02-inject-js-design.md)

**调试技巧：**

```javascript
// 在页面控制台执行
_smzsInject.config.DEBUG = true;  // 开启调试
_smzsInject.getLastData();        // 查看最后数据
```

### 3. 开发 content.js

参考 [03-content-js-design.md](./03-content-js-design.md)

**调试技巧：**

- 在 DevTools -> Sources -> Content scripts 中查看
- 使用 `console.log` 输出调试信息

### 4. 开发 background.js

参考 [04-background-design.md](./04-background-design.md)

**调试技巧：**

- 访问 `chrome://extensions/`
- 点击 Service Worker 链接打开 DevTools
- 查看 Console 输出

### 5. 开发 sidepanel

参考 [05-sidepanel-design.md](./05-sidepanel-design.md)

**调试技巧：**

- 右键扩展图标 -> 检查弹出内容
- 或使用 DevTools -> Sources -> Page

## 加载扩展

### 1. 打开扩展管理页面

```
chrome://extensions/
```

### 2. 开启开发者模式

点击右上角的 "开发者模式" 开关

### 3. 加载已解压的扩展

1. 点击 "加载已解压的扩展程序"
2. 选择 `mini-xhs-collector` 目录
3. 扩展将出现在列表中

### 4. 重新加载

修改代码后，点击扩展卡片上的刷新按钮重新加载

## 调试技巧

### 1. 查看 Content Scripts

```
DevTools -> Sources -> Content scripts
-> top -> 小红书页面 -> Content Scripts
```

### 2. 查看 IndexedDB

```
DevTools -> Application -> Storage -> IndexedDB
-> XHSCollectorDB -> collectedItems
```

### 3. 查看 Network 拦截

```
DevTools -> Network
查看被拦截的 XHR/Fetch 请求
```

### 4. Service Worker 调试

```
chrome://extensions/ -> 找到扩展
-> Service Worker 链接
-> 打开 DevTools
```

### 5. 日志过滤

```javascript
// 在 Console 中过滤
/[XHS-Inject]/  // 查看 inject.js 日志
/[XHS-Collector]/  // 查看 content.js 日志
/[Background]/  // 查看 background.js 日志
```

## 常见问题

### 1. 扩展无法加载

**问题**: 提示 "清单文件缺失或不可读取"

**解决**:
- 检查 `manifest.json` 是否存在
- 检查 JSON 格式是否正确
- 使用 [JSONLint](https://jsonlint.com/) 验证

### 2. Content Script 未注入

**问题**: 页面没有悬浮按钮

**解决**:
- 检查 `matches` 模式是否正确
- 检查 `run_at` 是否为 `document_start`
- 在 DevTools 查看是否有错误

### 3. 请求拦截失败

**问题**: 无法拦截到请求

**解决**:
- 检查 inject.js 是否正确注入
- 在页面控制台执行 `_smzsInject` 查看是否存在
- 检查 URL 匹配模式

### 4. IndexedDB 错误

**问题**: 无法读写数据

**解决**:
- 检查数据库版本升级逻辑
- 清除浏览器数据后重试
- 检查存储配额是否已满

### 5. 侧边栏无法打开

**问题**: 点击图标无反应

**解决**:
- 检查 `sidePanel` 权限是否声明
- 检查 `sidepanel.html` 路径是否正确
- 查看 Service Worker 是否有错误

## 测试清单

### 功能测试

- [ ] 扩展正常加载
- [ ] 访问小红书页面自动注入
- [ ] XHR/Fetch 请求被拦截
- [ ] 数据保存到 IndexedDB
- [ ] 悬浮按钮正常显示
- [ ] 侧边栏可以打开
- [ ] 数据列表正确显示
- [ ] 筛选功能正常
- [ ] 导出 JSON 正常
- [ ] 导出 CSV 正常
- [ ] 清空数据正常

### 兼容性测试

- [ ] Chrome 95+
- [ ] Edge 95+
- [ ] 不同分辨率屏幕
- [ ] 暗色/亮色模式

### 性能测试

- [ ] 采集 1000+ 条数据
- [ ] 快速滚动数据列表
- [ ] 频繁切换筛选条件
- [ ] 导出大数据量文件

## 发布准备

### 1. 代码检查

```bash
# 检查 manifest.json
# 确保版本号正确
# 确保权限最小化

# 检查 console.log
# 移除或注释掉调试日志

# 检查错误处理
# 确保所有异步操作有 try-catch
```

### 2. 打包扩展

```bash
# 创建 zip 文件
zip -r mini-xhs-collector.zip mini-xhs-collector/ \
  -x "*.md" -x "doc/*" -x ".DS_Store"
```

### 3. 发布到 Chrome Web Store

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. 点击 "添加新内容"
3. 上传 zip 文件
4. 填写商店信息
5. 提交审核

### 4. 商店信息准备

- **名称**: 小红书采集助手(Mini)
- **描述**: 轻量级小红书数据采集工具
- **图标**: 128x128 PNG
- **截图**: 1280x800 或 640x400
- **宣传图**: 可选

## 版本更新

### 版本号规范

```
主版本号.次版本号.修订号
```

- **主版本号**: 重大功能变更
- **次版本号**: 新增功能
- **修订号**: Bug 修复

### 更新流程

1. 更新 `manifest.json` 中的版本号
2. 修改代码
3. 测试所有功能
4. 更新发布说明
5. 重新打包上传

## 参考资源

### 官方文档

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/sidePanel/)
- [IndexedDB API](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API)

### 社区资源

- [Chrome Extensions Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- [MDN Web Extensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

## 贡献指南

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 添加 JSDoc 注释
- 避免使用 `var`

### 提交规范

```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建相关
```

### 示例

```
feat: 添加评论数据采集功能
fix: 修复导出 CSV 时中文乱码问题
docs: 更新开发指南
```
