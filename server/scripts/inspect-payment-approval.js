import prisma from '../src/lib/prisma.js';

const approvals = await prisma.approval.findMany({
  where: { OR: [{ type: 'project_payment' }, { type_label: '付款申请' }] },
  orderBy: { created_date: 'desc' },
  take: 5,
});

for (const x of approvals) {
  console.log('---');
  console.log({
    title: x.title,
    applicant: x.applicant,
    status: x.status,
    project_name: x.project_name,
    project_id: x.project_id,
  });
  console.log('steps:', x.steps);
}

const wfs = await prisma.workflowTemplate.findMany({
  where: { approval_type: 'project_payment' },
});
console.log('WF templates:', wfs.length);
for (const w of wfs) {
  console.log(w.name);
  console.log(w.nodes);
}

await prisma['$disconnect']();
