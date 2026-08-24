# DreamForge Logo使用指南

**文件名**: ChatGPT Image 2026年7月26日 22_27_40.png  
**建议用途**: 作为DreamForge品牌Logo

---

## 📁 Logo文件处理

### 需要完成的步骤：
```
1. 重命名文件: logo.png
2. 上传位置: D:/Claude Code 视频项目/image-gen-studio/public/logo.png
3. 格式要求: PNG（支持透明背景）
4. 推荐尺寸: 512x512 或 1024x1024 像素
```

### 当前Schema引用：
```json
"logo": "https://mengjing233.cn/logo.png"
```

---

## 🎨 Logo使用场景

| 场景 | 引用方式 |
|------|---------|
| Organization Schema | `logo` 字段 |
| Open Graph | `<meta property="og:image">` |
| Twitter Card | `<meta name="twitter:image">` |
| Favicon | `favicon.ico`（需额外转换） |

---

## ⚠️ 注意事项

1. **透明度**: 确保PNG有透明背景，否则白色方块会很难看
2. **尺寸**: 至少提供 512x512，推荐 1024x1024
3. **格式**: PNG > JPEG（支持透明）
4. **文件大小**: 压缩到 < 100KB，避免加载慢

---

## 🔧 下一步

上传这个logo后，我会：
1. 调整Schema中的logo URL
2. 更新Open Graph图片引用
3. 生成favicon（ico格式）
4. 推送到GitHub并部署
