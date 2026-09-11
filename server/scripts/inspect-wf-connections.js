import prisma from '../src/lib/prisma.js';

const w = await prisma.workflowTemplate.findFirst({
  where: { approval_type: 'project_payment' },
});
console.log('nodes len', JSON.parse(w.nodes || '[]').length);
console.log('connections raw:', w.connections);
console.log('connections parsed:', JSON.parse(w.connections || '[]'));

const p = await prisma.project.findUnique({ where: { id: 'cmtcrrmhn000213rrpmy6e6zu' } });
console.log('project manager:', p?.manager, 'status:', p?.status);

await prisma['$disconnect']();
