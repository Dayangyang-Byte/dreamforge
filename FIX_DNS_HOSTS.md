# DreamForge hosts 文件修复指南

## 问题原因
你的 DNS 将 dreamforge-679j.vercel.app 解析到了错误的 IP（Facebook 服务器 162.125.32.13）
正确的 Vercel IP 应该是：216.198.79.67

## 解决方案：修改 hosts 文件

### 步骤 1：以管理员身份打开记事本

1. 点击 Windows 开始菜单
2. 输入 "记事本" 或 "notepad"
3. 右键点击"记事本" → 选择"以管理员身份运行"

### 步骤 2：打开 hosts 文件

1. 在记事本中，点击"文件" → "打开"
2. 在地址栏输入：
   ```
   C:\Windows\System32\drivers\etc
   ```
3. 按回车
4. 在右下角的文件类型下拉菜单中，选择"所有文件 (*.*)"
5. 选择文件 `hosts`，点击"打开"

### 步骤 3：添加 DreamForge 记录

在文件末尾添加以下内容：

```
# DreamForge AI - Fix DNS pollution
216.198.79.67 dreamforge-679j.vercel.app
```

### 步骤 4：保存文件

1. 按 Ctrl + S 保存
2. 关闭记事本

### 步骤 5：刷新 DNS 缓存

1. 右键点击开始菜单 → 选择"终端(管理员)"或"Windows PowerShell(管理员)"
2. 输入命令：
   ```
   ipconfig /flushdns
   ```
3. 看到"已成功刷新 DNS 解析缓存"后关闭窗口

### 步骤 6：测试访问

打开浏览器，访问：
```
https://dreamforge-679j.vercel.app
```

---

## 备用方案：使用 VPN

如果 hosts 文件修改无效，请尝试：
1. 打开 VPN
2. 连接国外节点
3. 清除 DNS 缓存：`ipconfig /flushdns`
4. 重新访问网站

---

## 验证 hosts 是否生效

在终端运行：
```
nslookup dreamforge-679j.vercel.app
```
应该显示解析到 216.198.79.67
