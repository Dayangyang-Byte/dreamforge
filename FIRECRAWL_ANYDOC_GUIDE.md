# Firecrawl anydoc 使用指南

---

## ✅ 安装状态

**版本**: 0.2.3  
**Skill**: convert-documents-to-markdown  
**状态**: ✅ 已安装并可用

---

## 🚀 使用方法

### 命令格式
```bash
npx -y @firecrawl/anydoc <文件路径> [选项]
```

### 支持的文件格式
| 类型 | 扩展名 |
|------|--------|
| Word | .doc, .docx, .docm |
| Excel | .xls, .xlsx, .xlsm |
| PowerPoint | .ppt, .pptx, .pps |
| PDF | .pdf (文本型，非扫描件) |
| 电子书 | .epub |
| 其他 | .rtf, .odt, .ods, .odp, .csv |

---

## 💡 DreamForge 应用场景

### 1️⃣ 批量转换竞品文档
```bash
# 转换Midjourney官方文档
npx -y @firecrawl/anydoc midjourney_guide.pdf -o /tmp/mj.md

# 读取结果
cat /tmp/mj.md
```

### 2️⃣ 行业报告入库
```bash
# 批量转换PDF
for f in ~/Downloads/reports/*.pdf; do
  npx -y @firecrawl/anydoc "$f" -o "knowledge/$(basename $f .pdf).md"
done
```

### 3️⃣ 老格式文档升级
```bash
# .doc → Markdown（保留表格格式）
npx -y @firecrawl/anydoc old_spec.doc -o spec.md
```

---

## ⚠️ 限制说明

| 情况 | 结果 | 解决方案 |
|------|------|----------|
| 扫描件PDF（图片） | ❌ 不支持 | 用Firecrawl托管API + OCR |
| 加密文档 | ❌ 报错 | 联系作者获取明文版 |
| 空文档 | ❌ 报错 | 检查文件是否有效 |

---

## 🔗 官方链接

- **GitHub**: https://github.com/firecrawl/anydoc
- **NPM**: https://www.npmjs.com/package/@firecrawl/anydoc
- **在线试用**: https://firecrawl.dev/anydoc (需登录)

---

*安装时间: 2026-08-25*
