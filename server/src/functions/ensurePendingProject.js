import prisma from '../lib/prisma.js';

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 竞标商务字段 → 待立项项目同步字段 */
export function buildPendingProjectSyncFromBid(bid = {}) {
  return {
    name: bid.project_name || '',
    customer: bid.customer_name || '待定',
    project_type: bid.project_type || '',
    contract_amount: toNumberOrNull(bid.bid_amount),
    payment_method: bid.payment_method || '里程碑付款',
    manager: bid.manager || '',
  };
}

// 竞标中标后自动关联项目管理：
// 1. 若该竞标尚无关联项目，自动创建「待立项」项目
// 2. 若已有待立项项目，同步商务字段；已执行中等则跳过创建
// 3. 通知负责人完成立项
export async function ensurePendingProject(req, res) {
  try {
    const { bid_id } = req.body || {};
    if (!bid_id) return res.status(400).json({ error: 'bid_id is required' });

    const bid = await prisma.bid.findUnique({ where: { id: bid_id } });
    if (!bid) return res.status(404).json({ error: 'Bid not found' });

    if (bid.result !== '中标') {
      return res.json({ ok: true, skipped: 'bid not won' });
    }

    const syncData = buildPendingProjectSyncFromBid(bid);
    const existing = await prisma.project.findFirst({
      where: { bid_id, is_deleted: false },
    });

    if (existing) {
      if (existing.status === '待立项') {
        const project = await prisma.project.update({
          where: { id: existing.id },
          data: syncData,
        });
        return res.json({
          ok: true,
          synced: true,
          project: { id: project.id, name: project.name, status: project.status },
        });
      }
      return res.json({
        ok: true,
        existing: { id: existing.id, status: existing.status },
        synced: false,
      });
    }

    const project = await prisma.project.create({
      data: {
        bid_id: bid.id,
        ...syncData,
        members: [],
        status: '待立项',
        budget_cost: 0,
        remaining_budget: 0,
      },
    });

    if (bid.manager) {
      await prisma.notification.create({
        data: {
          recipient: bid.manager,
          type: 'bid_won',
          title: `中标待立项：${bid.project_name}`,
          content: `「${bid.project_name}」已中标，请前往项目管理填写立项信息并提交立项`,
          link: `/projects/${project.id}`,
          related_id: project.id,
          priority: 'high',
          is_read: false,
          is_archived: false,
          feishu_sent: false,
        },
      });
    }

    res.json({
      ok: true,
      project: { id: project.id, name: project.name, status: project.status },
      notified: !!bid.manager,
    });
  } catch (error) {
    console.error('ensurePendingProject error:', error);
    res.status(500).json({ error: error.message });
  }
}
