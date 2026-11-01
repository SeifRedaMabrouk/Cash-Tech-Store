// Vercel entry point: every request that is not a static file is rewritten here (see vercel.json).
import { createHandler } from '../server/index.mjs';

let ready;
export default async function handler(req, res) {
  try {
    ready ??= createHandler().then((r) => r.handler);
    await (await ready)(req, res);
  } catch (e) {
    ready = undefined; // retry initialisation on the next request
    console.error(new Date().toISOString(), 'startup/request failed', e);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ error: 'تعذر إتمام الطلب الآن' }));
    }
  }
}
