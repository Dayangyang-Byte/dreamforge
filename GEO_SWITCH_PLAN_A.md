# DreamForge GEO 切换方案A - 执行手册

> 基于2026-08-18诊断结果 + AI分析建议
> 目标：前端直连Vercel，API保留香港服务器，修复所有P0技术漏洞

---

## ✅ 切换前准备

### 检查清单
- [ ] GitHub仓库是最新版本（包含llms.txt、更新后的sitemap、canonical标签）
- [ ] Vercel项目已连接GitHub，开启自动部署
- [ ] 确认生图API运行在香港服务器（38.76.217.230）
- [ ] 备份当前nginx配置

---

## 📋 Step 1: Vercel侧配置

### 1.1 添加自定义域名
1. 登录 https://vercel.com/Dayangyang-Byte/dreamforge/settings/domains
2. 点击 "Add" 添加域名：
   - `mengjing233.cn`
   - `www.mengjing233.cn`

### 1.2 记录DNS要求
Vercel会提示需要的DNS记录，通常是：
```
mengjing233.cn → CNAME → cname.vercel-dns.com
www.mengjing233.cn → CNAME → cname.vercel-dns.com
```
或A记录：
```
mengjing233.cn → A记录 → 76.76.21.21
www.mengjing233.cn → A记录 → 76.76.21.21
```

---

## 📋 Step 2: 阿里云DNS配置

### 2.1 修改主域记录（关键！根域用A记录）
**当前**（需要删除）：
```
类型: A
名称: @
值: 38.76.217.230
TTL: 10分钟
```

**改为**（Vercel官方推荐）：
```
类型: A
名称: @
值: 76.76.21.21
TTL: 10分钟
```

> ⚠️ **注意**：根域（裸域）不要用CNAME，会导致MX等记录失效。必须用A记录指向Vercel的Anycast IP `76.76.21.21`

### 2.2 新增www记录
```
类型: CNAME
名称: www
值: cname.vercel-dns.com
TTL: 10分钟
```

### 2.3 新增api子域（关键！）
**先做这步，再切主域**：
```
类型: A
名称: api
值: 38.76.217.230
TTL: 10分钟
```

---

## 📋 Step 3: 香港服务器nginx配置

### 3.1 修改nginx配置
```bash
# SSH登录香港服务器后执行
sudo nano /etc/nginx/sites-available/default
```

**修改为只监听api子域**：
```nginx
server {
    listen 80;
    server_name api.mengjing233.cn;

    # 静态文件代理（如果需要）
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3.2 重载nginx
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 3.3 申请SSL证书（关键！）
**API子域必须HTTPS，否则浏览器会拦截Mixed Content**：

```bash
# 安装certbot（如未安装）
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# 为api子域申请证书
sudo certbot --nginx -d api.mengjing233.cn

# 按提示输入邮箱、同意条款，选择是否重定向HTTP→HTTPS（选是）

# 验证证书状态
sudo certbot certificates
```

> ⚠️ **注意**：这是计划中最容易遗漏的步骤！没有HTTPS证书会导致：
> - 浏览器报 "Mixed Content" 错误
> - API请求被拦截
> - CORS配置即使正确也无效
> - 排查时误以为是CORS问题

---

## 📋 Step 4: Express CORS配置

### 4.1 修改Express代码
```javascript
// 在 Express 启动文件中添加
const cors = require('cors');

app.use(cors({
  origin: ['https://mengjing233.cn', 'https://www.mengjing233.cn'],
  credentials: true
}));

// 或者手动设置响应头
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://mengjing233.cn');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});
```

### 4.2 修改前端API地址
```javascript
// 找到前端代码中的API请求地址
// 改成：
const API_BASE = 'https://api.mengjing233.cn';
```

---

## 📋 Step 5: 切换DNS

### 5.1 切换顺序（重要！）
```
第一步：验证 api.mengjing233.cn 解析成功
第二步：修改主域 DNS 指向 Vercel
第三步：等待 DNS 传播（通常 5-30 分钟）
第四步：验证网站正常访问
```

### 5.2 验证api子域
```bash
# 在本地执行
nslookup api.mengjing233.cn
# 应该返回 38.76.217.230

curl -I https://api.mengjing233.cn/api/health
# 应该返回 API 健康检查响应
```

### 5.3 切换主域
在阿里云DNS管理面板，把主域A记录从38.76.217.230改为Vercel要求的记录。

---

## 📋 Step 6: 验证清单

### 6.1 立即验证
```bash
# 1. sitemap.xml
curl https://mengjing233.cn/sitemap.xml
# 预期：显示mengjing233.cn域名

# 2. llms.txt（应该是纯文本）
curl -I https://mengjing233.cn/llms.txt
# 预期：Content-Type: text/plain

curl https://mengjing233.cn/llms.txt
# 预期：显示纯文本内容

# 3. FAQ页
curl https://mengjing233.cn/en/faq
# 预期：包含完整FAQ内容，不是SPA壳

# 4. 301重定向（可选，等Vercel配置完成）
curl -I https://dreamforge-679j.vercel.app/
# 预期：301重定向到 mengjing233.cn

# 5. canonical标签
curl https://mengjing233.cn/ | grep canonical
# 预期：<link rel="canonical" href="https://mengjing233.cn/" />
```

### 6.2 API验证
```bash
# API是否正常
curl https://api.mengjing233.cn/api/health
# 预期：健康检查响应

# 跨域是否配置正确
curl -H "Origin: https://mengjing233.cn" -I https://api.mengjing233.cn/api/
# 预期：Access-Control-Allow-Origin: https://mengjing233.cn
```

---

## ⚠️ 两个坑的预防措施

### 坑1: API跨域（CORS）
- ✅ Express已配置白名单允许 `https://mengjing233.cn`
- ✅ 前端代码中API地址已改为 `https://api.mengjing233.cn`（注意HTTPS！）
- ✅ api子域已申请SSL证书（certbot）
- ✅ 微信支付回调地址已同步修改（如适用）

### 坑2: Vercel国内访问稳定性
- ⚠️ 上线后在国内实测几天
- 如果不稳定，加Cloudflare免费版代理：
  ```
  阿里云DNS: mengjing233.cn → CNAME → xxx.cname.cloudflare.com
  Cloudflare: 代理模式开启
  ```
- 再不稳定才考虑备案+国内CDN

---

## 🔄 回滚方案

如果切换后出现问题，立即回滚：
```bash
# 阿里云DNS改回原记录
mengjing233.cn → A记录 → 38.76.217.230
```

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

## 🎯 执行时间预估

| 步骤 | 预计时间 |
|------|---------|
| Step 1: Vercel配置 | 10分钟 |
| Step 2: 阿里云DNS | 10分钟 |
| Step 3: nginx配置 | 15分钟 |
| Step 3.3: SSL证书申请 | 10分钟 |
| Step 4: Express CORS | 15分钟 |
| Step 5: 前端API地址修改 | 15分钟 |
| Step 6: 验证 | 20分钟 |
| **总计** | **约1.5小时** |

---

*执行手册由 Hermes Agent 基于2026-08-18 AI分析整理*
