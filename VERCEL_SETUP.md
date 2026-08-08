# DreamForge 部署配置指南

## Vercel 部署步骤

### 1. 注册/登录 Vercel
打开 https://vercel.com/signup
- 使用 GitHub 账号登录（推荐）
- 或使用邮箱注册

### 2. 导入项目
- 点击 "Add New..." → "Project"
- 在 GitHub 中找到 `Dayangyang-Byte/dreamforge`
- 点击 "Import"

### 3. 配置项目
Vercel 会自动检测：
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. 部署
- 点击 "Deploy"
- 等待 1-2 分钟
- 部署完成后获得 Vercel 域名

### 5. 配置自定义域名（可选）
- 在 Vercel Dashboard 添加 `mengjing233.cn`
- 在 DNS 服务商添加 CNAME 记录

## 当前状态

- ✅ GitHub 仓库已创建
- ✅ SEO 优化已添加（sitemap.xml, robots.txt, Schema）
- ✅ Vercel 配置已添加（vercel.json, .vercelignore）
- ⏳ 等待 Vercel 部署

## 下一步

1. 完成 Vercel 部署
2. 配置自定义域名
3. 提交 Sitemap 到 Google Search Console
4. 开始 Reddit 推广
