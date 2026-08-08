# DreamForge 自定义域名配置

## 当前状态
- 域名: mengjing233.cn
- DNS 服务商: 阿里云万网 (dns7.hichina.com)
- 当前解析: 38.76.217.230 (可能是原服务器)

## 需要做的操作

### 1. 在 Vercel 中添加域名
1. 登录 Vercel: https://vercel.com
2. 进入项目: https://dash.vercel.com/projects/dreamforge/domains
3. 点击 "Add Domain"
4. 输入: `mengjing233.cn`

### 2. 在阿里云 DNS 中添加记录
在阿里云 DNS 控制台添加：

| 类型 | 主机记录 | 解析线路 | 记录值 | TTL |
|------|----------|----------|--------|-----|
| CNAME | @ | 默认 | your-project.vercel.app | 10分钟 |
| CNAME | www | 默认 | your-project.vercel.app | 10分钟 |

或者：
| 类型 | 主机记录 | 解析线路 | 记录值 | TTL |
|------|----------|----------|--------|-----|
| A | @ | 默认 | 76.76.21.37 | 10分钟 |

**注意**: 具体的 Vercel CNAME 目标会在添加域名时显示

### 3. 等待 DNS 生效
- 通常需要 10-30 分钟
- 可以用 `nslookup mengjing233.cn` 检查

## Vercel 验证
Vercel 会自动验证域名所有权，验证通过后会自动分配 SSL 证书。
