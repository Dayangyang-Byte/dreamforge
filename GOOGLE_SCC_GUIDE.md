# DreamForge Google Search Console 提交指南

## 🎯 目标
让 Google 开始收录 dreamforge-679j.vercel.app

---

## 📋 步骤

### 1. 添加属性
1. 打开 https://search.google.com/search-console
2. 点击 **"添加属性"**
3. 选择 **"网址前缀"**（不需要域名验证）
4. 输入：`https://dreamforge-679j.vercel.app`
5. 点击 **"继续"**

### 2. 验证所有权
**方法A：HTML 标签验证（推荐）**
1. 下载验证文件：`googlexxxxxxxxxxxx.html`
2. 上传到项目根目录 `public/`
3. 重新部署到 Vercel
4. 点击 **"验证"**

**方法B：HTML 标签（快速）**
1. 复制验证代码：`<meta name="googlebot" content="googlexxxxxxxxxxxx">`
2. 添加到 `index.html` 的 `<head>` 中
3. 重新部署
4. 点击 **"验证"**

### 3. 提交 Sitemap
验证通过后：
1. 左侧菜单 → **"Sitemaps"**
2. 输入：`/sitemap.xml`
3. 点击 **"提交"**

---

## ⏰ 预期效果
- 提交后 24-48 小时开始收录
- 1-2 周后可以看到索引状态
- 后续可监控搜索表现

---

*创建时间：2026-08-13*
