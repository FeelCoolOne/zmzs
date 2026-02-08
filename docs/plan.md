计划：还原代码库源代码并创建离线版本

目标

1. 还原（反编译/解混淆）Chrome 扩展的源代码
2. 创建离线版本（支持现有平台：抖音、小红书、快手、TikTok、星图）

当前状态

- 这是一个使用 WXT 框架构建的 Manifest V3 Chrome 扩展
- 代码已被压缩和混淆（在 chunks/ 目录中）
- 有网络依赖（数据上传到 smzs.xisence.com）
- 使用 declarativeNetRequest 进行网络请求拦截

探索结果摘要

网络依赖（需离线化）

- smzs.xisence.com/api/collect - 数据收集上传（XOR加密）
- smzs.xisence.com/api/upload - 文件上传（20MB限制）
- VIP验证、用户中心、支付页面等

当前支持平台

- 抖音、小红书、快手、TikTok、星图、蒲公英

存储机制

- chrome.storage.local 用于本地配置
- 云端存储用于数据收集和分析

待探索问题

1. 如何有效解压缩/反混淆 JavaScript 代码
2. 哪些功能依赖于云端服务
3. 如何将数据存储从云端改为本地

建议方案（已确定：仅保留核心功能，快速离线化）

关键修改文件

1. background.js - 移除 collect/upload 云端逻辑，改为本地存储
2. manifest.json - 移除云端域名
3. chunks/sidepanel-xxx.js - 移除 VIP 验证，添加本地数据管理
4. content-scripts/content.js - 移除云端上报调用

核心改造点

1. 移除云端 collect 功能

- 当前: 数据 XOR 加密后上传到 smzs.xisence.com/api/collect
- 改为: 存储到 IndexedDB，结构：{id, platform, type, rawData, normalized, collectedAt, tags}

2. 移除云端 upload 功能

- 当前: 文件上传到云端 API
- 改为: 使用 chrome.downloads.download() 直接保存到本地

3. 本地存储设计

- IndexedDB 数据库: SocialMediaAssistant
- 对象存储:
  - collectedItems - 采集的数据
  - mediaFiles - 媒体文件元数据
  - downloadHistory - 下载历史
  - exportTasks - 导出任务
  - settings - 本地配置

4. 数据导出功能

- 格式支持: XLSX, CSV, JSON
- 触发方式: 手动导出或自动导出（采集后自动保存）
- 实现: 使用 chrome.downloads API 弹出保存对话框

实施步骤

阶段 1: 基础改造（1-2 天）
├── 修改 manifest.json（移除云端域名）
├── 创建 IndexedDB 本地存储模块
└── 改造 background.js（移除云端，添加本地接口）

阶段 2: 功能迁移（2-3 天）
├── 改造 sidepanel（移除 VIP，添加数据管理）
└── 改造 options 页面（本地导出配置）

阶段 3: 测试优化（1-2 天）
├── 功能测试（采集、存储、导出、下载）
└── 性能优化（大数据量处理）

技术实现要点

// 改造后的 collect 函数示例
d("collect", async ({ data, sender }) => {
  const record = {
    id: crypto.randomUUID(),
    platform: detectPlatform(sender.url),
    data: data,
    collectedAt: Date.now()
  };

  // 改为本地存储
  await saveToIndexedDB('collectedItems', record);

  // 可选：自动导出
  const config = await getExportConfig();
  if (config.autoExport) {
    await exportToFile([record], config.format);
  }
});

// 数据导出实现
async function exportToFile(items, format) {
  const blob = generateBlob(items, format); // xlsx/csv/json
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url: url,
    filename: `导出_${Date.now()}.${format}`,
    saveAs: true
  });
}

风险与注意事项

1. 代码已混淆，修改前需格式化并备份
2. 本地存储无云端备份，需添加导出备份功能
3. 确保飞书同步功能（如保留）正常工作

---Plan updated based on user choice: 仅保留核心功能，快速离线化
