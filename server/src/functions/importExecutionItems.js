import prisma from '../lib/prisma.js';
import { parseExecutionRows } from '../lib/executionRows.js';

// POST multipart: file, project_id (optional — 缺省为服务管理目录), dry_run=1 只解析不入库
export async function importExecutionItems(req, res) {
  try {
    const projectId = req.body?.project_id || null;
    const dryRun = req.body?.dry_run === '1' || req.body?.dry_run === 'true';
    let project = null;

    if (projectId && !dryRun) {
      project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return res.status(404).json({ error: 'Project not found' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: '请上传 Excel 文件' });

    let parsed;
    try {
      parsed = parseExecutionRows(file.buffer);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const { rows, skipped, total } = parsed;

    if (dryRun) return res.json({ ok: true, rows, skipped, total });

    const userInfo = {
      created_by: req.user?.email || req.user?.name || null,
      created_by_id: req.user?.open_id || null,
    };

    for (const row of rows) {
      await prisma.executionItem.create({
        data: {
          ...row,
          project_id: projectId || null,
          project_name: row.project_name || project?.name || null,
          is_service_addon: true,
          ...userInfo,
        },
      });
    }

    res.json({ ok: true, imported: rows.length, skipped, total, catalog: !projectId });
  } catch (error) {
    console.error('importExecutionItems error:', error);
    res.status(500).json({ error: error.message });
  }
}
