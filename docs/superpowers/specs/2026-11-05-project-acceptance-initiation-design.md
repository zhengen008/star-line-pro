# 项目验收进度 / 回款 / 统一立项 设计

日期：2026-11-05
状态：已批准（验收按期次登记 A；立项服务内容随立项审批 A；直签保留兜底 B）

## 背景（客户反馈）

1. 需要验收进度，保留原时间进度；验收周期直接用商务已填的结算方式（月/季/半年/年/一次性）。
2. 不需要项目成本预算，只看项目总共花了多少（已支出）。
3. 要有合同金额、已验收金额、已验收部分开票情况、已回款金额。
4. 立项界面直接增加服务内容，并提供可下载的导入模板。
5. 立项只有一个界面，直接关联商务记录，不再选「关联竞标 / 直签」。

## 现状要点

- 竞标 `payment_method`（结算方式）选项：月付 / 季付 / 半年付 / 结束后支付；中标后 `ensurePendingProject` 同步到待立项项目。
- 唯一的「收入」方向审批是「开票申请」，现有「已收款」实为已开票审批金额；系统无验收、无回款记录。
- 两个立项弹窗：`ProjectManagement` 内 `InitiateModal`（关联中标 / 直签切换）与 `SubmitInitiationModal`（待立项项目）。`InitiateModal` 过滤掉已有项目的竞标，而中标会自动建待立项项目，导致下拉几乎为空。
- 服务内容只能在「服务管理」导入到执行中项目，再走「服务增项」审批；模板 `执行内容导入模板.xlsx` 无页面下载入口。

## 数据模型

### 新表 ProjectAcceptance（`project_acceptances`）

| 字段 | 类型 | 说明 |
|------|------|------|
| project_id | String | 所属项目（Cascade 删除） |
| seq | Int | 期次序号，从 1 开始 |
| period_label | String | 如「2026年11月」「2026 Q4」「2026下半年」「2026年度」「全周期」 |
| period_start / period_end | String | `YYYY-MM-DD` |
| planned_amount | Decimal? | 预计金额，默认合同金额 / 期数 |
| status | String | `待验收` / `已验收` |
| accepted_amount / accepted_date | Decimal? / String? | 验收金额、日期 |
| invoice_status | String | `未开票` / `已开票`，默认未开票 |
| invoice_amount / invoice_date | Decimal? / String? | 开票金额、日期 |
| received_amount / received_date | Decimal? / String? | 回款金额、日期 |
| remark | String? | 备注 |

- 根目录 `prisma/schema.prisma` 与 `server/prisma/schema.prisma` 同步修改；`Project` 增加 `acceptances` 关系。
- `server/src/routes/entities.js` 的 `ENTITIES` 加入 `ProjectAcceptance`。
- `Project.budget_cost` / `remaining_budget` 保留字段不删，界面与逻辑不再使用。

## 验收期次生成

纯函数 `buildAcceptancePeriods(startDate, endDate, paymentMethod, contractAmount)`（`src/lib/acceptancePeriods.js`）：

| 结算方式 | 粒度 |
|----------|------|
| 月付 / 月结 / 月度 | 自然月 |
| 季付 / 季度 | 自然季度 |
| 半年付 | 自然半年（1–6 月 / 7–12 月） |
| 年付 / 年度 | 自然年 |
| 结束后支付、里程碑付款、空值及其他 | 整个项目 1 期「全周期」 |

- 按自然周期切分，首末期被项目起止日期截断。
- `planned_amount` = 合同金额 / 期数（四舍五入到分，尾差计入最后一期）。
- 起止日期缺失或结束早于开始 → 返回空数组。

生成时机：

- 立项审批通过（`finalizeProjectInitiationApproved`）时自动生成（项目已有期次则跳过）。
- 已执行中但无期次的老项目：详情页显示「生成验收计划」按钮（项目负责人 / 管理员）。
- 所有期次均为 `待验收` 时，可「重新生成」（删除后按当前起止日期与结算方式重建）。

商务结算方式选项新增「年付」。

## 财务汇总

纯函数 `summarizeAcceptances(acceptances)`（同文件）返回：

- `totalPeriods`、`acceptedPeriods`
- `acceptedAmount`（已验收期次的 accepted_amount 之和）
- `invoicedAmount`（已开票期次的 invoice_amount 之和）、`uninvoicedAcceptedAmount` = max(0, acceptedAmount − invoicedAmount)
- `receivedAmount`、`unreceivedAmount` = max(0, acceptedAmount − receivedAmount)

已支出沿用现有口径：方向为「支出」且状态为已通过 / 已付款的审批金额之和。

## 项目详情页（`ProjectDetail.jsx`）

- 顶部：保留时间进度条；其下新增「验收进度 已验收 x/N 期」进度条（`ProjectProgress` 同文件新增 `AcceptanceProgress`）。
- 概览卡片 5 张：合同金额 / 已验收（占合同 %）/ 已开票（已验收未开票 ¥x）/ 已回款（未回款 ¥x）/ 已支出。删除「剩余预算」卡片。
- 新增「验收与回款」区块（`src/components/project/AcceptanceSection.jsx`）：期次表格；项目负责人 / 管理员点击行打开登记弹窗，填写验收、开票、回款字段；保存时写 ProjectLog。待立项 / 待审批项目不显示该区块。
- 原「收入明细」列表标题改为「开票申请记录」，避免与回款混淆。

## 去掉成本预算

- 立项表单、`EditProjectModal` 移除成本预算字段；`applyApprovalDecision` 不再识别「成本预算」变更。
- `applyApprovalDecision` 与 `submitSupplierPaymentApproval` 删除「预算扣减」逻辑与日志。
- 项目列表「剩余预算」列改为「验收进度」；`ProjectCard` 剩余预算改为已支出，「已收款」改为已回款（取验收表）。
- `ProjectStats`：去掉成本预算列与预算柱；「已收款」改为「已回款」，数据取验收表；毛利润 = 已回款 − 已支出。
- `WorkflowEditor` 立项字段提示中「成本预算」改为「合同金额」。
- `ProjectDetailPanel.jsx` 无引用，不改动。

## 统一立项表单（`src/components/project/ProjectInitiationModal.jsx`）

替换 `ProjectManagement` 内 `InitiateModal` 与 `SubmitInitiationModal`，两个入口共用：

- 「项目立项」按钮：首字段为商务项目下拉，列出 `result === '中标'` 且（无关联项目或关联项目为待立项）的竞标。选中后只读展示客户、合同金额、结算方式、商务负责人。下拉下方链接「找不到商务记录？手动填写」展开直签兜底字段：项目标题、合同金额、客户、结算方式（均必填）。
- 点击待立项项目：项目预选并锁定。
- 公共字段：开始 / 结束时间*、合同编号、项目负责人*、项目成员、服务内容（可选）。
- 提交：商务记录已有待立项项目 → 在该项目上提交；否则先创建项目（`status: 待立项`）再提交。均走 `submitProjectInitiation`。
- 筛选逻辑抽成纯函数 `listInitiatableBids(bids, projects)`（`src/lib/bidProjectSync.js`）。

## 立项时导入服务内容

- 模板复制到 `public/templates/execution-items-template.xlsx`，下载名「执行内容导入模板.xlsx」；立项表单与服务管理导入弹窗都提供「下载导入模板」按钮。
- `importExecutionItems` 支持 `dry_run=1`：只解析返回 `rows`，不写库。解析逻辑抽成 `parseExecutionRows(buffer)`。
- 立项表单上传 Excel → 预览表格（内容、单位、数量、立项总价、预算总价），可删除单行。
- `submitProjectInitiation` 接收 `serviceItems`：非空时创建 `ExecutionSheet{name: '立项服务内容', status: '待审核'}` 并逐条创建 `ExecutionItem{project_id, sheet_id, is_service_addon: true}`；立项审批单 `fields` 记录 `initiation_sheet_id` 与条目数。
- 立项通过 → 该 Sheet `已通过`；立项拒绝 → `已拒绝`（沿用现有 Sheet Tab 关闭行为），重新提交需重新上传。

## 测试

- `node --test`：`acceptancePeriods.test.js`（月 / 季 / 半年 / 年 / 一次性、跨年、首末截断、金额尾差、非法日期）、`summarizeAcceptances`、`listInitiatableBids`、`parseExecutionRows`。
- `npm run lint`、`npm run build`。
- 浏览器走查：统一立项（关联商务 + 直签兜底 + 服务内容上传）→ 审批通过 → 期次生成 → 登记验收 / 开票 / 回款 → 卡片与列表数值正确。
