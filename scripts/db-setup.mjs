// Creates the tables in the Neon database (safe to run more than once): npm run db:setup
import { storage } from '../server/storage.mjs';
const store = storage();
try {
  await store.ensureSchema();
  const col = await store.query(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND ((table_name='products' AND column_name IN ('available','hidden','sample','featured','price')) OR (table_name='sessions' AND column_name='expires'))",
  );
  const expected = (r) => (r.table_name === 'sessions' ? 'bigint' : 'integer');
  const bad = col.rows.filter((r) => r.data_type !== expected(r));
  if (bad.length) {
    console.error(
      'جداول قديمة بأنواع أعمدة مختلفة: ' + bad.map((r) => `${r.table_name}.${r.column_name}=${r.data_type}`).join(', ') +
        '\nلو الجداول فاضية: احذفها من Neon SQL Editor (DROP TABLE audit_log, products, settings CASCADE;) ثم أعد تشغيل npm run db:setup',
    );
    process.exitCode = 1;
  } else console.log('الجداول جاهزة. Database schema is ready.');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await store.close();
}
