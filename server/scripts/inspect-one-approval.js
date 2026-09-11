import prisma from '../src/lib/prisma.js';

const id = 'cmtcrw6oa000713rrppoh1ijp';
const a = await prisma.approval.findUnique({ where: { id } });
console.log(a ? {
  id: a.id,
  title: a.title,
  type: a.type,
  status: a.status,
  applicant: a.applicant,
  project_id: a.project_id,
  project_name: a.project_name,
  steps: a.steps,
  fields: a.fields,
  cc_list: a.cc_list,
  amount: a.amount,
} : 'NOT FOUND');

await prisma['$disconnect']();
