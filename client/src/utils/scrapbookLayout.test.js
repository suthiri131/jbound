import { describe, expect, it } from 'vitest';
import { buildScrapbookPages, FALLBACK_CAPTIONS, MIN_PHOTO_SLOTS, seededRandom } from './scrapbookLayout.js';

const trip = {
  id: 'trip-1',
  name: 'Weekend in JB',
  start_date: '2026-10-01',
  end_date: '2026-10-03',
  members: [{ name: 'Coen' }, { name: 'Amos' }],
  itinerary: [
    { id: 's1', title: 'Bazaar Karat', day: '2026-10-01', done: true },
    { id: 's2', title: 'Glass Temple', day: '2026-10-02', done: false },
  ],
};
const memories = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, image_url: `/p${i}.jpg`, stop: { id: 's1', title: 'Bazaar Karat' } }));
const polaroids = (pages) => pages.filter((p) => p.kind === 'photos').flatMap((p) => p.items);

describe('buildScrapbookPages', () => {
  it('gives the same layout for the same trip id and a different one for another trip', () => {
    const a = buildScrapbookPages({ trip, memories });
    expect(buildScrapbookPages({ trip, memories })).toEqual(a);
    const b = buildScrapbookPages({ trip: { ...trip, id: 'trip-2' }, memories });
    expect(polaroids(b).map((p) => p.rotation)).not.toEqual(polaroids(a).map((p) => p.rotation));
  });

  it('gives uncaptioned, untagged photos different fallback captions, the same each time', () => {
    const bare = Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, image_url: `/b${i}.jpg` }));
    const captions = polaroids(buildScrapbookPages({ trip, memories: bare })).map((p) => p.caption);
    expect(new Set(captions).size).toBe(4);
    for (const caption of captions) expect(FALLBACK_CAPTIONS).toContain(caption);
    expect(polaroids(buildScrapbookPages({ trip, memories: bare })).map((p) => p.caption)).toEqual(captions);
  });

  it('tilts every polaroid between -6 and +6 degrees and holds it down with tape, a pin or corners', () => {
    const items = polaroids(buildScrapbookPages({ trip, memories }));
    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(Math.abs(item.rotation)).toBeLessThanOrEqual(6);
      expect(['tape', 'pin', 'corners']).toContain(item.fastener.type);
    }
  });

  it('pads trips with few photos with blank polaroids and always has an even page count', () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      const pages = buildScrapbookPages({ trip, memories: memories.slice(0, count) });
      const items = polaroids(pages);
      expect(items).toHaveLength(Math.max(count, MIN_PHOTO_SLOTS));
      expect(items.filter((i) => i.kind === 'placeholder')).toHaveLength(Math.max(0, MIN_PHOTO_SLOTS - count));
      expect(pages.length % 2).toBe(0);
      expect(pages[0].kind).toBe('cover');
      expect(pages[1].kind).toBe('title');
      expect(pages.at(-2).kind).toBe('endpaper');
      expect(pages.at(-1).kind).toBe('back-cover');
    }
  });

  it('only prompts for uploads while the memory box is still open', () => {
    const prompt = (canUpload) => polaroids(buildScrapbookPages({ trip, canUpload }))[0].prompt;
    expect(prompt(true)).toBe('Add a photo from the Memory Box');
    expect(prompt(false)).toBe('A photo belongs here');
  });

  it('writes ticked stops, the trip dates and the ledger total into the margin notes', () => {
    const expenses = [{ id: 'e1', description: 'Satay', amount_sgd: 20 }, { id: 'e2', amount_sgd: 9.5 }];
    const pages = buildScrapbookPages({ trip, memories, expenses });
    expect(pages.filter((p) => p.kind === 'photos').map((p) => p.note.text))
      .toEqual(['Bazaar Karat · Thu 1 Oct', 'Thu 1 Oct – Sat 3 Oct', '$29.50 spent together']);
    expect(pages.find((p) => p.kind === 'bucket').stops.map((s) => s.title)).toEqual(['Bazaar Karat']);
    expect(pages.find((p) => p.kind === 'ledger')).toMatchObject({
      total: '$29.50',
      count: 2,
      lines: [{ label: 'Satay', amount: '$20.00' }, { label: 'Shared expense', amount: '$9.50' }],
    });
    expect(pages.find((p) => p.kind === 'title').crew).toEqual(['Coen', 'Amos']);
  });

  it('numbers the paper pages but not the covers', () => {
    const pages = buildScrapbookPages({ trip, memories });
    expect(pages[0].number).toBeUndefined();
    expect(pages.at(-1).number).toBeUndefined();
    expect(pages.slice(1, -1).map((p) => p.number)).toEqual(pages.slice(1, -1).map((_, i) => i + 1));
  });

  it('returns nothing without a trip', () => {
    expect(buildScrapbookPages({ trip: null })).toEqual([]);
  });

  it('seededRandom stays inside [0, 1)', () => {
    const rng = seededRandom('x');
    for (let i = 0; i < 500; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
