# DreamForge GEO 切换完成报告

> 日期：2026-08-18
> 状态：接近完成，需最后一步推送

---

## ✅ 已完成的验收项（6/7）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 主域 DNS → Vercel | ✅ | 76.76.21.21 |
| 主域落地 | ✅ | 308 → www → 200 |
| sitemap.xml | ✅ | 品牌域名URL |
| llms.txt | ✅ | text/plain |
| /en/faq | ✅ | 真内容 |
| canonical | ✅ | mengjing233.cn |
| **vercel.app 301** | ⏳ | 需推送代码后验证 |

---

## 🔧 当前待处理：vercel.json 修复

**问题**：原配置中 `redirects` 和 `rewrites` 冲突，Vercel 忽略 redirects

**解决方案**：简化 vercel.json，Vercel 会自动伺服静态文件

### 需要你做的操作

#### 方案A：直接在GitHub编辑（推荐）
1. 打开 https://github.com/Dayangyang-Byte/dreamforge/edit/master/vercel.json
2. 把内容替换为：
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1" }
  ]
}
```
3. 点 "Commit changes" → "Commit"
4. Vercel会自动部署

#### 方案B：本地git push
```bash
cd "D:\Claude Code 视频项目\image-gen-studio"
git pull
# 编辑 vercel.json
git add vercel.json
git commit -m "fix: simplify vercel.json for proper SPA routing"
git push
```

---

## 📋 推送后的验证清单

推送成功后，等待1-2分钟（Vercel自动部署），然后：

### 1. 验证301重定向
```bash
curl -sI https://dreamforge-679j.vercel.app/
# 预期：HTTP/1.1 301 + Location: https://mengjing233.cn/
```

### 2. 验证sitemap
```bash
curl https://mengjing233.cn/sitemap.xml
# 预期：所有URL都是mengjing233.cn
```

### 3. 验证llms.txt
```bash
curl -sI https://mengjing233.cn/llms.txt
# 预期：Content-Type: text/plain
```

---

## ⚠️ 还需确认的事项

### 1. 微信支付回调测试
- 充值1元，确认回调地址正确
- 回调地址应该是：`https://api.mengjing233.cn/api/payment/wechat/callback`

### 2. 国内访问速度
- 在中国大陆测试网站打开速度
- 如 <3秒：正常
- 如 >5秒：考虑加Cloudflare代理

### 3. 服务器安全
- 修改root密码：`ssh root@38.76.217.230` → `passwd`

---

## 🎯 下一步：内容推广

技术基础设施已就绪，可以全力跑内容推广计划：

1. **知乎** - 发布2个回答
2. **即刻** - 发布5条动态
3. **小红书** - 发布3篇笔记
4. **Product Hunt** - 准备素材，周二/三上线
5. **Reddit** - r/StableDiffusion、r/AIArtwork发帖

---

**完成后告诉我，我跑最终验收。**
