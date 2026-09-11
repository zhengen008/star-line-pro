# 审批与项目体验改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发起审批锁定当前用户、服务增项、项目管理发起审批弹窗、项目详情内审批操作。

**Architecture:** 抽出 `approvalAccess` / `projectAccess` / `applyApprovalDecision` 纯函数与共享业务逻辑；复用 `InitiateApprovalModal` 与 `ApprovalDetailPanel`；`ExecutionItem` 增加 `is_service_addon`。

**Tech Stack:** React 18、TanStack Query、Express、Prisma、PostgreSQL、Node `node:test`（纯函数测试）。

## Global Constraints

- 申请人/部门锁定当前用户，只读，不可代提交
- 服务增项仅管理员与项目负责人；字段与 Excel 一致；`is_service_addon`
- 项目管理头部弹窗发起，不跳转审批中心
- 关联项目：管理员全部未删除；其他人仅负责人或 members
- 拒绝/通过仅当前节点审批人；审批中心与项目详情同一规则
- 不打通工作流模板；不改后端模块 RBAC；不改遗留 ProjectApproval

---

### Task 1: 纯函数 helpers + 测试

**Files:**
- Create: `src/lib/projectAccess.js`
- Create: `src/lib/approvalAccess.js`
- Create: `src/lib/projectAccess.test.js`
- Create: `src/lib/approvalAccess.test.js`

**Interfaces:**
- Produces: `userParticipatesInProject(project, userName)`, `eligibleProjectsForApproval(projects, { isAdmin, userName })`, `isCurrentApprover(item, { currentUser, role, dept })`, `getActiveApprovalStepIndex(steps)`

- [ ] 写失败测试并实现，运行 `node --test src/lib/*.test.js`

### Task 2: applyApprovalDecision

**Files:**
- Create: `src/lib/applyApprovalDecision.js`
- Modify: `src/pages/ApprovalManagement.jsx`（改用该函数）

**Interfaces:**
- Produces: `applyApprovalDecision({ api, target, action, operatorName })` → `{ updateData, notifMsg }`

- [ ] 从 ApprovalManagement 抽出逻辑并替换 handleApprove

### Task 3: Schema is_service_addon

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `prisma/schema.prisma`
- Run: `cd server && npx prisma generate && npx prisma db push`

### Task 4: InitiateApprovalModal 锁定申请人 + 项目过滤

**Files:**
- Modify: `src/components/approval/InitiateApprovalModal.jsx`

- [ ] useAuth 锁定申请人/部门；eligibleProjectsForApproval；去掉 EmployeePicker

### Task 5: 项目管理头部发起审批

**Files:**
- Modify: `src/pages/ProjectManagement.jsx`

- [ ] 「发起审批」按钮 + InitiateApprovalModal + create + onApprovalChange

### Task 6: ApprovalDetailPanel 仅当前审批人可批

**Files:**
- Modify: `src/components/approval/ApprovalDetailPanel.jsx`

- [ ] canApprove = isCurrentApprover(...)

### Task 7: 项目详情侧栏审批

**Files:**
- Modify: `src/pages/ProjectDetail.jsx`

- [ ] 点击进行中审批打开遮罩 + ApprovalDetailPanel；applyApprovalDecision

### Task 8: 服务增项 UI

**Files:**
- Modify: `src/components/project/ExecutionItemsSection.jsx`

- [ ] 按钮、表单、角标、ProjectLog

### Task 9: 验证

- [ ] `node --test src/lib/*.test.js`
- [ ] 浏览器：发起审批、服务增项、项目头部弹窗、详情审批
