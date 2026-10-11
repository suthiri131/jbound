/**
 * Only allow same-site paths for ?next=, so a crafted link can't send someone to another website.
 * Anything odd falls back to the home page.
 */
export function safeRedirect(next, fallback = '/') {
  const value = Array.isArray(next) ? next[0] : next;
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/^\/(sign-in|sign-up)(\/|\?|#|$)/.test(value)) return fallback; // avoid redirect loops
  return value;
}