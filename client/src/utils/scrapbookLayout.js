import { dateRange, shortDate } from './format.js';

export const MIN_PHOTO_SLOTS = 3;
export const PHOTOS_PER_PAGE = 2;
export const STOPS_PER_PAGE = 3;

const INKS = ['#9E3B1B', '#3C2A21', '#2F4A5A', '#5C6B2E'];
const PAPERS = ['#E8D9B5', '#DCCBA3', '#EFE3C6', '#D9C4A0'];
const STAMP_WORDS = ['PASSED', 'ARRIVED', 'KEPT', 'BORDER OK', 'JB ⇄ SG', 'APPROVED'];

/** FNV-1a hash of a string to an unsigned 32-bit number */
export function hashSeed(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 generator: returns a function giving floats in [0, 1) */
export function seededRandom(...parts) {
  let state = hashSeed(parts.join(':'));
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng, min, max) => Math.round((min + rng() * (max - min)) * 10) / 10;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const sgd = (amount) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(amount);
const expenseAmount = (expense) => Number(expense.amount_sgd ?? expense.amount ?? 0);

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** What holds a polaroid down: two tape strips, a push pin, or photo corners */
function fastener(rng) {
  const roll = rng();
  if (roll < 0.5) return { type: 'tape', angles: [between(rng, -34, -14), between(rng, 14, 34)], paper: pick(rng, PAPERS) };
  if (roll < 0.8) return { type: 'pin', ink: pick(rng, INKS), left: between(rng, 35, 65) };
  return { type: 'corners' };
}

/** Ink splatters, paper scraps and rubber stamps, kept to the page margins */
function decorations(rng, stampWords, { bottomOnly = false } = {}) {
  const count = 1 + Math.floor(rng() * 3);
  return Array.from({ length: count }, (_, i) => {
    const type = pick(rng, ['splatter', 'scrap', 'stamp']);
    const base = {
      id: `decor-${i}`,
      type,
      top: !bottomOnly && rng() < 0.5 ? between(rng, 2, 8) : between(rng, 86, 92),
      // either side of the page number, which sits bottom-centre
      left: rng() < 0.5 ? between(rng, 6, 26) : between(rng, 58, 74),
      rotation: between(rng, -25, 25),
    };
    if (type === 'splatter') return { ...base, size: between(rng, 7, 13), ink: pick(rng, INKS), opacity: between(rng, 0.14, 0.3) };
    if (type === 'scrap') return { ...base, width: between(rng, 14, 24), height: between(rng, 5, 9), paper: pick(rng, PAPERS) };
    return { ...base, text: pick(rng, stampWords), ink: pick(rng, INKS) };
  });
}

/**
 * @param {{ trip: object, memories?: object[], expenses?: object[], canUpload?: boolean }} data
 * @returns {object[]} pages in reading order: front cover first, back cover last, always an even count
 */
export function buildScrapbookPages({ trip, memories = [], expenses = [], canUpload = false }) {
  if (!trip) return [];
  const seed = trip.id;
  const stops = trip.itinerary || [];
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const ticked = stops.filter((stop) => stop.done);
  const total = expenses.reduce((sum, expense) => sum + expenseAmount(expense), 0);
  const dates = dateRange(trip.start_date, trip.end_date);
  const year = trip.start_date?.slice(0, 4) || '';
  const stampWords = [...STAMP_WORDS, trip.start_date ? `${shortDate(trip.start_date).slice(4).toUpperCase()} ${year}` : 'ON THE ROAD'];

  const photos = memories.map((memory, i) => {
    const stop = stopById.get(memory.stop?.id) || memory.stop || null;
    return {
      id: `photo-${memory.id}`,
      kind: 'photo',
      image: memory.image_url,
      caption: memory.caption || stop?.title || 'A moment worth keeping',
      author: memory.author?.name,
      day: stop?.day || memory.created_at?.slice(0, 10),
      order: i,
    };
  });
  // a scrapbook with one or two photos looks empty, so pad it with blank polaroids
  for (let i = photos.length; i < MIN_PHOTO_SLOTS; i++) {
    photos.push({
      id: `placeholder-${i}`,
      kind: 'placeholder',
      caption: stops[i % Math.max(stops.length, 1)]?.title || 'Your crew’s photos go here',
      prompt: canUpload ? 'Add a photo from the Memory Box' : 'A photo belongs here',
    });
  }

  // handwritten notes rotate through ticked stops, the trip dates and the ledger total
  const notes = [
    ...ticked.map((stop) => (stop.day ? `${stop.title} · ${shortDate(stop.day)}` : stop.title)),
    dates,
    total ? `${sgd(total)} spent together` : 'Not a cent argued over',
  ];

  const content = [];
  chunk(photos, PHOTOS_PER_PAGE).forEach((group, pageIndex) => {
    const rng = seededRandom(seed, 'photos', pageIndex);
    const mirrored = pageIndex % 2 === 1;
    content.push({
      id: `photos-${pageIndex}`,
      kind: 'photos',
      items: group.map((item, slot) => {
        const left = slot === 0 ? between(rng, 6, 16) : between(rng, 34, 44);
        return {
          ...item,
          top: slot === 0 ? between(rng, 5, 9) : between(rng, 51, 55),
          left: mirrored ? 100 - 50 - left : left,
          rotation: between(rng, -6, 6),
          fastener: fastener(rng),
        };
      }),
      note: { text: notes[pageIndex % notes.length], rotation: between(rng, -4, 4), left: between(rng, 10, 30) },
      decor: decorations(rng, stampWords),
    });
  });

  chunk(ticked.length ? ticked : stops, STOPS_PER_PAGE).forEach((group, pageIndex) => {
    const rng = seededRandom(seed, 'bucket', pageIndex);
    content.push({
      id: `bucket-${pageIndex}`,
      kind: 'bucket',
      heading: ticked.length ? 'Bucket list, ticked off' : 'Where the road went',
      stops: group.map((stop) => ({
        id: stop.id,
        title: stop.title,
        note: stop.notes || (stop.done ? 'One for the memory book.' : 'A stop on the road.'),
        day: stop.day ? shortDate(stop.day) : '',
        done: Boolean(stop.done),
        rotation: between(rng, -3.5, 3.5),
        shift: between(rng, -6, 6),
      })),
      // these pages have a heading along the top margin
      decor: decorations(rng, stampWords, { bottomOnly: true }),
    });
  });

  const ledgerRng = seededRandom(seed, 'ledger');
  content.push({
    id: 'ledger',
    kind: 'ledger',
    total: sgd(total),
    count: expenses.length,
    lines: [...expenses]
      .sort((a, b) => expenseAmount(b) - expenseAmount(a))
      .slice(0, 5)
      .map((expense, i) => ({ id: expense.id ?? i, label: expense.description || 'Shared expense', amount: sgd(expenseAmount(expense)) })),
    rotation: between(ledgerRng, -3, 3),
    decor: decorations(ledgerRng, stampWords, { bottomOnly: true }),
  });

  // cover + title + content + endpaper + back cover must be even so the back cover sits alone
  if (content.length % 2 === 1) {
    content.push({ id: 'notes', kind: 'notes', lines: [dates, `${stops.length} stops · ${ticked.length} ticked`, 'Same friends. New adventures.'] });
  }

  const pages = [
    { id: 'cover', kind: 'cover', name: trip.name, dates, color: trip.cover_color || '#70452f', year },
    {
      id: 'title',
      kind: 'title',
      name: trip.name,
      dates,
      mission: trip.mission,
      crew: (trip.members || []).map((member) => member.name).filter(Boolean),
      stats: { stops: stops.length, ticked: ticked.length, photos: memories.length, total: sgd(total) },
    },
    ...content,
    { id: 'endpaper', kind: 'endpaper' },
    { id: 'back-cover', kind: 'back-cover', color: trip.cover_color || '#70452f' },
  ];
  // printed page numbers for the paper pages between the covers
  return pages.map((page, i) => (i === 0 || i === pages.length - 1 ? page : { ...page, number: i }));
}
