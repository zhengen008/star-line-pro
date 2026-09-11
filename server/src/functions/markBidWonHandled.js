import prisma from '../lib/prisma.js';

// 立项发起后，归档该竞标对应的「中标待立项」通知（Dashboard 通知面板不再显示）
export async function markBidWonHandled(req, res) {
  try {
    const { bid_id, project_id } = req.body || {};
    const relatedIds = [bid_id, project_id].filter(Boolean);
    if (relatedIds.length === 0) {
      return res.json({ ok: true, updated: 0 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        type: 'bid_won',
        related_id: { in: relatedIds },
        is_archived: false,
      },
      data: { is_read: true, is_archived: true },
    });

    res.json({ ok: true, updated: result.count });
  } catch (error) {
    console.error('markBidWonHandled error:', error);
    res.status(500).json({ error: error.message });
  }
}
