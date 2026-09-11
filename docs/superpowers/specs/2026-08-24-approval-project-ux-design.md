# 审批与项目体验改进设计

日期：2026-08-24  
状态：已批准并实现  
范围：发起审批自动填入当前用户、执行内容服务增项、项目管理发起审批、项目详情内审批操作。

## 背景

当前发起审批需手动选申请人；执行内容只能 Excel 导入；项目管理没有发起审批入口；项目详情「进行中的审批」只能看流程图，不能通过/拒绝。

## 目标

1. 发起审批时申请人、所在部门锁定为当前登录用户，不可代他人提交。
2. 管理员与项目负责人可手动新增「服务增项」执行内容（字段与 Excel 一致，并有明确提示与角标）。
3. 项目管理列表头部可弹出与审批中心相同的发起审批流程；关联项目按参与范围过滤。
4. 项目详情点击进行中的审批，打开与审批中心相同的详情侧栏；仅当前节点审批人可拒绝/通过。

## 非目标

- 不打通工作流模板与发起审批的 `steps` 绑定（保持现有提交行为）。
- 不新增后端模块级 RBAC；实体接口仍只验 JWT。
- 不改遗留 `ProjectApproval` 表与未挂路由的 `ProjectApproval.jsx`。
- 不扩大服务增项权限到普通项目成员。

## 决策摘要

| 项 | 选择 |
|----|------|
| 申请人/部门 | 锁定当前用户，只读 |
| 项目管理发起 | 弹出同一套 `InitiateApprovalModal`，不跳转审批中心 |
| 服务增项权限 | 仅管理员、项目负责人 |
| 服务增项字段 | 与 Excel 导入列一致 |
| 数据标记 | `ExecutionItem.is_service_addon Boolean @default(false)` |
| 详情审批 | 点击打开与审批中心相同的详情侧栏 |

实现策略：复用现有弹窗与侧栏，抽出「是否当前审批人」「项目是否参与」纯函数，抽出审批通过/拒绝的业务步骤供两处页面调用。

## 数据模型

`server/prisma/schema.prisma` 的 `ExecutionItem` 增加：

```
is_service_addon  Boolean  @default(false)
```

同步根目录 `prisma/schema.prisma`。开发环境 `npx prisma generate` + `npx prisma db push`。Excel 导入不传该字段，走默认 `false`。

## 组件与文件

| 文件 | 职责 |
|------|------|
| `src/lib/approvalAccess.js` | `isCurrentApprover(item, ctx)`：当前用户是否为当前待办节点审批人 |
| `src/lib/projectAccess.js` | `userParticipatesInProject(project, userName)`、`eligibleProjectsForApproval(projects, { isAdmin, userName })` |
| `src/lib/applyApprovalDecision.js` | 通过/拒绝/已付款：改步骤、改状态、支出扣预算、项目变更回写、项目完成状态、调用 `onApprovalChange` |
| `src/components/approval/InitiateApprovalModal.jsx` | 锁定申请人/部门；项目下拉用 `eligibleProjectsForApproval` |
| `src/components/approval/ApprovalDetailPanel.jsx` | 拒绝/通过仅当 `isCurrentApprover`；已付款按钮规则保持「已通过且支出」 |
| `src/pages/ApprovalManagement.jsx` | 改用 `applyApprovalDecision` + `isCurrentApprover` |
| `src/pages/ProjectManagement.jsx` | 头部「发起审批」；弹窗 `onCreate` 与审批中心相同（创建 + `onApprovalChange`） |
| `src/pages/ProjectDetail.jsx` | 点击进行中审批打开侧栏；复用 `applyApprovalDecision` |
| `src/components/project/ExecutionItemsSection.jsx` | 「服务增项」按钮、表单、角标；权限仍为 `isAdmin \|\| project.manager === currentUserName` |

## 行为细则

### 1. 申请人 / 部门

- 进入填表步骤时：`applicant = currentEmployee.name \|\| currentUserName`，`dept = currentEmployee.department \|\| ''`。
- 申请人、部门控件只读，去掉 `EmployeePicker`。
- 无部门时部门旁提示：「未匹配到员工部门，请在员工管理补全」。
- 提交仍要求申请人非空；部门允许空字符串（无员工档案时）。

### 2. 关联项目过滤

适用于审批中心与项目管理两处同一弹窗。

- 排除 `is_deleted === true`。
- 管理员：全部未删除项目。
- 非管理员：`manager === currentUserName` 或 `members` 数组包含 `currentUserName`。

### 3. 服务增项

表单字段：内容、详细说明、单位、数量、立项金额单价、立项金额总价、预算金额单价、预算金额总价。内容必填。

保存：`project_id`、`is_service_addon: true`，`seq_id` 留空（与 Excel 导入序号区分，展示用「-」+ 角标）。成功后写 `ProjectLog`：`action: '服务增项'`。

列表：内容旁橙色角标「服务增项」。表单顶部固定提示：「这是服务增项，非立项导入内容」。

### 4. 当前审批人判定

与现有「打开详情标已读」规则对齐，抽成 `isCurrentApprover`：

- 单据状态不是「待审核」或「审核中」→ false。
- 无步骤时：待审核/审核中视为可批（与现有空 `steps` 直接终态行为一致）。
- 有步骤时：取当前待办节点（未 done、未 skipped、非条件/抄送，且前置审批节点均已完成）。
- 命中：`step.actor === currentUser`（且 actor 不是占位「部门负责人/财务总监/总经理」），或 `step.role === 当前员工角色`，或 `step.role === '部门经理'` 且 `item.dept === 当前部门` 且角色为部门经理。

非当前审批人：侧栏可看流程图与字段，不显示拒绝/通过。

### 5. 项目详情侧栏

点击进行中卡片打开右侧遮罩 + `ApprovalDetailPanel`（信息、关联项目、流程图、拒绝/通过）。关闭后刷新该项目审批列表。

## 错误与边界

- 飞书用户未匹配员工：申请人用飞书名，部门空，不阻断提交。
- 无可关联项目：下拉仅占位「请选择项目...」，必填类型仍禁止提交。
- 服务增项无权限：不显示按钮。
- 审批操作失败：保持现有 toast/console；不静默成功。

## 验证

- 纯函数：`isCurrentApprover`、`eligibleProjectsForApproval`（管理员/成员/已删除）。
- 手工：审批中心与项目管理弹窗申请人只读且为本人；项目下拉范围；服务增项角标与导入行区分；详情侧栏仅审批人有按钮；通过后预算/通知与审批中心一致。

## 风险

- 审批中心按钮目前对所有人显示，改为仅当前审批人后，管理员若不是节点审批人将不能代批。这是本需求的明确行为，不另开管理员特权。
