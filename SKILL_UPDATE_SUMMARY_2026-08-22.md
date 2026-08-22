# Skill Update Summary

> Date: 2026-08-22
> Session: DreamForge Promotion

## Updates Made

### 1. Product Hunt 提交流程更新
- 正确入口：https://www.producthunt.com/posts/new（不是 /submit）
- 需要先点击"Get started"按钮
- 表单会问"是否重大更新"，首次提交选"是"
- 提交成功后显示"正在审核"，不是立即上线
- 审核时间通常1-3天

### 2. 新增参考文档
- 文件：`references/producthunt-submit-guide.md`
- 包含完整提交流程、表单填写指南、发布后推广计划

### 3. 核心原则更新
新增原则：
- **能自动就自动，最后一步给用户**：浏览器工具能填写的表单尽量自动填写，只保留最终"发布/提交"按钮由用户点击
- **主动查找信息**：用户说"你来问我，我也不是很清楚"时，应该主动搜索/检查，不要反问用户

## Skills That Need Manual Update

The following skills need manual updates but couldn't be patched automatically:

1. `dreamforge-promotion-workflow` - Need to add new principles and pitfalls
   - Run: `hermes curator edit dreamforge-promotion-workflow`
   - Add new core principles
   - Add new pitfalls (#15, #16)

## Key Learnings

1. Product Hunt 提交流程比之前理解的更复杂，需要手动点击"Get started"
2. 用户明确要求能自动填写就自动填写，不要让用户做没必要的手动操作
3. Browser工具在处理中文注释时会遇到编码问题，需要记住这个限制
