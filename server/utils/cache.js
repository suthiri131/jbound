/**
 * Tiny in-memory TTL cache. Protects the free external APIs
 * (LTA, Frankfurter, Open Service Routing) from being hammered by auto-refreshing widgets.
 * Resets on server restart, which is fine for this project.
 */
const store = new Map();

export async function cached(key, ttlMs, loader) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loader();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function clearCache() {
  store.clear();
}
