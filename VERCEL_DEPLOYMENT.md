# DreamForge Vercel 部署指南

## 当前状态

- **GitHub 仓库**: https://github.com/Dayangyang-Byte/dreamforge
- **Vercel 部署**: https://dreamforge-679j.vercel.app
- **自定义域名**: mengjing233.cn（待配置）

## 已完成

1. ✅ GitHub 仓库创建
2. ✅ SEO 优化（sitemap.xml, robots.txt, Schema）
3. ✅ Vercel 部署配置
4. ✅ Vercel 部署成功

## 待完成

1. 配置子域名 app.mengjing233.cn 到 Vercel
2. 提交 Sitemap 到 Google Search Console
3. 开始 Reddit 推广

## 下一步操作

### 1. 在 Vercel 添加子域名
1. 访问 https://dash.vercel.com/projects/dreamforge/domains
2. 点击 "Add Domain"
3. 输入: `app.mengjing233.cn`
4. 点击 "Add"

### 2. 在阿里云 DNS 添加记录
1. 访问 https://dns.console.aliyun.com/
2. 找到 mengjing233.cn
3. 添加 CNAME 记录:
   - 类型: CNAME
   - 主机记录: app
   - 记录值: dreamforge-679j.vercel.app
   - TTL: 10分钟

### 3. 等待 DNS 生效
- 通常 10-30 分钟
- 在 Vercel 中点击 "Refresh" 验证

## 项目信息

- 本地代码: D:/Claude Code 视频项目/image-gen-studio
- SSH 密钥: ~/.ssh/dreamforge_ed25519
- 邮箱: yangdahai72@gmail.com
- GitHub: Dayangyang-Byte
