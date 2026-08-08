# DreamForge Vercel 域名配置 - 正确步骤

## 正确的 Vercel 项目页面
```
https://vercel.com/Dayangyang-Byte/dreamforge
```

## 添加域名的步骤

### 1. 打开正确的项目页面
在浏览器中访问：
```
https://vercel.com/Dayangyang-Byte/dreamforge
```

### 2. 找到 "Domains" 设置
- 在左侧菜单点击 **"Settings"**
- 然后点击 **"Domains"**
- 或直接访问：`https://vercel.com/Dayangyang-Byte/dreamforge/settings/domains`

### 3. 添加子域名
1. 点击 **"Add Domain"** 按钮
2. 输入：`app.mengjing233.cn`
3. 点击 **"Add"**

### 4. 在阿里云添加 DNS 记录
登录阿里云 DNS 控制台：
```
https://dns.console.aliyun.com/
```

添加记录：
| 类型 | 主机记录 | 记录值 | TTL |
|------|----------|--------|-----|
| CNAME | app | dreamforge-679j.vercel.app | 10分钟 |

## 备选方案

如果 Vercel 域名配置仍然有问题，可以考虑：
1. 使用子域名 `app.mengjing233.cn`
2. 或者直接访问 `https://dreamforge-679j.vercel.app`
