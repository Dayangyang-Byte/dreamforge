# DreamForge Vercel 域名配置 - 完整指南

## 问题诊断
- dreamforge-679j.vercel.app ✅ 已部署
- mengjing233.cn ❌ DNS 冲突
- Vercel 项目页面 404 ❌

## 解决方案

### 步骤 1: 确认 Vercel 项目存在
1. 打开：https://vercel.com/Dayangyang-Byte/dreamforge
2. 如果显示 404，说明项目未导入或需要重新创建

### 步骤 2: 重新导入项目（如果需要）
1. 打开：https://vercel.com/new/project
2. 选择 "Import Git Repository"
3. 找到 dreamforge 仓库
4. 点击 "Import"

### 步骤 3: 添加域名
1. 在项目页面左侧点击 "Settings"
2. 点击 "Domains"
3. 点击 "Add Domain"
4. 输入：app.mengjing233.cn
5. 点击 "Add"

### 步骤 4: 配置阿里云 DNS
1. 打开：https://dns.console.aliyun.com/
2. 找到 mengjing233.cn
3. 添加记录：
   - 类型: CNAME
   - 主机记录: app
   - 记录值: dreamforge-679j.vercel.app
4. TTL: 10分钟

## 备选方案

如果 Vercel 域名配置仍然有问题：
1. 使用子域名：https://app.mengjing233.cn
2. 或直接使用 Vercel 默认域名：https://dreamforge-679j.vercel.app
3. 后续再配置自定义域名

## 当前可用地址
- Vercel: https://dreamforge-679j.vercel.app
- GitHub: https://github.com/Dayangyang-Byte/dreamforge
