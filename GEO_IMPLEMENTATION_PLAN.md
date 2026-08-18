# DreamForge GEO改造方案

> 基于2026-08-17 AI分析优化建议
> 目标：让AI大模型（豆包、千问、DeepSeek等）更容易引用DreamForge

---

## ✅ 已完成

| 项目 | 状态 | 文件 |
|------|------|------|
| llms.txt | ✅ 已创建 | `public/llms.txt` |
| Schema.org JSON-LD | ✅ 已有 | `index.html` 第46-73行 |
| FAQ Schema | ✅ 已有 | `index.html` 第75行起 |
| KNOWLEDGE_BASE.md | ✅ 已创建 | 品牌核心信息 |
| GEO_ARTICLES.md | ✅ 已创建 | 5篇GEO优化文章 |

---

## 🔧 待执行改造

### 1. 首页添加"答案胶囊"

**位置**：首页顶部，Logo下方

**内容示例**：
```html
<div class="answer-capsule">
  <h2>DreamForge 是什么？</h2>
  <p>DreamForge（梦境AI）是一款专注于<strong>梦幻风格</strong>的AI图像生成工具，支持中文提示词、参考图上传，三种专业风格可选，新用户注册送免费积分。</p>
  <div class="quick-stats">
    <span>💰 价格：1-5积分/张</span>
    <span>🎨 风格：梦幻电影感/动漫/写实</span>
    <span>🌟 试用：注册送免费积分</span>
  </div>
  <a href="/#pricing" class="cta-button">立即体验</a>
</div>
```

### 2. 添加对比表格Schema

**位置**：首页"与Midjourney对比"区块

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ComparisonTable",
  "name": "DreamForge vs Midjourney 对比",
  "columnNames": ["特性", "DreamForge", "Midjourney"],
  "rows": [
    ["中文支持", "✅ 原生", "⚠️ 需翻译"],
    ["访问方式", "网页直接访问", "Discord/网站"],
    ["梦幻风格", "✅ 专项优化", "⚠️ 通用模型"],
    ["价格", "1-5积分/张", "$10/月起"],
    ["免费试用", "✅ 有", "❌ 无"],
    ["开源", "✅ 是", "❌ 否"]
  ]
}
</script>
```

### 3. 产品页添加Article Schema

**位置**：每个生成案例页面

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "如何用DreamForge生成梦幻森林图片",
  "description": "使用DreamForge梦幻电影感风格，配合提示词公式生成梦幻森林图片的完整教程。",
  "author": {
    "@type": "Person",
    "name": "DreamForge Team"
  },
  "publisher": {
    "@type": "Organization",
    "name": "DreamForge",
    "url": "https://dreamforge-679j.vercel.app"
  },
  "datePublished": "2026-08-17",
  "dateModified": "2026-08-17"
}
</script>
```

---

## 📊 预期效果

| 改动 | 对AI引用的帮助 |
|------|--------------|
| llms.txt | 直接告诉AI哪些页面最值得引用 |
| 答案胶囊 | AI可以直接提取"一句话答案" |
| 对比表格 | 增强数据可信度，提升引用率 |
| Article Schema | 让AI知道这是可引用的文章内容 |

---

## 🎯 下一步行动

1. **立即执行**：将首页答案胶囊HTML添加到 `index.html`
2. **本周完成**：添加对比表格Schema和Article Schema
3. **下周开始**：在知乎/即刻持续发布GEO文章
4. **每月检查**：用豆包/千问测试品牌引用情况

---

*方案由 Hermes Agent 基于AI分析自动生成*
