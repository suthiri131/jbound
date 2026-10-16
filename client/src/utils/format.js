export function initials(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

export function timeAgo(iso) {
  if (!iso) return "just now";

  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "just now";

  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Database DATE values are calendar dates; parse locally to avoid UTC shifting the day.
const asDate = (iso) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);

export function shortDate(iso) {
  if (!iso) return "";
  const d = asDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longDate(iso) {
  if (!iso) return "";
  const d = asDate(iso);
  return `${FULL_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateRange(start, end) {
  if (!start) return "No dates yet";
  if (!end || end === start) return shortDate(start);
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function dayLabel(start, day) {
  if (!day) return "Unscheduled";
  if (!start) return shortDate(day);
  const diff = Math.round((asDate(day) - asDate(start)) / 86_400_000);
  return diff >= 0 ? `Day ${diff + 1}` : shortDate(day);
}

export const hhmm = (t) => (t ? String(t).slice(0, 5) : "");
