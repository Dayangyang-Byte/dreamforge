# DreamForge 网站 Google Analytics 设置指南

## 📋 设置步骤

### 第一步：登录 Google Analytics

1. 打开 https://analytics.google.com/
2. 使用 `yangdahai72@gmail.com` 登录
3. 同意服务条款

---

### 第二步：创建属性

1. 点击右上角 **"管理"**（齿轮图标）
2. 在"账户"列下，点击 **"创建账户"**
3. 填写：
   - 账户名称：`DreamForge`
   - 时区：`中国时区 (UTC+8)`
4. 点击 **"下一步"**

---

### 第三步：配置业务信息

1. 业务名称：`DreamForge 梦境AI`
2. 业务网址：`https://dreamforge-679j.vercel.app`
3. 行业类别：`其他` 或 `在线零售商`
4. 报表时区：`中国时区 (UTC+8)`
5. 货币：`人民币 (CNY)`
6. 点击 **"创建"**

---

### 第四步：获取 Measurement ID

1. 创建完成后，页面会显示 **Measurement ID**
2. 格式类似：`G-XXXXXXXXXX`
3. **复制这个ID**

---

### 第五步：添加代码到网站

将以下代码添加到 `index.html` 的 `<head>` 部分：

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
<!-- End Google Analytics -->
```

---

### 第六步：验证安装

1. 刷新网站 `https://dreamforge-679j.vercel.app`
2. 在 Google Analytics 后台查看 **"实时"** 报告
3. 应该有 1 个活跃用户（你自己）

---

## ✅ 完成！

设置完成后，你可以：
- 查看每日访问量
- 了解用户来源（知乎/即刻/Twitter等）
- 分析用户行为（停留时间、点击等）

---

## 💡 额外建议

### 数据保留策略
- 在 GA 后台 → 管理 → 数据保留 → 设置为 `14个月`

### 创建视图
- 创建"全部网站数据"视图
- 排除你的 IP 地址（避免污染数据）

### 设置目标
- 注册成功
- 积分充值
- 图片生成

---

**完成后告诉我 Measurement ID，我帮你添加到代码中！**
