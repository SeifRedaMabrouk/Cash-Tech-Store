// Exports products, settings, audit log and uploaded images from Neon to a local folder: npm run backup
// (Neon also keeps its own point-in-time history; this is your own copy outside Neon.)
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { storage } from '../server/storage.mjs';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('out') ?? process.env.BACKUP_DIR ?? 'backups');
const keep = Math.max(1, Number(arg('keep') ?? 14));
const dir = path.join(root, 'cashtech-' + new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(path.join(dir, 'uploads'), { recursive: true, mode: 0o700 });
const store = storage();
try {
  for (const table of ['products', 'settings', 'audit_log'])
    writeFileSync(path.join(dir, table + '.json'), JSON.stringify((await store.query(`SELECT * FROM ${table}`)).rows, null, 2), { mode: 0o600 });
  for (const row of (await store.query('SELECT key, data FROM uploads')).rows)
    writeFileSync(path.join(dir, 'uploads', row.key), row.data, { mode: 0o600 });
} finally {
  await store.close();
}
const old = readdirSync(root).filter((n) => /^cashtech-\d{4}-/.test(n)).sort().slice(0, -keep);
for (const name of old) rmSync(path.join(root, name), { recursive: true, force: true });
console.log(`تم إنشاء النسخة الاحتياطية: ${dir}${old.length ? ` (حُذفت ${old.length} نسخة قديمة)` : ''}`);
