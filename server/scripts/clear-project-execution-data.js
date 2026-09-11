import prisma from '../src/lib/prisma.js';

const projectItems = await prisma.executionItem.findMany({
  where: { project_id: { not: null } },
  select: { id: true },
});
const ids = projectItems.map((i) => i.id);

const deletedSuppliers = ids.length
  ? await prisma.supplierItem.deleteMany({ where: { execution_item_id: { in: ids } } })
  : { count: 0 };

const deletedItems = await prisma.executionItem.deleteMany({
  where: { project_id: { not: null } },
});

const deletedSheets = await prisma.executionSheet.deleteMany({});

const catalogCount = await prisma.executionItem.count({ where: { project_id: null } });

console.log(JSON.stringify({
  deletedSupplierItems: deletedSuppliers.count,
  deletedProjectExecutionItems: deletedItems.count,
  deletedExecutionSheets: deletedSheets.count,
  serviceCatalogKept: catalogCount,
}, null, 2));

await prisma.$disconnect();
