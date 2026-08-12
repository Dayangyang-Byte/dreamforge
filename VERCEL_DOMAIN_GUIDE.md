# DreamForge Vercel 域名配置指南

## 当前状态
- Vercel 部署：https://dreamforge-679j.vercel.app ✅
- GitHub 仓库：https://github.com/Dayangyang-Byte/dreamforge ✅
- 主域名 mengjing233.cn：已添加到 Vercel（DNS 冲突待解决）

## 问题
之前的截图显示：
- dreamforge-679j.vercel.app ✅ Valid
- mengjing233.cn ❌ Invalid
- www.mengjing233.cn ❌ Invalid

## 解决方案

### 方案 A：使用子域名 app.mengjing233.cn
（不会修改现有主域名 DNS）

1. 在 Vercel 中添加子域名
   - 访问：https://dashboard.vercel.com/dreamforge/domains
   - 或：https://vercel.com/dreamforge/settings/domains

2. 点击 "Add Domain"
3. 输入：`app.mengjing233.cn`
4. 在阿里云 DNS 添加：
   - 类型: CNAME
   - 主机记录: app
   - 记录值: dreamforge-679j.vercel.app

### 方案 B：迁移主域名到 Vercel
（需要修改 DNS）

1. 在 Vercel 中管理 mengjing233.cn 的 DNS
2. 删除旧记录，添加：
   - A 记录: @ → 216.198.79.1
   - CNAME 记录: www → e1b30440d3bae544.vercel-dns-017.com

### 方案 C：直接使用 Vercel 默认域名
- https://dreamforge-679j.vercel.app

## 建议
使用方案 A（子域名），最安全，不影响现有网站。
