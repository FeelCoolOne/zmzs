# 图标说明

此目录用于存放扩展图标。

## 需要的图标尺寸

请准备以下尺寸的 PNG 图标文件：

- icon16.png - 16x16 像素
- icon32.png - 32x32 像素
- icon48.png - 48x48 像素
- icon128.png - 128x128 像素

## 图标设计建议

- 使用渐变色：#667eea 到 #764ba2
- 主题：社交媒体、数据采集、云端存储
- 风格：简洁、现代、扁平化
- 背景：透明或圆角矩形

## 临时解决方案

在添加实际图标之前，可以使用在线工具生成占位图标：

1. 访问 https://www.favicon-generator.org/
2. 上传一个 512x512 的图片
3. 下载生成的图标包
4. 将对应尺寸的图标重命名为上述文件名

## 更新 manifest.json

确保 manifest.json 中的图标路径正确：

```json
{
  "icons": {
    "16": "icon/icon16.png",
    "32": "icon/icon32.png",
    "48": "icon/icon48.png",
    "128": "icon/icon128.png"
  }
}
```
