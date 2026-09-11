import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  await p.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_updated_date_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_date = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);
  console.log('trigger function ensured');

  await p.$executeRawUnsafe('DROP TRIGGER IF EXISTS update_memos_updated_date ON memos');
  await p.$executeRawUnsafe(`
    CREATE TRIGGER update_memos_updated_date BEFORE UPDATE ON memos
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column()
  `);
  console.log('memos trigger created');

  const triggers = await p.$queryRaw`SELECT trigger_name FROM information_schema.triggers WHERE event_object_table='memos'`;
  console.log('memos triggers now:', triggers.map(t => t.trigger_name).join(', '));
} catch (e) {
  console.error('ERROR:', e.message);
}
await p.$disconnect();
