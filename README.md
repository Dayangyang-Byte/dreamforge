# DreamForge 🏰 - 梦境 AI 图片生成平台

> 让梦境成为现实 ✨

一个专注**梦幻/电影风格**的 AI 图片生成工具，支持多模型、参考图上传、多种分辨率输出。

[![GitHub stars](https://img.shields.io/github/stars/Dayangyang-Byte/dreamforge?style=social)](https://github.com/Dayangyang-Byte/dreamforge/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Dayangyang-Byte/dreamforge?style=social)](https://github.com/Dayangyang-Byte/dreamforge/network/members)
[![License](https://img.shields.io/github/license/Dayangyang-Byte/dreamforge)](LICENSE)

## 🌟 在线体验

👉 **[dreamforge-679j.vercel.app](https://dreamforge-679j.vercel.app)**

---

## ✨ 核心特性

### 🎨 多模型支持
- **Forge 生图模型** - 1 积分/张，基础生成
- **GPT Image 2** - 2-5 积分/张，高质量生成
- **Nannabanan** - 2 积分/张，特色模型

### 📸 参考图上传
- 支持上传**最多 5 张**参考图
- 精准还原风格、构图、色彩
- 直接在提示词框粘贴图片即可

### 🎭 多种风格模板
- 自定义（自由发挥）
- 梦幻电影感
- 动漫插画
- 写实摄影
- 产品海报

### 📐 多分辨率输出
- **1K** - 标准清晰度（2 积分）
- **2K** - 高清海报（3 积分）
- **4K** - 超清大图（5 积分）

### 🌍 国际化
- 支持中文/英文界面
- 自动翻译，一键切换

---

## 🚀 快速开始

### 方式一：在线使用
直接访问 [dreamforge-679j.vercel.app](https://dreamforge-679j.vercel.app)

### 方式二：本地部署

#### 1. 克隆仓库
```bash
git clone https://github.com/Dayangyang-Byte/dreamforge.git
cd dreamforge
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填写必要的 API Key
```

#### 4. 启动服务
```bash
# 开发模式（同时启动前后端）
npm run dev

# 或单独启动
npm run dev:web  # 前端
npm run dev:api  # 后端
```

#### 5. 构建生产版本
```bash
npm run build
```

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 6 + TypeScript |
| 样式 | CSS Modules + 自定义组件 |
| 图标 | Lucide React |
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| 图片处理 | Sharp |
| 部署 | Vercel |

---

## 📸 功能截图

### 主界面
```
┌─────────────────────────────────────────────┐
│  DreamForge                    [中文] [登录] │
├─────────────────────────────────────────────┤
│                                             │
│           让梦境成为现实                     │
│   上传最多 5 张参考图，生成更接近你想法的 AI 图片│
│                                             │
│  [Forge 1积分] [GPT Image 2 2-5积分] [🍌 2积分]│
│                                             │
│  [1K 2积分] [2K 3积分] [4K 5积分]          │
│                                             │
│  📝 描述你想生成的画面...                   │
│       [立即生成 · 2 积分]                   │
│                                             │
│  🖼 参考图 0/5  [粘贴图片到此处]            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
dreamforge/
├── src/                    # 前端源代码
│   ├── main.jsx           # 入口文件
│   ├── App.jsx            # 主应用组件
│   ├── Admin.jsx          # 管理后台
│   └── styles.css         # 全局样式
├── server/                 # 后端代码
│   ├── index.js           # Express 服务器
│   ├── migrate-*.js       # 数据库迁移脚本
│   └── quality-guards.js  # 质量检查工具
├── public/                 # 静态资源
│   ├── bg/                # 背景图片
│   └── en/                # 英文静态页面
├── templates/              # 模板文件
├── references/             # 参考文档
├── package.json
├── vite.config.js
└── vercel.json            # Vercel 部署配置
```

---

## 💰 积分体系

| 模型 | 1K | 2K | 4K |
|------|----|----|----|
| Forge | 1 | - | - |
| GPT Image 2 | 2 | 3 | 5 |
| Nannabanan | 2 | - | - |

新用户注册赠送**免费试用积分**。

---

## 🔗 相关链接

- **官方网站**: [dreamforge-679j.vercel.app](https://dreamforge-679j.vercel.app)
- **英文 FAQ**: [英文常见问题](https://dreamforge-679j.vercel.app/en/faq)
- **提示词指南**: [Prompt Guide](https://dreamforge-679j.vercel.app/en/prompts)
- **GitHub**: [Dayangyang-Byte/dreamforge](https://github.com/Dayangyang-Byte/dreamforge)

---

## 📝 开发计划

- [ ] 增加更多 AI 模型支持
- [ ] 支持视频生成
- [ ] 移动端优化
- [ ] 批量生成功能
- [ ] API 开放平台

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [Sharp](https://sharp.pixelplumbing.com/)
- [Lucide Icons](https://lucide.dev/)

---

⭐ 如果这个项目对你有帮助，请给一个 Star！
