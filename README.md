# FrameForge Image Gen Studio

短视频封面与分镜关键帧生成工作台 MVP。

## 启动

```bash
npm install
npm run dev
```

前端默认地址：`http://127.0.0.1:5177`

API 默认地址：`http://127.0.0.1:8787`

## 当前能力

- 输入短视频主题、人物、场景、情绪、平台和风格
- 自动组装封面图与分镜关键帧提示词
- 生成 mock 预览图，验证完整产品流程
- 保存每次生成记录到 `_runtime/image-gen-studio/jobs`

## 后续接入真实模型

当前 `server/index.js` 中的 `generateImages` 默认使用 mock provider。确认使用 Agnes、Seedream 或其他模型后，可以在同一函数里新增 provider 分支。
