// Clears login lockouts (e.g. after someone typed wrong passwords many times). Run from your computer: npm run admin:unlock
import { storage } from './storage.mjs';
const store = storage();
try {
  const r = await store.DB.prepare('DELETE FROM login_limits').run();
  console.log(`تم فك قفل الدخول (${r.meta.changes} سجل). Login lockouts cleared.`);
} finally {
  await store.close();
}
