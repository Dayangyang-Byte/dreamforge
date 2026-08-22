# DreamForge 小红书流量承接 - 技术实现方案

> 更新时间：2026-08-22 13:15

---

## 📊 当前状态

### ✅ 已实现
- 网站正常访问：https://mengjing233.cn
- GA追踪已部署：G-058HWKPRKB
- SEO优化完成：标题/描述含品牌词
- 品牌词落地页组件：`src/Dream.jsx`

### ❌ 待实现
- Vercel路由配置（添加 `/dream` 路由）
- main.jsx 检测UTM参数并跳转
- 小红书个人简介添加链接

---

## 🔧 技术实现步骤

### 步骤1：更新 vercel.json

添加 `/dream` 路由rewrite规则：

```json
{
  "rewrites": [
    { "source": "/generated/(.*)", "destination": "https://api.mengjing233.cn/generated/$1" },
    { "source": "/thumbnails/(.*)", "destination": "https://api.mengjing233.cn/thumbnails/$1" },
    { "source": "/en/faq", "destination": "/en/faq.html" },
    { "source": "/en/prompts", "destination": "/en/prompts.html" },
    { "source": "/dream", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 步骤2：修改 main.jsx

在文件开头添加UTM参数检测和落地页渲染：

```javascript
// 检查是否是小红书品牌词搜索
const urlParams = new URLSearchParams(window.location.search);
const utmSource = urlParams.get('utm_source');
const utmKeyword = urlParams.get('utm_keyword');

if (utmSource === 'xiaohongshu' && utmKeyword === '梦境AI') {
  // 显示品牌落地页
  createRoot(document.getElementById("root")).render(<DreamLanding />);
} else if (window.location.pathname.startsWith("/admin")) {
  createRoot(document.getElementById("root")).render(<AdminApp />);
} else {
  createRoot(document.getElementById("root")).render(<App />);
}
```

### 步骤3：导入DreamLanding组件

在main.jsx顶部添加：
```javascript
import { DreamLanding } from "./Dream";
```

### 步骤4：部署上线

```bash
cd "D:\Claude Code 视频项目\image-gen-studio"
git add .
git commit -m "Add Xiaohongshu traffic landing page"
git push origin master
```

### 步骤5：更新小红书简介

在小红书APP中：
1. 打开"我的" → "设置" → "编辑资料"
2. 在"网站"栏添加带UTM参数的链接：
   ```
   https://mengjing233.cn?utm_source=xiaohongshu&utm_medium=bio&utm_campaign=dreamforge
   ```
3. 在简介中添加引导语：
   ```
   🎨 梦境AI - 梦幻电影感图像生成工具
   🔗 mengjing233.cn
   💎 新用户注册送积分，免费体验！
   ```

---

## 📈 效果追踪

### GA实时报告

发布后检查：
1. **实时 → 来源/媒介**
   - 应该看到 `xiaohongshu / referral` 或 ` organic / (none)`
   
2. **行为 → 落地页**
   - 查看 `/dream?utm_source=xiaohongshu...` 的访问量

3. **转化 → 目标**
   - 检查 sign_up 事件是否增加

### 预期数据

| 指标 | 发布前 | 7天后 | 30天后 |
|------|--------|-------|--------|
| 日UV | 7 | 30+ | 100+ |
| 品牌词搜索 | 0 | 10+ | 30+ |
| 新用户注册 | 0 | 5+ | 20+ |

---

## ⚠️ 注意事项

### 1. UTM参数限制
- 小红书URL长度限制约100字符
- 建议使用简化版：`https://mengjing233.cn?from=xhs`
- 在main.jsx中检测 `?from=xhs` 参数

### 2. GA数据延迟
- 新参数需要24-48小时才能在GA中显示
- 建议发布后第3天再查看数据

### 3. 小红书审核
- 个人简介添加外链可能需要审核
- 如被拒，可改用私信引导用户搜索"梦境AI"

---

## ✅ 执行清单

### 今晚（今晚完成）
- [ ] 更新 vercel.json 添加 `/dream` 路由
- [ ] 修改 main.jsx 添加UTM参数检测
- [ ] 更新小红书个人简介添加链接
- [ ] 在已发布笔记评论区添加引导

### 本周（本周内完成）
- [ ] 提交代码到GitHub
- [ ] 部署到Vercel
- [ ] 测试 `/dream` 路由是否正常
- [ ] 测试UTM参数是否正确追踪
- [ ] 检查GA数据变化

---

## 💡 额外建议

### 小红书内容策略

**每周发布计划**：
- 周一：作品展示（3张图）
- 周三：教程/技巧（1张图+文字）
- 周五：活动/福利（1张图）
- 周日：互动话题（引导评论）

**标签组合**：
- 必选：`#梦境AI` `#AI绘画`
- 流量：`#AI工具` `#设计工具`
- 垂直：`#梦幻风格` `#电影感`

---

**需要我现在帮你实现这些技术修改吗？**
