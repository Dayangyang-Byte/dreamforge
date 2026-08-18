# DreamForge GEO技术修复 - 需要用户确认的信息

> 基于2026-08-18诊断结果
> 目标：让用户提供香港服务器配置信息，以便给出精确修复方案

---

## 🔴 已确认的问题

1. **mengjing233.cn 指向香港服务器**（IP: 38.76.217.230）
2. **香港服务器使用 nginx + Express 伺服前端**
3. **GitHub 修改未同步到香港服务器**
4. **旧版本sitemap、llms.txt、FAQ页均为空壳**

---

## 📋 需要你提供的信息

### 1. DNS配置
**问题**：mengjing233.cn 的 DNS 记录在哪里管理的？
- [ ] 阿里云万网
- [ ] Cloudflare
- [ ] 其他

**当前A记录**：指向 38.76.217.230（香港服务器）

---

### 2. 香港服务器配置
**问题**：请提供以下信息：

#### a) Nginx配置
```bash
# 在你的香港服务器上执行：
cat /etc/nginx/sites-available/default
# 或
cat /etc/nginx/conf.d/default.conf
```

#### b) Express代码（伺服静态文件的部份）
```bash
# 查找express启动文件
find /home -name "server.js" -o -name "index.js" 2>/dev/null | grep -v node_modules | head -5

# 查看伺服静态文件的代码
grep -r "express.static" /home/your-app/ 2>/dev/null
```

#### c) 部署流程
```bash
# 查看是否有定时任务同步代码
crontab -l

# 查看是否有部署脚本
ls -la /home/your-app/*.sh 2>/dev/null

# 查看pm2配置
pm2 describe image-gen-studio 2>/dev/null || pm2 list
```

---

### 3. 文件位置
**问题**：前端静态文件存放在哪个目录？
```bash
# 常见位置
ls -la /home/your-app/dist/
ls -la /var/www/dreamforge/
ls -la /opt/dreamforge/

# 或者
find /home -name "index.html" -path "*/dist/*" 2>/dev/null | head -3
```

---

## 🎯 推荐方案：方案A（前端直连Vercel）

### 优势
- ✅ 以后 GitHub 推送即自动上线
- ✅ 白嫖 Vercel 全球 CDN
- ✅ 不再维护两套系统
- ✅ 修复所有P0问题一次搞定

### 步骤

#### Step 1：Vercel添加自定义域名
1. 登录 https://vercel.com/Dyangyang-Byte/dreamforge/settings/domains
2. 点击 "Add" 添加 `mengjing233.cn`
3. 按提示配置 DNS（需要把A记录改成CNAME）

#### Step 2：修改DNS记录
**阿里云万网/DNS管理面板**：
```
当前：
mengjing233.cn → A记录 → 38.76.217.230（香港服务器）

改为：
mengjing233.cn → CNAME → cname.vercel-dns.com
www.mengjing233.cn → CNAME → cname.vercel-dns.com
```

#### Step 3：保留API子域到香港服务器
```
api.mengjing233.cn → A记录 → 38.76.217.230（香港服务器）
```

#### Step 4：验证
- [ ] `https://mengjing233.cn` → 显示Vercel托管的新版网站
- [ ] `https://mengjing233.cn/sitemap.xml` → 显示mengjing233.cn域名
- [ ] `https://mengjing233.cn/llms.txt` → 显示纯文本
- [ ] `https://api.mengjing233.cn` → 仍指向香港服务器API

---

## 🔄 备选方案：方案B（保持现状，修复香港服务器）

如果你希望保持香港服务器伺服前端，需要：

1. **更新前端构建并部署到香港服务器**
   ```bash
   # 从GitHub拉取最新代码
   cd /path/to/project
   git pull
   
   # 重新构建
   npm run build
   
   # 部署到nginx静态目录
   sudo cp -r dist/* /var/www/dreamforge/
   ```

2. **修改nginx配置**
   ```nginx
   # 添加llms.txt和sitemap.xml的路由规则
   location = /llms.txt {
       proxy_pass http://localhost:3000/llms.txt;
       add_header Content-Type text/plain;
   }
   location = /sitemap.xml {
       proxy_pass http://localhost:3000/sitemap.xml;
       add_header Content-Type application/xml;
   }
   ```

3. **设置自动同步**
   ```bash
   # 添加crontab定时任务
   */5 * * * * cd /path/to/project && git pull && npm run build && sudo cp -r dist/* /var/www/dreamforge/
   ```

---

## ⚠️ 紧急事项

**方案A切换后**，原来的香港服务器只需保留：
- API服务（生图接口）
- 数据库
- 用户认证

**不需要再伺服前端静态文件**

---

## 📞 下一步

**请提供以下信息之一**：

1. **直接执行方案A**：如果你信任我，我可以给你完整的切换步骤
2. **提供香港服务器配置**：把上面的nginx配置、Express代码贴给我
3. **手动部署**：如果你会操作，我告诉你具体命令

---

*诊断由 Hermes Agent 基于2026-08-18 AI分析整理*
