# DreamForge GEO切换完成报告

> 日期：2026-08-18
> 状态：等待用户执行

---

## ✅ 已完成的准备工作

### 代码修改（已推送到GitHub）
| 文件 | 修改内容 | 状态 |
|------|---------|------|
| `public/sitemap.xml` | URL改为mengjing233.cn域名 | ✅ 已推送 |
| `public/llms.txt` | 创建GEO优化文件 | ✅ 已推送 |
| `vercel.json` | 添加llms.txt路由 + 301重定向 | ✅ 已推送 |
| `index.html` | canonical标签改为主域 | ✅ 已推送 |
| `public/en/faq.html` | canonical标签改为主域 | ✅ 已推送 |
| `public/en/prompts.html` | canonical标签改为主域 | ✅ 已推送 |

### 文档准备
| 文件 | 用途 |
|------|------|
| `GEO_SWITCH_PLAN_A.md` | 完整切换执行手册 |
| `GEO_TECHNICAL_FIX.md` | 技术修复方案 |
| `GEO_FIX_NEED_INFO.md` | 需要用户确认的信息 |

---

## 🔴 需要你执行的步骤

### Step 1: Vercel配置（10分钟）
1. 登录 https://vercel.com/Dayangyang-Byte/dreamforge/settings/domains
2. 添加域名：`mengjing233.cn` 和 `www.mengjing233.cn`
3. 记录Vercel提示的DNS记录要求

### Step 2: 阿里云DNS配置（10分钟）
1. 登录阿里云DNS管理面板
2. **先新增** `api.mengjing233.cn` → A记录 → 38.76.217.230
3. **再修改** `mengjing233.cn` → 改为Vercel要求的CNAME或A记录
4. **新增** `www.mengjing233.cn` → CNAME → cname.vercel-dns.com

### Step 3: 香港服务器nginx配置（15分钟）
```bash
# SSH登录香港服务器
sudo nano /etc/nginx/sites-available/default

# 修改为只监听 api.mengjing233.cn
server {
    listen 80;
    server_name api.mengjing233.cn;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 4: Express CORS配置（15分钟）
```javascript
// 在Express启动文件中添加
const cors = require('cors');
app.use(cors({
  origin: ['https://mengjing233.cn', 'https://www.mengjing233.cn'],
  credentials: true
}));
```

### Step 5: 前端API地址修改（15分钟）
```javascript
// 找到前端代码中的API请求地址
// 改成：
const API_BASE = 'https://api.mengjing233.cn';
```

### Step 6: 验证（20分钟）
```bash
curl https://mengjing233.cn/sitemap.xml
curl https://mengjing233.cn/llms.txt
curl https://mengjing233.cn/en/faq
curl -I https://mengjing233.cn/llms.txt
```

---

## ⚠️ 注意事项

### 1. 切换顺序（重要！）
```
正确顺序：
第一步：验证 api.mengjing233.cn 解析成功
第二步：修改主域 DNS 指向 Vercel
第三步：等待 DNS 传播（5-30分钟）
第四步：验证网站正常访问

错误顺序会导致API中断！
```

### 2. API跨域问题
- ✅ Express需配置CORS白名单
- ✅ 前端API地址改为 `https://api.mengjing233.cn`
- ✅ 微信支付回调地址如适用需同步修改

### 3. Vercel国内访问稳定性
- 上线后在国内实测几天
- 如不稳定，加Cloudflare免费版代理
- 再不稳定才考虑备案+国内CDN

---

## 📊 预期效果

| 检查项 | 切换前 | 切换后 |
|--------|--------|--------|
| sitemap.xml域名 | vercel.app ❌ | mengjing233.cn ✅ |
| llms.txt内容 | HTML ❌ | 纯文本 ✅ |
| /en/faq内容 | 空壳 ❌ | 完整内容 ✅ |
| 301重定向 | 无 ❌ | 有 ✅ |
| canonical标签 | vercel.app ❌ | mengjing233.cn ✅ |

---

## 🎯 下一步行动

**请选择**：
1. **我现在执行** — 你需要我逐步指导
2. **稍后执行** — 我先保存这个计划
3. **有问题** — 告诉我具体疑问

**文件位置**：
- 完整执行手册：`GEO_SWITCH_PLAN_A.md`
- GitHub已推送，可随时查看
