import { PrismaClient } from '@prisma/client';

// 迁移：把数据库里旧的 OSS 直连 URL（http(s)://*.aliyuncs.com/<key>）转为代理格式 /api/files/<key>
// 私有 bucket 直连会 AccessDenied；代理由后端鉴权后转发。
const p = new PrismaClient();

const ALIYUN_RE = /^https?:\/\/[^/]+\.aliyuncs\.com\/(.+)$/;

function migrateUrl(u) {
  if (!u || typeof u !== 'string') return u;
  const m = u.match(ALIYUN_RE);
  return m ? `/api/files/${m[1]}` : u;
}

function migrateFileList(jsonStr) {
  if (!jsonStr) return jsonStr;
  try {
    const list = JSON.parse(jsonStr);
    if (!Array.isArray(list)) return jsonStr;
    let changed = false;
    const next = list.map(f => {
      if (f && typeof f.url === 'string' && ALIYUN_RE.test(f.url)) {
        changed = true;
        return { ...f, url: migrateUrl(f.url) };
      }
      return f;
    });
    return changed ? JSON.stringify(next) : jsonStr;
  } catch {
    return jsonStr;
  }
}

try {
  const bids = await p.bid.findMany({ select: { id: true, contract_files: true, proposal_files: true } });
  let updated = 0, filesMigrated = 0;

  for (const b of bids) {
    const newContract = migrateFileList(b.contract_files);
    const newProposal = migrateFileList(b.proposal_files);
    if (newContract !== b.contract_files || newProposal !== b.proposal_files) {
      await p.bid.update({
        where: { id: b.id },
        data: { contract_files: newContract, proposal_files: newProposal },
      });
      updated++;
      if (newContract !== b.contract_files) filesMigrated += (JSON.parse(newContract || '[]') || []).length;
      if (newProposal !== b.proposal_files) filesMigrated += (JSON.parse(newProposal || '[]') || []).length;
      console.log(`updated bid ${b.id}`);
    }
  }

  console.log(`\n✅ 迁移完成：更新 ${updated} 条记录`);

  // 验证：列出迁移后的 URL
  const after = await p.bid.findMany({ select: { contract_files: true, proposal_files: true } });
  const all = [];
  for (const b of after) {
    for (const f of [b.contract_files, b.proposal_files]) {
      try { all.push(...(JSON.parse(f || '[]') || []).map(x => x.url)); } catch {}
    }
  }
  all.filter(Boolean).forEach(u => console.log('  ', u));
} catch (e) {
  console.error('ERROR:', e.message);
}
await p.$disconnect();
