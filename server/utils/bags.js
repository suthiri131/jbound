export const BAG_KINDS = [
  { id: 'rucksack', label: 'Explorer rucksack' },
  { id: 'daypack', label: 'Day pack' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'tote', label: 'Tote' },
  { id: 'satchel', label: 'Satchel' },
];

export const BAG_BADGES = [
  { id: 'mushroom', label: 'Mushroom' },
  { id: 'mountain', label: 'Mountain' },
  { id: 'compass', label: 'Compass' },
  { id: 'star', label: 'Star' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'heart', label: 'Heart' },
  { id: 'sun', label: 'Sunny day' },
  { id: 'durian', label: 'Durian' },
];
export const MAX_BADGES = 4;

// what each style wears until someone changes it
export const DEFAULT_BADGES = {
  rucksack: [],
  daypack: ['star'],
  messenger: ['mushroom', 'compass', 'mountain', 'star'],
  tote: [],
  satchel: [],
};

// the trip cover colours, softened into the storybook palette the bags are painted in
const SOFT = {
  '#2e5a3c': '#7d9a52', // green  -> moss
  '#b4471f': '#c9673e', // red    -> rust orange
  '#1f4e5a': '#8f9fcb', // teal   -> periwinkle
  '#8a5a2b': '#a4643a', // brown  -> saddle leather
  '#5a3e6b': '#a184b4', // purple -> lilac
};
export function bagColour(coverColor) {
  const c = String(coverColor || '#2e5a3c').toLowerCase();
  return SOFT[c] || `color-mix(in srgb, ${c} 72%, #f3e3bd)`;
}

function hash(id) {
  const s = String(id ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); // FNV-1a: similar ids still differ
  h ^= h >>> 15;
  return Math.imul(h, 2246822519) >>> 0;
}

const KIND_IDS = BAG_KINDS.map((k) => k.id);
const BADGE_IDS = BAG_BADGES.map((b) => b.id);

/** The trip's chosen bag, or the one its id picks. */
export function bagKindFor(trip) {
  if (KIND_IDS.includes(trip?.bag_kind)) return trip.bag_kind;
  return KIND_IDS[hash(trip?.id) % KIND_IDS.length];
}

/** The trip's chosen badges, or the default ones for that bag. */
export function bagBadgesFor(trip, kind = bagKindFor(trip)) {
  if (Array.isArray(trip?.bag_badges)) return trip.bag_badges.filter((b) => BADGE_IDS.includes(b)).slice(0, MAX_BADGES);
  return DEFAULT_BADGES[kind] || [];
}