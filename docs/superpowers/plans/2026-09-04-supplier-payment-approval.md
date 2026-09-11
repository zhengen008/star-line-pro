# 供应商付款审批 Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD where noted.

**Goal:** 供应商保存有金额时自动发起 project_payment，并同步预算与状态。

**Architecture:** 抽取 `submitSupplierPaymentApproval`；SupplierForm 保存后调用；`applyApprovalDecision` 同步 `payment_status`。

**Tech Stack:** React Query, Prisma, createApprovalWithSteps

## Task 1: Schema
- [ ] SupplierItem 增加 approval_id、payment_status；prisma db push

## Task 2: Helper + tests
- [ ] buildSupplierPaymentPayload / resolveSupplierPaymentStatus
- [ ] submitSupplierPaymentApproval

## Task 3: applyApprovalDecision sync
- [ ] 付款审批状态变化时更新 SupplierItem.payment_status

## Task 4: UI
- [ ] SupplierForm 接入自动审批；列表显示状态；锁金额；拒绝可重发
