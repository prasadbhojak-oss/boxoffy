// Proxy for the Boxoffy Apps Script Web App.
// Exists so server-side callers get JSON directly instead of a cross-host 302 to
// script.googleusercontent.com, which non-browser HTTP clients will not follow.
// Set GAS_URL in the host's environment settings, not in the repo.

const ALLOWED = new Set([
  "ping", "getFilms", "getWeekly",
  "updateFilm", "bulkUpdate", "updateWeek",
  "addFilm", "createFilm", "insertFilm",
  "getState", "setState",
]);

export default async function handler(req, res) {
  const q = { ...req.query };
  const action = q.action || (q.ping ? "ping" : "");

  if (!ALLOWED.has(action)) {
    return res.status(400).json({ ok: false, error: "action not allowed" });
  }
  if (!process.env.GAS_URL) {
    return res.status(500).json({ ok: false, error: "GAS_URL not configured" });
  }

  try {
    const r = await fetch(`${process.env.GAS_URL}?${new URLSearchParams(q)}`, {
      redirect: "follow",
    });
    const body = await r.text();
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e.message || e) });
  }
}
