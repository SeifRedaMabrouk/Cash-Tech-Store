import { scrypt, randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256)
    throw new Error('كلمة المرور يجب أن تكون من ١٢ إلى ٢٥٦ حرفًا');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [salt, hex] = encoded.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// `DB` is the D1-style interface from storage.mjs.
export async function createAdmin(DB, email, password, reset = false) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('بريد غير صالح');
  email = email.trim().toLowerCase();
  const existing = await DB.prepare('SELECT id FROM admins WHERE email=?').bind(email).first();
  if (existing && !reset) throw new Error('الحساب موجود بالفعل؛ استخدم --reset لتغيير كلمة مروره');
  const hash = await hashPassword(password);
  if (existing) {
    await DB.batch([
      DB.prepare('UPDATE admins SET password_hash=? WHERE id=?').bind(hash, existing.id),
      DB.prepare('DELETE FROM sessions WHERE admin_id=?').bind(existing.id),
    ]);
  } else
    await DB.prepare('INSERT INTO admins(id,email,password_hash) VALUES(?,?,?)')
      .bind(randomUUID(), email, hash)
      .run();
}
const digest = (s) => createHash('sha256').update(s).digest('hex');
function tokenFrom(cookie = '', name = 'cashtech_session') {
  return cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.slice(name.length + 1);
}
export async function userFor(DB, cookie = '', name = 'cashtech_session') {
  const token = tokenFrom(cookie, name);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await DB.prepare(
    'SELECT admins.id,admins.email FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE sessions.hash=? AND sessions.expires>?',
  )
    .bind(digest(token), Date.now())
    .first();
  return row ? { userId: row.id, email: row.email } : null;
}
export async function login(DB, email, password, ip) {
  email = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
  const now = Date.now();
  // Limits are per client IP and per IP+account pair only. There is deliberately no global
  // per-account cap: it let an attacker spread guesses over many addresses and lock the real owner out.
  // Brute force stays impractical (10 tries / 15 min per address + scrypt hashing).
  const keys = [
    ['ip:' + ip, 30],
    ['pair:' + digest(ip + '|' + email), 10],
  ];
  await DB.prepare('DELETE FROM login_limits WHERE expires<=?').bind(now).run();
  for (const [key, max] of keys) {
    const row = await DB.prepare('SELECT attempts FROM login_limits WHERE key=?').bind(key).first();
    if ((row?.attempts ?? 0) >= max) return { status: 429 };
  }
  // Reserve the attempt before the slow password check so parallel guesses cannot bypass the limit.
  for (const [key] of keys)
    await DB.prepare(
      'INSERT INTO login_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=login_limits.attempts+1, expires=EXCLUDED.expires',
    )
      .bind(key, now + 15 * 60000)
      .run();
  const admin = await DB.prepare('SELECT * FROM admins WHERE email=?').bind(email).first();
  const valid = await verifyPassword(
    password,
    admin?.password_hash ?? '0'.repeat(32) + ':' + '0'.repeat(128),
  );
  if (!admin || !valid) return { status: 401 };
  await DB.prepare('DELETE FROM login_limits WHERE key=?').bind(keys[1][0]).run();
  await DB.prepare('UPDATE login_limits SET attempts=GREATEST(attempts-1,0) WHERE key=?').bind(keys[0][0]).run();
  await DB.prepare('DELETE FROM sessions WHERE expires<=?').bind(now).run();
  const token = randomBytes(32).toString('hex');
  await DB.prepare('INSERT INTO sessions(hash,admin_id,expires) VALUES(?,?,?)')
    .bind(digest(token), admin.id, now + 8 * 3600000)
    .run();
  return { status: 200, token };
}
export async function logout(DB, cookie = '', name = 'cashtech_session') {
  const token = tokenFrom(cookie, name);
  if (token) await DB.prepare('DELETE FROM sessions WHERE hash=?').bind(digest(token)).run();
}
