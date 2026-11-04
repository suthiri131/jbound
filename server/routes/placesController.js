import { supabase } from '../db/supabase.js';
import { check } from '../utils/httpError.js';
import { distanceFromCheckpointKm } from '../services/logic/geo.js';

const PLACE_FIELDS = 'id, name, description, address, lat, lng, vibes, price_level, photos, source, google_place_id, rating, rating_count, maps_url, created_at';
const AUTHOR = 'author:profiles!posts_user_id_fkey(id, username, name, avatar_url)';

const withPostCount = (row) => {
  const { posts, ...place } = row;
  return { ...place, postCount: posts?.[0]?.count ?? 0 };
};

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
