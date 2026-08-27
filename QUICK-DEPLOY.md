# 提示词库部署指南

> 快速部署DreamForge AI提示词库功能

---

## 📦 已生成的文件

```
D:/Claude Code 视频项目/image-gen-studio/
├── gpt-image2-prompts.html    # 提示词库主页面（16个模板）
├── index.html                 # 已添加入口按钮
└── DEPLOY-CHECKLIST.md        # 验证清单
```

---

## 🚀 部署步骤

### Step 1: 提交代码到GitHub

```bash
cd "D:/Claude Code 视频项目/image-gen-studio"
git add gpt-image2-prompts.html index.html
git commit -m "feat: 添加提示词库功能"
git push origin master
```

### Step 2: Vercel自动部署

- 推送后Vercel会自动构建和部署
- 等待约2分钟

### Step 3: 验证部署

访问以下地址：
- 首页: `https://mengjing233.cn/`
- 提示词库: `https://mengjing233.cn/gpt-image2-prompts.html`

---

## ✨ 功能说明

### 提示词库页面
- 16个精选模板
- 8个分类（电商产品、人物肖像、风景建筑、Logo设计、角色设计、艺术创作、社交媒体、营销海报）
- 点击卡片查看提示词详情
- 一键复制提示词
- 一键跳转到主页使用

### 入口按钮
- 固定在首页右下角
- 紫色渐变背景
- 悬停有动效
- 3秒后显示脉冲动画

---

## 🔧 如需撤回

删除以下文件即可：
```bash
rm gpt-image2-prompts.html
# 并删除index.html中的按钮代码
```

---

*创建时间：2026-08-27*
