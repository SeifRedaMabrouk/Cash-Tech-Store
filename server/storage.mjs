// Postgres (Neon) storage. Exposes the same small D1-style interface the API routes already use:
//   DB.prepare(sql).bind(...).first() / .all() / .run(),  DB.batch([...])  and  BUCKET.put/get (images live in the uploads table).
// SQL is written with "?" placeholders and converted to $1, $2, ... here.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool, types } = pg;
// Timestamps in milliseconds are stored as BIGINT; return them as numbers (they fit safely in a double).
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

export function toPg(sql) {
  let n = 0;
  let inQuote = false;
  let out = '';
  for (const ch of sql) {
    if (ch === "'") inQuote = !inQuote;
    out += ch === '?' && !inQuote ? '$' + ++n : ch;
  }
  return out;
}

function poolConfig(url) {
  const u = new URL(url);
  // pg is configured explicitly below; Neon's sslmode/channel_binding query params are not needed.
  u.searchParams.delete('sslmode');
  u.searchParams.delete('channel_binding');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  return {
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000, // a sleeping Neon compute can take a few seconds to wake up
  };
}

const KEY = /^[a-f0-9-]+\.(png|jpg|webp)$/;
const TYPE = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export function storage(url = process.env.DATABASE_URL) {
  if (!url)
    throw new Error(
      'DATABASE_URL is not set. Put the Neon connection string in DATABASE_URL.\nلم يتم ضبط DATABASE_URL. ضع رابط الاتصال بقاعدة Neon فيه.',
    );
  const pool = new Pool(poolConfig(url));
  pool.on('error', (e) => console.error(new Date().toISOString(), 'database pool error', e.message));

  function prepare(sql) {
    const text = toPg(sql);
    let args = [];
    const handle = {
      text,
      get args() {
        return args;
      },
      bind(...values) {
        args = values;
        return handle;
      },
      async first() {
        return (await pool.query(text, args)).rows[0] ?? null;
      },
      async all() {
        return { results: (await pool.query(text, args)).rows };
      },
      async run() {
        const r = await pool.query(text, args);
        return { meta: { changes: r.rowCount ?? 0 }, success: true };
      },
    };
    return handle;
  }

  const DB = {
    prepare,
    // All statements succeed together or none of them is applied.
    async batch(statements) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const results = [];
        for (const s of statements) {
          const r = await client.query(s.text, s.args);
          results.push({ meta: { changes: r.rowCount ?? 0 }, success: true });
        }
        await client.query('COMMIT');
        return results;
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        throw e;
      } finally {
        client.release();
      }
    },
  };

  const BUCKET = {
    async put(key, bytes) {
      if (!KEY.test(key)) throw new Error('Invalid key');
      await pool.query('INSERT INTO uploads(key,content_type,data,created_at) VALUES($1,$2,$3,$4)', [
        key,
        TYPE[key.split('.').pop()],
        Buffer.from(bytes),
        Date.now(),
      ]);
    },
    async get(key) {
      if (!KEY.test(key)) return null;
      const row = (await pool.query('SELECT content_type,data FROM uploads WHERE key=$1', [key])).rows[0];
      if (!row) return null;
      return { body: new Uint8Array(row.data), httpMetadata: { contentType: row.content_type } };
    },
  };

  // Deletes uploaded images that no product references and that are older than maxAgeMs (abandoned or replaced uploads).
  async function sweepUploads(maxAgeMs = 24 * 3600 * 1000) {
    const r = await pool.query(
      'DELETE FROM uploads u WHERE u.created_at < $1 AND NOT EXISTS (SELECT 1 FROM products p WHERE position(u.key in p.images) > 0)',
      [Date.now() - maxAgeMs],
    );
    return r.rowCount ?? 0;
  }

  async function ensureSchema() {
    await pool.query(readFileSync(new URL('../drizzle/postgres-schema.sql', import.meta.url), 'utf8'));
  }

  return {
    DB,
    BUCKET,
    sweepUploads,
    ensureSchema,
    query: (text, args) => pool.query(text, args),
    close: () => pool.end(),
  };
}
