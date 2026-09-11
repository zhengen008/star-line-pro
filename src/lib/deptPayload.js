/**
 * Strip UI-only / read-only fields before Department create/update.
 * Prevents Prisma "Unknown argument" errors (e.g. computed_count).
 */
const ALLOWED = new Set([
  'name',
  'code',
  'head',
  'head_open_id',
  'feishu_dept_id',
  'parent_dept_id',
  'member_count',
  'status',
]);

export function toDepartmentWritePayload(form = {}) {
  const data = {};
  for (const key of ALLOWED) {
    if (Object.prototype.hasOwnProperty.call(form, key) && form[key] !== undefined) {
      data[key] = form[key];
    }
  }
  if (typeof data.name === 'string') data.name = data.name.trim();
  if (data.code === '') data.code = null;
  if (data.head === '') data.head = null;
  return data;
}
