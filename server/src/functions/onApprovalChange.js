import prisma from '../lib/prisma.js';
import { getTenantToken, pushFeishuCard } from '../lib/feishu.js';

function safeJson(s, fallback) {
  try { return JSON.parse(s || ''); } catch { return fallback; }
}

function findActiveStep(steps) {
  const idx = steps.findIndex((s, i) =>
    !s.done && !s.skipped &&
    steps.slice(0, i).filter(x => !x.skipped && !x.isCondition && !x.isCC).every(x => x.done)
  );
  return idx >= 0 ? steps[idx] : null;
}

// 岗位名（审批步骤中的 actor/role）与员工职位的关键字匹配
function matchPosition(position, target) {
  if (!position || !target) return false;
  if (target.includes('总经理')) return /总|CEO/i.test(position);
  if (target.includes('财务')) return /财务/.test(position);
  if (target.includes('部门负责人') || target.includes('部门经理')) return /经理/.test(position);
  return position.includes(target);
}

const PLACEHOLDER_ACTORS = new Set(['部门负责人', '财务总监', '总经理', '项目负责人', '-']);

async function resolveApprovers(approval, step) {
  if (!step) return [];
  // 1. 步骤明确指定了具体审批人姓名
  if (step.actor && !PLACEHOLDER_ACTORS.has(step.actor)) {
    return [step.actor];
  }

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { status: '在职' },
      orderBy: { created_date: 'desc' },
    }),
    prisma.department.findMany({
      where: { NOT: { status: '停用' } },
    }),
  ]);

  // 2. 从部门管理解析负责人
  if ((step.role === '部门经理' || step.actor === '部门负责人') && approval.dept) {
    const dept = departments.find((d) => d.name === approval.dept);
    if (dept?.head) return [dept.head];
  }
  if (step.role && step.role.endsWith('负责人') && !step.role.includes('跳过')) {
    const deptName = step.role.replace(/负责人$/, '');
    const dept = departments.find((d) => d.name === deptName);
    if (dept?.head) return [dept.head];
    if (deptName.includes('财务')) {
      const financeDept = departments.find((d) => d.name && d.name.includes('财务'));
      if (financeDept?.head) return [financeDept.head];
    }
  }

  // 3. 按角色匹配员工（如员工 role 设置为 部门经理/财务总监/总经理）
  const byRole = employees.filter(e => e.role === step.role && e.status === '在职');
  if (byRole.length > 0) {
    if (step.role === '部门经理') {
      const inDept = byRole.filter(e => e.department === approval.dept);
      if (inDept.length > 0) return inDept.map(e => e.name);
    }
    return byRole.map(e => e.name);
  }
  // 4. 按职位关键字匹配岗位（总经理→含"总"/CEO，财务→含"财务"，部门负责人→含"经理"）
  const positionMatched = employees.filter(e => e.position && matchPosition(e.position, step.actor || step.role || ''));
  if (positionMatched.length > 0) return positionMatched.map(e => e.name);
  // 5. 兜底：通知管理员，确保审批提醒不丢失
  return employees.filter(e => e.role === '管理员').map(e => e.name);
}

async function createNotificationsAndPush(recipients, payload, origin, feishuToken, empByName) {
  const unique = Array.from(new Set(recipients.filter(Boolean)));
  for (const name of unique) {
    const emp = empByName[name];
    const openId = emp?.employee_id || '';
    const rec = await prisma.notification.create({
      data: {
        recipient: name,
        recipient_open_id: openId,
        type: payload.type,
        title: payload.title,
        content: payload.content || '',
        link: payload.link || '',
        related_id: payload.related_id || '',
        priority: payload.priority || 'normal',
        is_read: false,
        is_archived: false,
        feishu_sent: false,
      },
    });
    if (feishuToken && openId) {
      try {
        const linkUrl = payload.link ? (payload.link.startsWith('http') ? payload.link : `${origin}${payload.link}`) : '';
        await pushFeishuCard(feishuToken, openId, payload.title, payload.content || '', linkUrl);
        await prisma.notification.update({ where: { id: rec.id }, data: { feishu_sent: true } });
      } catch { /* ignore */ }
    }
  }
}

export async function onApprovalChange(req, res) {
  try {
    const { event, data, old_data } = req.body;
    if (!data) return res.json({ ok: true, skipped: 'no data' });

    const link = `/approvals?id=${event.entity_id}`;
    const origin = req.headers.origin || '';
    const feishuToken = await getTenantToken();
    const allEmployees = await prisma.employee.findMany();
    const empByName = {};
    allEmployees.forEach(e => { empByName[e.name] = e; });

    if (event.type === 'create') {
      const steps = safeJson(data.steps, []);
      const linkUrl = link;

      // 创建时已全部自跳过 / 已通过：通知申请人结果，不再发「待审批」
      if (['已通过', '已拒绝', '已付款'].includes(data.status)) {
        await createNotificationsAndPush([data.applicant], {
          type: 'approval_result',
          title: `审批${data.status}:${data.title}`,
          content: data.status === '已通过'
            ? `你提交的「${data.type_label || data.type}」因审批节点自动跳过，已直接通过`
            : `你提交的「${data.type_label || data.type}」已${data.status}`,
          link: linkUrl, related_id: event.entity_id,
          priority: data.status === '已拒绝' ? 'high' : 'normal',
        }, origin, feishuToken, empByName);
        return res.json({ ok: true, auto_resolved: data.status });
      }

      const activeStep = findActiveStep(steps);
      const approvers = await resolveApprovers(data, activeStep);
      await createNotificationsAndPush(approvers, {
        type: 'approval_pending',
        title: `待你审批：${data.title}`,
        content: `${data.applicant || ''} 提交了「${data.type_label || data.type}」${data.amount ? ` 金额 ¥${Number(data.amount).toLocaleString()}` : ''}`,
        link: linkUrl, related_id: event.entity_id, priority: 'high',
      }, origin, feishuToken, empByName);

      const ccList = Array.isArray(data.cc_list) ? data.cc_list : [];
      await createNotificationsAndPush(ccList, {
        type: 'approval_cc',
        title: `抄送你：${data.title}`,
        content: `${data.applicant || ''} 提交的审批已抄送给你`,
        link: linkUrl, related_id: event.entity_id,
      }, origin, feishuToken, empByName);

      return res.json({ ok: true, notified_approvers: approvers.length, notified_cc: ccList.length });
    }

    if (event.type === 'update' && old_data) {
      const notes = [];

      if (data.status !== old_data.status && ['已通过', '已拒绝', '已付款'].includes(data.status)) {
        await createNotificationsAndPush([data.applicant], {
          type: 'approval_result',
          title: `审批${data.status}:${data.title}`,
          content: `你提交的「${data.type_label || data.type}」已${data.status}`,
          link, related_id: event.entity_id,
          priority: data.status === '已拒绝' ? 'high' : 'normal',
        }, origin, feishuToken, empByName);
        notes.push(`applicant_${data.status}`);
      }

      if (data.steps !== old_data.steps && data.status !== '已拒绝') {
        const newSteps = safeJson(data.steps, []);
        const oldSteps = safeJson(old_data.steps, []);
        const newActive = findActiveStep(newSteps);
        const oldActive = findActiveStep(oldSteps);
        const sameStep = newActive && oldActive && newActive.name === oldActive.name;
        if (newActive && !sameStep) {
          const approvers = await resolveApprovers(data, newActive);
          await createNotificationsAndPush(approvers, {
            type: 'approval_pending',
            title: `待你审批：${data.title}`,
            content: `${data.applicant || ''} 的审批已流转到你（${newActive.name}）`,
            link, related_id: event.entity_id, priority: 'high',
          }, origin, feishuToken, empByName);
          notes.push(`next_${approvers.length}`);
        }
      }

      return res.json({ ok: true, notes });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
