# DreamForge GEO 切换操作清单

> 你的任务，按顺序执行

---

## ✅ 你已完成的（服务器侧）

- [x] SSH密钥登录已配置
- [x] nginx api子域反代已配置
- [x] certbot SSL证书已申请
- [x] API健康检查正常

---

## 📋 接下来你需要做的（控制台操作）

### Step 1: Vercel配置（约10分钟）

#### 1.1 添加域名
1. 打开 https://vercel.com/Dayangyang-Byte/dreamforge/settings/domains
2. 点击 "Add" → 输入 `mengjing233.cn`
3. 如需添加www，输入 `www.mengjing233.cn`
4. 会显示"Invalid Configuration" — 这是正常的，DNS还没切

#### 1.2 添加环境变量
1. 左侧菜单 → "Environment Variables"
2. 添加：
   ```
   Key:   VITE_API_BASE
   Value: https://api.mengjing233.cn
   Environments: Production
   ```
3. 点击 "Save"

#### 1.3 重新部署（重要！）
1. 顶部菜单 → "Deployments"
2. 找到最新一条 → 右侧点 `⋯` → "Redeploy"
3. 等待状态变绿（Ready）

---

### Step 2: 阿里云DNS切换（约5分钟）

#### 2.1 修改主域记录
1. 打开 https://dns.console.aliyun.com/
2. 找到 `mengjing233.cn` → 点击"解析设置"
3. 找到 `@` 那一行 → 点"修改"
4. 记录值改为：`76.76.21.21`
5. 确认保存

#### 2.2 修改www记录
1. 找到 `www` 那一行 → 点"修改"
2. 记录类型：`A` → 改成 `CNAME`
3. 记录值：`cname.vercel-dns.com`
4. 确认保存

> 如果系统不允许修改类型，先删除www记录，再新建CNAME记录

#### 2.3 别动api记录
```
api → A → 38.76.217.230（保持原样）
```

---

### Step 3: 验证（完成后告诉我）

DNS切换后等待2-5分钟传播，然后运行验收脚本：

```bash
# 在你的电脑上执行
cd "D:\Claude Code 视频项目\image-gen-studio"
bash verify-geo-switch.sh
```

或者直接访问：
- https://mengjing233.cn/sitemap.xml → 应显示mengjing233.cn域名
- https://mengjing233.cn/llms.txt → 应显示纯文本
- https://mengjing233.cn/en/faq → 应有完整内容

---

## ⚠️ 注意事项

1. **切换顺序很重要**：Vercel配置 → DNS切换，不要反过来
2. **API地址已改**：前端代码中的API现在指向 `https://api.mengjing233.cn`
3. **微信支付回调**：切换后测试一笔1元充值，确认回调正常

---

**完成第1、2步后，告诉我，我来跑验收。**
