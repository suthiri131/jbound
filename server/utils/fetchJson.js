import { HttpError } from './httpError.js';

/** fetch() wrapper with timeout + JSON parsing + upstream error mapping (502). */
export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(502, `Upstream ${new URL(url).host} responded ${res.status}`, body.slice(0, 300));
    }
    return await res.json();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const reason = err.name === 'AbortError' ? 'timed out' : err.message;
    throw new HttpError(502, `Upstream ${new URL(url).host} ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}
