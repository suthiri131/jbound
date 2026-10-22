/** Request validation schemas (zod). Shared by all routers. */
import { z } from 'zod';
import { VIBES } from '../services/logic/vibeMatching.js';

export const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM');
const boolQuery = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');
const csvVibes = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) : []))
  .pipe(z.array(z.enum(VIBES)));
const vibe = z.enum(VIBES);
const currency = z.enum(['SGD', 'MYR']);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, '3–20 chars: letters, numbers, underscore');
const imageUrls = z.array(z.string().url()).max(6).default([]);

// ---------- params ----------
export const idParam = z.object({ id: uuid });
export const tripParam = z.object({ tripId: uuid });
export const tripItemParam = z.object({ tripId: uuid, itemId: uuid });
export const tripExpenseParam = z.object({ tripId: uuid, expenseId: uuid });
export const tripMemberParam = z.object({ tripId: uuid, userId: uuid });
export const commentParam = z.object({ id: uuid, commentId: uuid });
export const checkpointParam = z.object({ id: z.enum(['woodlands', 'tuas']) });

// ---------- auth / users ----------
export const signupBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'At least 8 characters'),
  name: z.string().trim().min(1).max(60),
  username,
});
export const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export const refreshBody = z.object({ refresh_token: z.string().min(1) });
export const userSearchQuery = z.object({ q: z.string().trim().min(1).max(30) });
export const updateMeBody = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    username: username.optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

// ---------- places ----------
export const placesQuery = z.object({
  vibes: csvVibes,
  hiddenGem: boolQuery,
  maxDistanceKm: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().int().min(1).max(4).optional(),
  checkpoint: z.enum(['woodlands', 'tuas']).optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const googleSearchQuery = z.object({
  q: z.string().trim().max(80).optional(),
  vibe: vibe.optional(),
  checkpoint: z.enum(['woodlands', 'tuas']).optional(),
  maxDistanceKm: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().int().min(1).max(4).optional(),
  hiddenGem: boolQuery,
});
export const googlePhotoQuery = z.object({
  name: z.string().regex(/^places\/[^/]+\/photos\/[^/]+$/, 'Invalid photo name'),
  w: z.coerce.number().int().min(100).max(1600).default(600),
});
// Google place ids look like "ChIJ…": letters, digits, - and _
export const googlePlaceParam = z.object({ googlePlaceId: z.string().regex(/^[A-Za-z0-9_-]{5,300}$/, 'Invalid Google place id') });
export const googleImportBody = z.object({ googlePlaceId: z.string().trim().min(5).max(300) });
export const autocompleteQuery = z.object({ q: z.string().trim().min(1).max(60) });
export const createPlaceBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  vibes: z.array(vibe).min(1),
  priceLevel: z.number().int().min(1).max(4).optional(),
  photos: imageUrls,
});

// ---------- posts ----------
export const postsQuery = z.object({
  vibe: vibe.optional(),
  placeId: uuid.optional(),
  customPlaceName: z.string().trim().min(1).max(100).optional(),
  scope: z.enum(['everyone', 'friends']).default('everyone'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime({ offset: true }).optional(),
});
export const createPostBody = z.object({
  caption: z.string().trim().min(1).max(2000),
  placeId: uuid.optional(),
  customPlaceName: z.string().trim().min(1).max(100).optional(),
  vibe: vibe.optional(),
  images: imageUrls,
});
export const commentBody = z.object({ text: z.string().trim().min(1).max(1000) });

// ---------- trips ----------
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #2E5A3C');
export const createTripBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    mission: z.string().trim().max(160).optional(),
    coverColor: hexColor.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    inviteUsernames: z.array(username).max(20).optional(),
  })
  .refine((b) => !b.startDate || !b.endDate || b.endDate >= b.startDate, 'endDate must be after startDate');
export const updateTripBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  mission: z.string().trim().max(160).nullable().optional(),
  coverColor: hexColor.optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
});
export const inviteBody = z.object({ username });
export const joinBody = z.object({ inviteCode: z.string().trim().min(4).max(32) });
export const tripsQuery = z.object({ include: z.enum(['active', 'all']).default('active') });

// ---------- itinerary ----------
const stopFields = {
  vibe: vibe.nullable().optional(),
  dwellMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  crossing: z.enum(['woodlands', 'tuas']).nullable().optional(),
  crossingDir: z.enum(['to_jb', 'to_sg']).nullable().optional(),
};
export const addItemBody = z
  .object({
    placeId: uuid.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    day: isoDate.optional(),
    time: time.optional(),
    notes: z.string().trim().max(500).optional(),
    ...stopFields,
  })
  .refine((b) => b.placeId || b.title, 'Provide a placeId or a title');
export const updateItemBody = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  day: isoDate.nullable().optional(),
  time: time.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  done: z.boolean().optional(),
  ...stopFields,
});
export const reorderBody = z.object({
  items: z
    .array(z.object({ id: uuid, day: isoDate.nullable().optional(), position: z.number().int().min(0) }))
    .min(1)
    .max(200),
});
export const routeQuery = z.object({
  day: isoDate.optional(),
  fromCheckpoint: z.enum(['woodlands', 'tuas']).optional(),
});

// ---------- memory box + archives ----------
export const tripMemoryParam = z.object({ tripId: uuid, memoryId: uuid });
export const memoryFields = z.object({
  caption: z.string().trim().max(200).optional(),
  itemId: uuid.nullable().optional(),
});
export const STICKER_KINDS = ['star', 'sun', 'palm', 'chili', 'heart', 'car', 'bowl', 'compass'];
export const stickersBody = z.object({ stickers: z.array(z.enum(STICKER_KINDS)).max(4) });

// ---------- chat ----------
export const messagesQuery = z.object({
  after: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const messageBody = z.object({ text: z.string().trim().min(1).max(2000) });

// ---------- expenses ----------
export const createExpenseBody = z.object({
  amount: z.coerce.number().positive().max(1_000_000).multipleOf(0.01),
  currency,
  description: z.string().trim().min(1).max(120),
  paidBy: uuid.optional(),
  splitAmong: z.array(uuid).max(50).optional(),
});
export const balancesQuery = z.object({ currency: currency.default('SGD') });
export const settlementBody = z.object({ from: uuid, to: uuid, amountSgd: z.coerce.number().positive().max(1_000_000) });

// ---------- checkpoints ----------
export const congestionQuery = z.object({
  direction: z.enum(['to_jb', 'to_sg']).default('to_jb'),
  day: z.coerce.number().int().min(0).max(6).optional(), // 0 = Sunday
  hour: z.coerce.number().int().min(0).max(23).optional(),
  holiday: boolQuery,
});
export const snapshotsQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(24) });

// ---------- utilities ----------
export const rateQuery = z.object({
  from: z.string().toUpperCase().pipe(currency).default('SGD'),
  to: z.string().toUpperCase().pipe(currency).default('MYR'),
  date: z.union([z.literal('latest'), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
});
export const convertQuery = rateQuery.extend({ amount: z.coerce.number().nonnegative().max(1_000_000) });
export const routingBody = z.object({
  points: z
    .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
    .min(2)
    .max(25),
});
export const uploadQuery = z.object({ folder: z.enum(['posts', 'avatars', 'memories', 'places']).default('posts') });