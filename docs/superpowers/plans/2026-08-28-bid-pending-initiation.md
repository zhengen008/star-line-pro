# 竞标待立项 Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** 中标自动建「待立项」关联项目；负责人/管理员提交立项后变执行中；仅待立项时竞标编辑同步商务字段。

**Tech Stack:** Express + Prisma、React、TanStack Query、node:test

## Task 1: 纯函数 + 测试（同步字段 / 立项权限）

- Create: `src/lib/bidProjectSync.js` + `.test.js`
- `buildPendingProjectSyncFromBid(bid)` → 项目可更新字段
- `canSubmitProjectInitiation(project, { isAdmin, currentUserName })`

## Task 2: 后端 ensurePendingProject + 竞标更新同步

- 改 `ensurePendingProject.js`：status=`待立项`，通知文案改「请完成立项」
- 新增或扩展：Bid update 后若关联项目待立项则同步字段（`syncPendingProjectFromBid`）

## Task 3: 前端立项表单 + 列表/详情入口

- `ProjectManagement`：STATUS_MAP 加待立项；点击待立项打开立项表单
- `ProjectDetail`：待立项时显示提交立项，限制业务操作
- 提交：更新项目字段 + status=执行中 + log + 通知

## Task 4: 竞标编辑触发同步

- `BusinessManagement` updateMutation 成功后 invoke 同步（或后端 Bid update hook）
