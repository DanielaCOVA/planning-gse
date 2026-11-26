// Guarda los cambios del Planning de Rodaje en Netlify Blobs.
// Todo vive en un solo registro para que cada lectura sea una sola operación (gasta lo mínimo).
import { getStore } from "@netlify/blobs";

const VALID = /^(planning\/[A-Za-z0-9_-]{1,40}|material\/lista)$/;
const KEY = "estado";

function merge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) {
    o[k] = v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])
      ? merge(o[k], v) : v;
  }
  return o;
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const code = process.env.ACCESS_CODE || "";
  if (code && req.headers.get("x-team-code") !== code) return json({ error: "code" }, 401);
  const store = getStore({ name: "planning-rodaje", consistency: "strong" });
  const read = async () => (await store.get(KEY, { type: "json" })) || { docs: {} };

  if (req.method === "GET") {
    const s = await read();
    return json({ docs: s.docs || {} });
  }
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "json" }, 400); }
    const { path, patch } = body || {};
    if (typeof path !== "string" || !VALID.test(path) || !patch || typeof patch !== "object" || Array.isArray(patch))
      return json({ error: "bad request" }, 400);
    if (JSON.stringify(patch).length > 200000) return json({ error: "too large" }, 413);
    const s = await read();
    s.docs = s.docs || {};
    s.docs[path] = merge(s.docs[path] || {}, patch);
    await store.setJSON(KEY, s);
    return json({ ok: true });
  }
  return json({ error: "method" }, 405);
};

export const config = { path: "/api/planning" };
