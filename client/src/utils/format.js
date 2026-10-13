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
