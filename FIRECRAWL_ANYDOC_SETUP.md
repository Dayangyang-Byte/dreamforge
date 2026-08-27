# Firecrawl anydoc 安装完成

---

## ✅ 已安装

**Skill名称**: `convert-documents-to-markdown`  
**安装位置**: `~/.agents/skills/convert-documents-to-markdown/`  
**兼容性**: Claude Code / Codex / Hermes Agent / Trae CN

---

## 🚀 使用方法

### 基础命令

```bash
# 转换并输出到终端
npx -y @firecrawl/anydoc file.docx

# 保存到文件
npx -y @firecrawl/anydoc file.docx -o output.md

# 读取stdin
echo "data" | npx -y @firecrawl/anydoc - --format csv
```

### 支持的格式

| 格式 | 扩展名 |
|------|--------|
| Word | .doc, .docx, .docm |
| PowerPoint | .ppt, .pptx, .pps, .pot, .pptm, .ppsx, .ppsm |
| Excel | .xls, .xlsx, .xlsm, .xlsb |
| OpenDocument | .odt, .ods, .odp |
| 其他 | .rtf, .epub, .csv, .pdf |

---

## 💡 DreamForge 应用示例

### 1️⃣ 竞品分析
```bash
# 转换Midjourney用户手册
npx -y @firecrawl/anydoc midjourney_manual.pdf -o /tmp/mj.md
# 然后让Agent分析内容
```

### 2️⃣ 行业报告入库
```bash
# 批量转换PDF报告
for f in reports/*.pdf; do
  npx -y @firecrawl/anydoc "$f" -o "knowledge/$f.md"
done
```

### 3️⃣ 知识库建设
```bash
# 把老格式文档转成Markdown
npx -y @firecrawl/anydoc old_product_spec.doc -o knowledge/product.md
```

---

## ⚠️ 已知限制

| 限制 | 解决方案 |
|------|----------|
| 扫描件PDF（图片）读不出 | 用Firecrawl托管API + OCR |
| 加密/密码保护文档 | 不支持，要求用户提供明文版 |
| 超大文档 | 用 `-o` 写到文件，分批读取 |

---

## 🔗 官方资源

- **GitHub**: https://github.com/firecrawl/anydoc
- **NPM**: https://www.npmjs.com/package/@firecrawl/anydoc
- **PyPI**: https://pypi.org/project/firecrawl-anydoc/

---

*安装时间: 2026-08-25*  
*当前状态: ✅ 可用*
