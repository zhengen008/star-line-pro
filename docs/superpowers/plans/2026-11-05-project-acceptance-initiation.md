# 项目验收进度 / 回款 / 统一立项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-11-05-project-acceptance-initiation-design.md` 实现验收期次与回款登记、去掉成本预算、统一立项表单并支持立项时导入服务内容。

**Architecture:** 新增 `ProjectAcceptance` 实体（Prisma + 通用 entities 路由）；期次生成与汇总为无依赖纯函数（`src/lib/acceptancePeriods.js`）；立项提交 / 通过 / 拒绝的副作用集中在 `src/lib/projectInitiationApproval.js`；UI 新增 `ProjectInitiationModal`、`AcceptanceSection`。

**Tech Stack:** React 18 + Vite + TanStack Query；Express + Prisma 5 + PostgreSQL；`xlsx`；测试 `node --test`。

## Global Constraints

- 纯函数文件不得 import `@/` 别名（需能被 `node --test` 直接加载）。
- 金额字段为元，界面以「万」展示，沿用 `(v / 10000).toFixed(2)`。
- 两份 `schema.prisma`（根目录、`server/`）保持一致。
- `budget_cost` / `remaining_budget` 字段不删，只停用。
- 运行全部单测：`node --test (Get-ChildItem src/lib/*.test.js | ForEach-Object FullName)`

---

### Task 1: 验收期次生成与汇总（纯函数）

**Files:**
- Create: `src/lib/acceptancePeriods.js`
- Test: `src/lib/acceptancePeriods.test.js`

**Interfaces:**
- Produces: `resolveAcceptanceCycle(paymentMethod) → 'month'|'quarter'|'half'|'year'|'once'`
- Produces: `buildAcceptancePeriods({ startDate, endDate, paymentMethod, contractAmount }) → Array<{ seq, period_label, period_start, period_end, planned_amount }>`
- Produces: `summarizeAcceptances(rows) → { totalPeriods, acceptedPeriods, acceptedAmount, invoicedAmount, uninvoicedAcceptedAmount, receivedAmount, unreceivedAmount }`

- [ ] Step 1: 写失败测试，覆盖：月付跨年且首末截断（2026-11-15 ~ 2027-01-10 → 3 期，标签 2026年11月 / 2026年12月 / 2027年1月）、季付（2026-02-01 ~ 2026-12-31 → Q1..Q4，Q1 起点 02-01）、半年付、年付、结束后支付 / 里程碑付款 / 空 → 1 期「全周期」、金额 100 分 3 期 → 33.33 / 33.33 / 33.34、结束早于开始或缺日期 → `[]`、汇总（只统计已验收期次的验收金额，已开票期次的开票金额，回款求和，未开票 / 未回款不为负）。
- [ ] Step 2: 运行确认失败（模块不存在）。
- [ ] Step 3: 实现。日期用 `YYYY-MM-DD` 字符串与 UTC `Date` 计算，避免时区偏移。
- [ ] Step 4: 运行通过。
- [ ] Step 5: Commit。

### Task 2: 可立项商务记录筛选

**Files:**
- Modify: `src/lib/bidProjectSync.js`
- Test: `src/lib/bidProjectSync.test.js`

**Interfaces:**
- Produces: `listInitiatableBids(bids, projects) → Array<{ bid, project|null }>`：`result === '中标'`，且无未删除关联项目或关联项目 `status === '待立项'`。

- [ ] Step 1: 失败测试（未中标排除；无项目 → project null；待立项 → 带项目；执行中 → 排除；已删除项目视为无项目）。
- [ ] Step 2–4: 实现并通过。
- [ ] Step 5: Commit。

### Task 3: 后端 — 数据表、实体注册、Excel 预览、模板

**Files:**
- Modify: `prisma/schema.prisma`, `server/prisma/schema.prisma`（新增 `ProjectAcceptance`，`Project.acceptances`）
- Modify: `server/src/routes/entities.js`（`ENTITIES` 加 `ProjectAcceptance`）
- Modify: `server/src/functions/importExecutionItems.js`（抽出 `parseExecutionRows(buffer)`；`dry_run` 时只返回 `{ ok, rows, skipped, total }`）
- Create: `public/templates/execution-items-template.xlsx`（复制根目录模板）
- Create: `src/lib/executionTemplate.js`（`EXECUTION_TEMPLATE_URL`、`EXECUTION_TEMPLATE_NAME`）

- [ ] Step 1: 修改 schema；`cd server; npx prisma generate; npx prisma db push`（需数据库可用）。
- [ ] Step 2: 实现 `parseExecutionRows` 与 `dry_run`，用 `node -e` 读取模板验证解析出 2 行。
- [ ] Step 3: Commit。

### Task 4: 立项提交 / 通过 / 拒绝副作用

**Files:**
- Modify: `src/lib/projectInitiationApproval.js`

**Interfaces:**
- Consumes: `buildAcceptancePeriods`
- Produces: `submitProjectInitiation({ project, formData, serviceItems = [], operatorName, operatorDept, apiClient })`；`formData` 不再含预算。
- Produces: `ensureAcceptancePeriods(project, apiClient) → rows`（已有则跳过）。

- [ ] 去掉预算字段与日志中的预算；`fields` 加「合同金额」「结算方式」「服务内容条数」与 `initiation_sheet_id`。
- [ ] `serviceItems` 非空 → 创建 Sheet「立项服务内容」(待审核) + ExecutionItem。
- [ ] `finalizeProjectInitiationApproved`：生成验收期次、Sheet → 已通过。
- [ ] `handleProjectInitiationRejected`：Sheet → 已拒绝（需传入 approval.fields）。
- [ ] Commit。

### Task 5: 统一立项表单

**Files:**
- Create: `src/components/project/ProjectInitiationModal.jsx`
- Create: `src/components/project/ServiceItemsImporter.jsx`（模板下载 + 上传预览 + 删行）
- Modify: `src/pages/ProjectManagement.jsx`（删除 `InitiateModal`，两处入口改用新弹窗；列表「剩余预算」→「验收进度」）
- Modify: `src/pages/ProjectDetail.jsx`（「提交立项」改用新弹窗）
- Delete: `src/components/project/SubmitInitiationModal.jsx`

- [ ] 实现；手动兜底需结算方式选择。
- [ ] Commit。

### Task 6: 详情页验收与回款

**Files:**
- Create: `src/components/project/AcceptanceSection.jsx`
- Modify: `src/components/project/ProjectProgress.jsx`（新增 `AcceptanceProgress`）
- Modify: `src/pages/ProjectDetail.jsx`（5 张卡片、验收进度条、区块、收入明细标题）

- [ ] 实现：期次表、生成 / 重新生成、登记弹窗（验收 / 开票 / 回款）、写日志。
- [ ] Commit。

### Task 7: 去掉成本预算与收款口径统一

**Files:**
- Modify: `src/components/project/EditProjectModal.jsx`、`src/lib/applyApprovalDecision.js`、`src/lib/submitSupplierPaymentApproval.js`、`src/components/project/ProjectCard.jsx`、`src/pages/ProjectStats.jsx`、`src/pages/WorkflowEditor.jsx`、`src/pages/BusinessManagement.jsx`（结算方式加「年付」）、`src/pages/ServiceManagement.jsx`（模板下载）

- [ ] 实现；项目卡片与统计页回款取 `ProjectAcceptance`。
- [ ] Commit。

### Task 8: 验证

- [ ] 全部单测、`npm run lint`、`npm run build`。
- [ ] 数据库可用时：`prisma db push`，启动前后端，浏览器走查立项 → 审批 → 期次 → 登记 → 汇总。
