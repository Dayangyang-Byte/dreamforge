# DreamForge GEO 技术修复方案

> 基于2026-08-18另一个AI的分析
> 目标：修复三个P0级技术漏洞，确保AI爬虫能正确抓取内容

---

## 🔴 问题1：Sitemap指向错误域名

### 现状
`public/sitemap.xml` 所有内容URL都是 `dreamforge-679j.vercel.app`

### 修复
将sitemap改为mengjing233.cn域名，并添加canonical标签

---

## 🔴 问题2：llms.txt未正确伺服

### 现状
- 文件在 `public/llms.txt`
- 但可能被SPA路由拦截，返回HTML而非纯文本

### 修复
需要在vercel.json中显式声明llms.txt路由

---

## 🔴 问题3：品牌域名FAQ页空壳

### 现状
- `dreamforge-679j.vercel.app/en/faq` 内容正常
- `mengjing233.cn/en/faq` 可能返回SPA壳

### 修复
需要确认部署架构，添加301重定向和canonical

---

## ✅ 修复步骤

### Step 1: 更新sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mengjing233.cn/</loc>
    <lastmod>2026-08-18</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://mengjing233.cn/en</loc>
    <lastmod>2026-08-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mengjing233.cn/en/faq</loc>
    <lastmod>2026-08-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mengjing233.cn/en/prompts</loc>
    <lastmod>2026-08-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### Step 2: 更新vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install",
  "redirects": [
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "dreamforge-679j.vercel.app" }],
      "destination": "https://mengjing233.cn/$1",
      "permanent": true
    }
  ],
  "routes": [
    { "src": "/google54e02f34814caa86.html", "dest": "/google54e02f34814caa86.html" },
    { "src": "/robots.txt", "dest": "/robots.txt" },
    { "src": "/sitemap.xml", "dest": "/sitemap.xml" },
    { "src": "/llms.txt", "dest": "/llms.txt" },
    { "src": "/assets/(.*)", "dest": "/assets/$1" },
    { "src": "/en/faq", "dest": "/en/faq.html" },
    { "src": "/en/prompts", "dest": "/en/prompts.html" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Step 3: 添加canonical标签

在 `index.html` 的 `<head>` 部分添加：

```html
<link rel="canonical" href="https://mengjing233.cn/" />
```

在 `/en/faq.html` 的 `<head>` 部分添加：

```html
<link rel="canonical" href="https://mengjing233.cn/en/faq" />
```

在 `/en/prompts.html` 的 `<head>` 部分添加：

```html
<link rel="canonical" href="https://mengjing233.cn/en/prompts" />
```

---

## ✅ 验收清单

修复后验证以下项目：

- [ ] `curl https://mengjing233.cn/sitemap.xml` 显示mengjing233.cn域名
- [ ] `curl -I https://mengjing233.cn/llms.txt` 返回 `Content-Type: text/plain`
- [ ] `curl -I https://dreamforge-679j.vercel.app` 返回 301 重定向到 mengjing233.cn
- [ ] `curl https://mengjing233.cn/en/faq` 显示FAQ完整内容（不是SPA壳）
- [ ] 每页源码中有 `<link rel="canonical" href="https://mengjing233.cn/...">`
- [ ] Google Search Console 重新提交sitemap

---

## 📝 执行计划

| 优先级 | 任务 | 预计时间 | 状态 |
|--------|------|---------|------|
| P0 | 更新 sitemap.xml | 5分钟 | ⏳ |
| P0 | 更新 vercel.json 添加 llms.txt 路由 | 5分钟 | ⏳ |
| P0 | 更新 vercel.json 添加 301 重定向 | 5分钟 | ⏳ |
| P0 | 添加 canonical 标签到各页面 | 10分钟 | ⏳ |
| P1 | 测试验证 | 10分钟 | ⏳ |

---

*方案由 Hermes Agent 基于2026-08-18 AI分析整理*
