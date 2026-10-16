import { supabase } from '../db/supabase.js';
import { check } from '../utils/httpError.js';
import { rankPlaces, isHiddenGem } from '../services/logic/vibeMatching.js';
import { distanceFromCheckpointKm } from '../services/logic/geo.js';

const PLACE_FIELDS = 'id, name, description, address, lat, lng, vibes, price_level, photos, source, google_place_id, rating, rating_count, maps_url, created_at';
const AUTHOR = 'author:profiles!posts_user_id_fkey(id, username, name, avatar_url)';

const withPostCount = (row) => {
  const { posts, ...place } = row;
  return { ...place, postCount: posts?.[0]?.count ?? 0 };
};

/**
 * GET /api/places?vibes=eating,culture&hiddenGem=true&maxDistanceKm=10&maxPrice=2&checkpoint=woodlands&q=temple
 * Vibe Explorer search. Each result includes a 1-line community quote.
 */
export async function listPlaces(req, res) {
  const { limit, ...filters } = req.valid.query;

  const rows = check(await supabase.from('places').select(`${PLACE_FIELDS}, posts(count)`));
  const ranked = rankPlaces(rows.map(withPostCount), filters).slice(0, limit);

  // Latest community caption per place → "1-line community quote" on each card
  const ids = ranked.map((p) => p.id);
  const quotes = {};
  if (ids.length) {
    const posts = check(
      await supabase
        .from('posts')
        .select(`place_id, caption, created_at, ${AUTHOR}`)
        .in('place_id', ids)
        .order('created_at', { ascending: false })
        .limit(300),
    );
    for (const p of posts) {
      if (!quotes[p.place_id]) {
        quotes[p.place_id] = { text: p.caption.slice(0, 120), author: p.author?.name ?? null };
      }
    }
  }

  res.json(ranked.map((p) => ({ ...p, communityQuote: quotes[p.id] ?? null })));
}

/** GET /api/places/:id — detail page with related community posts */
export async function getPlace(req, res) {
  const row = check(
    await supabase.from('places').select(`${PLACE_FIELDS}, posts(count)`).eq('id', req.params.id).single(),
    'Place not found',
  );
  const place = withPostCount(row);

  const posts = check(
    await supabase
      .from('posts')
      .select(`id, caption, vibe, images, created_at, ${AUTHOR}, likes:post_likes(count), comments:post_comments(count)`)
      .eq('place_id', place.id)
      .order('created_at', { ascending: false })
      .limit(20),
  );

  res.json({
    ...place,
    isHiddenGem: isHiddenGem(place),
    distanceKm: Math.round(distanceFromCheckpointKm(place) * 10) / 10,
    posts: posts.map(({ likes, comments, ...p }) => ({
      ...p,
      likeCount: likes?.[0]?.count ?? 0,
      commentCount: comments?.[0]?.count ?? 0,
    })),
  });
}

/** GET /api/places/autocomplete?q=  — for the post composer's place tagger */
export async function autocompletePlaces(req, res) {
  const q = req.valid.query.q.replace(/[%_]/g, '');
  const data = check(
    await supabase.from('places').select('id, name, vibes').ilike('name', `%${q}%`).order('name').limit(8),
  );
  res.json(data);
}

/** POST /api/places — community-submitted place */
export async function createPlace(req, res) {
  const { name, description, address, lat, lng, vibes, priceLevel, photos } = req.valid.body;
  const data = check(
    await supabase
      .from('places')
      .insert({
        name,
        description,
        address,
        lat,
        lng,
        vibes,
        price_level: priceLevel,
        photos,
        source: 'community',
        created_by: req.user.id,
      })
      .select(PLACE_FIELDS)
      .single(),
  );
  res.status(201).json(data);
}
