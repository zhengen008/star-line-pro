import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const ENTITIES = [
  'Employee', 'Department', 'Role', 'Bid', 'Project', 'ProjectLog',
  'Approval', 'ProjectApproval', 'WorkflowTemplate', 'Notice',
  'Notification', 'Banner', 'CheckIn', 'Memo',
  'ExecutionItem', 'SupplierItem', 'ExecutionSheet',
];

// Convert Prisma result: Decimal → Number, dates → ISO strings
function serialize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serialize);
  if (typeof obj === 'object') {
    // Prisma Decimal: check for toNumber method or internal {s, e, d} structure
    if (typeof obj.toNumber === 'function') return obj.toNumber();
    if (obj.s !== undefined && obj.e !== undefined && Array.isArray(obj.d)) {
      // Prisma Decimal internal representation: {s:1, e:4, d:[15000]} = 15000 * 10^(-4) = 1.5
      let num = Number(obj.d.join('')) * Math.pow(10, obj.e);
      return obj.s === -1 ? -num : num;
    }
    if (obj instanceof Date) return obj.toISOString();
    if (obj.constructor?.name === 'Decimal') return Number(obj);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = serialize(value);
      }
    }
    return result;
  }
  return obj;
}

// Parse filter query (MongoDB-style) to Prisma where
function parseFilter(q) {
  if (!q) return {};
  let filter;
  try {
    filter = typeof q === 'string' ? JSON.parse(q) : q;
  } catch {
    return {};
  }
  return convertFilter(filter);
}

function convertFilter(filter) {
  if (!filter || typeof filter !== 'object') return filter;

  const result = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) {
      // Logical operators
      if (key === '$or' && Array.isArray(value)) {
        result.OR = value.map(convertFilter);
      } else if (key === '$and' && Array.isArray(value)) {
        result.AND = value.map(convertFilter);
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Operator object: { $gt, $lt, $ne, etc. }
      const ops = {};
      for (const [op, opVal] of Object.entries(value)) {
        switch (op) {
          case '$gt': ops.gt = opVal; break;
          case '$gte': ops.gte = opVal; break;
          case '$lt': ops.lt = opVal; break;
          case '$lte': ops.lte = opVal; break;
          case '$ne': ops.not = opVal; break;
          case '$in':
            ops.in = Array.isArray(opVal) ? opVal : [opVal];
            break;
          case '$nin':
            ops.notIn = Array.isArray(opVal) ? opVal : [opVal];
            break;
          case '$regex':
            ops.contains = opVal;
            ops.mode = 'insensitive';
            break;
          case '$exists':
            if (opVal === false) ops.equals = null;
            break;
          default:
            break;
        }
      }
      result[key] = Object.keys(ops).length > 0 ? ops : value;
    } else if (value === null) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Parse sort parameter
function parseSort(sortBy) {
  if (!sortBy) return { created_date: 'desc' };
  const fields = sortBy.split(',').filter(Boolean);
  const orderBy = [];
  for (const field of fields) {
    const trimmed = field.trim();
    if (trimmed.startsWith('-')) {
      orderBy.push({ [trimmed.slice(1)]: 'desc' });
    } else {
      const f = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
      orderBy.push({ [f]: 'asc' });
    }
  }
  return orderBy.length > 0 ? orderBy : { created_date: 'desc' };
}

// All routes require auth
router.use(authRequired);

// GET /:entity - List records with optional filtering, sorting, pagination
router.get('/:entity', async (req, res) => {
  try {
    const { entity } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    const { q, limit = 100, skip = 0 } = req.query;
    const sortBy = req.query.sort_by || '-created_date';

    const where = parseFilter(q);
    const orderBy = parseSort(sortBy);
    const take = Math.min(parseInt(limit) || 100, 5000);
    const skipNum = parseInt(skip) || 0;

    // Project：排除软删除 + 数据权限过滤
    if (entity === 'Project') {
      where.is_deleted = false;
      const userName = req.user?.name || '';
      const employee = userName ? await prisma.employee.findFirst({ where: { name: userName } }) : null;
      const isAdmin = employee?.role === '管理员';
      // 一级负责人（竞标管理中选择的商务负责人）可以看到所有项目
      let isBizHead = false;
      if (userName) {
        isBizHead = (await prisma.bid.findFirst({ where: { manager: userName }, select: { id: true } })) !== null;
      }
      if (!isAdmin && !isBizHead) {
        // 二级负责人（项目负责人）/三级负责人（项目成员）只能看到自己参与的项目
        const ownFilter = userName
          ? { OR: [{ manager: userName }, { members: { has: userName } }] }
          : { id: '__no_permission__' }; // 无身份信息则不可见
        where.AND = [...(where.AND || []), ownFilter];
      }
    }

    const records = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].findMany({
      where,
      orderBy,
      take,
      skip: skipNum,
    });

    res.json(serialize(records));
  } catch (error) {
    console.error(`GET /entities/${req.params.entity} error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /:entity - Create record
router.post('/:entity', async (req, res) => {
  try {
    const { entity } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    const data = {
      ...req.body,
      created_by: req.user?.email || req.user?.name || null,
      created_by_id: req.user?.open_id || null,
    };

    // Remove id/created_date/updated_date if present (auto-generated)
    delete data.id;
    delete data.created_date;
    delete data.updated_date;

    const record = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].create({ data });

    res.json(serialize(record));
  } catch (error) {
    console.error(`POST /entities/${req.params.entity} error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:entity/:id - Get record by ID
router.get('/:entity/:id', async (req, res) => {
  try {
    const { entity, id } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    const record = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].findUnique({ where: { id } });
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json(serialize(record));
  } catch (error) {
    console.error(`GET /entities/${req.params.entity}/:id error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:entity/:id - Update record
router.put('/:entity/:id', async (req, res) => {
  try {
    const { entity, id } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    const existing = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const data = { ...req.body };
    delete data.id;
    delete data.created_date;
    delete data.updated_date;
    delete data.created_by;
    delete data.created_by_id;

    const record = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].update({
      where: { id },
      data,
    });

    res.json(serialize(record));
  } catch (error) {
    console.error(`PUT /entities/${req.params.entity}/:id error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:entity/:id - Delete record (soft delete for Project, hard for others)
router.delete('/:entity/:id', async (req, res) => {
  try {
    const { entity, id } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    if (entity === 'Project') {
      // Soft delete
      await prisma.project.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: req.user?.name || null,
        },
      });
    } else {
      await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].delete({ where: { id } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /entities/${req.params.entity}/:id error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /:entity/:id/restore - Restore soft-deleted record
router.post('/:entity/:id/restore', async (req, res) => {
  try {
    const { entity, id } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    if (entity === 'Project') {
      await prisma.project.update({
        where: { id },
        data: {
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        },
      });
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Restore not supported for this entity' });
    }
  } catch (error) {
    console.error(`POST /entities/${req.params.entity}/:id/restore error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /:entity/bulk - Bulk create
router.post('/:entity/bulk', async (req, res) => {
  try {
    const { entity } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }

    const userInfo = {
      created_by: req.user?.email || req.user?.name || null,
      created_by_id: req.user?.open_id || null,
    };

    const created = [];
    for (const item of items) {
      const data = { ...item, ...userInfo };
      delete data.id;
      delete data.created_date;
      delete data.updated_date;
      const record = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].create({ data });
      created.push(serialize(record));
    }

    res.json(created);
  } catch (error) {
    console.error(`POST /entities/${req.params.entity}/bulk error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /:entity/update-many - Update many records by query
router.post('/:entity/update-many', async (req, res) => {
  try {
    const { entity } = req.params;
    if (!ENTITIES.includes(entity)) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }

    const { query, data } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query filter is required' });
    }

    const where = parseFilter(query);
    const updateData = { ...data };
    delete updateData.id;
    delete updateData.created_date;
    delete updateData.updated_date;

    // Handle $set, $inc, $push, $pull operators
    if (updateData.$set || updateData.$inc || updateData.$push || updateData.$pull) {
      const prismaData = {};
      if (updateData.$set) Object.assign(prismaData, updateData.$set);
      delete updateData.$set;
      delete updateData.$inc;
      delete updateData.$push;
      delete updateData.$pull;
      Object.assign(prismaData, updateData);

      const result = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].updateMany({
        where,
        data: prismaData,
      });
      res.json({ success: true, updated: result.count, has_more: false });
    } else {
      const result = await prisma[entity.charAt(0).toLowerCase() + entity.slice(1)].updateMany({
        where,
        data: updateData,
      });
      res.json({ success: true, updated: result.count, has_more: false });
    }
  } catch (error) {
    console.error(`POST /entities/${req.params.entity}/update-many error:`, error);
    res.status(500).json({ error: error.message });
  }
});

export { router as entitiesRouter };
