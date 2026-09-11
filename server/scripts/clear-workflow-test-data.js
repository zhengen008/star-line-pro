/**
 * 清除数据库中已保存的审批流模板（含硬编码测试人员/部门）。
 * 清除后系统将使用代码中的默认模板，并在编辑器中从部门管理读取负责人。
 */
import prisma from '../src/lib/prisma.js';

const before = await prisma.workflowTemplate.count();
const deleted = await prisma.workflowTemplate.deleteMany({});

console.log(JSON.stringify({
  workflowTemplatesBefore: before,
  deletedWorkflowTemplates: deleted.count,
  note: '请在「审批流程编辑器」中重新保存各审批流，以写入基于真实部门/员工的配置',
}, null, 2));

await prisma.$disconnect();
