import { supabase } from '../db/supabase.js';
import { check } from '../utils/httpError.js';
import { searchPlaces, getPlaceDetails, getPhotoUri } from '../services/googlePlacesService.js';
import { distanceFromCheckpointKm } from '../services/logic/geo.js';

// Fewer Google reviews than this → shown as a hidden gem
const HIDDEN_GEM_MAX_REVIEWS = 150;


// GET /api/places/google/search?q=&vibe=&checkpoint=&maxDistanceKm=&maxPrice=&hiddenGem=
export async function googleSearch(req, res) {
  const { q, vibe, checkpoint, maxDistanceKm, maxPrice, hiddenGem } = req.valid.query;
  const results = await searchPlaces({ q, vibe, checkpoint });

  const ids = results.map((p) => p.googlePlaceId);
  const known = ids.length
    ? check(await supabase.from('places').select('id, google_place_id, posts(count)').in('google_place_id', ids))
    : [];
  const byGoogleId = Object.fromEntries(known.map((k) => [k.google_place_id, k]));

  const list = results
    .map((p) => ({
      ...p,
      id: byGoogleId[p.googlePlaceId]?.id ?? null,
      postCount: byGoogleId[p.googlePlaceId]?.posts?.[0]?.count ?? 0,
      distanceKm: Math.round(distanceFromCheckpointKm(p, checkpoint) * 10) / 10,
      isHiddenGem: p.ratingCount < HIDDEN_GEM_MAX_REVIEWS,
      communityQuote: null,
    }))
    .filter((p) => !vibe || p.vibes.includes(vibe))
    .filter((p) => maxDistanceKm == null || p.distanceKm <= maxDistanceKm)
    .filter((p) => maxPrice == null || p.price_level == null || p.price_level <= maxPrice)
    .filter((p) => !hiddenGem || p.isHiddenGem);

  res.json(list);
}

/** GET /api/places/google/photo?name=places/…/photos/…&w=600 → 302 to a short-lived Google image URL */
export async function googlePhoto(req, res) {
  const { name, w } = req.valid.query;
  const uri = await getPhotoUri(name, w);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cache-Control', 'public, max-age=3000');
  res.redirect(302, uri);
}

// POST /api/places/google/import  { googlePlaceId }
// Saves a Google place into our `places` table (or returns the existing row), so it can be pinned to a trip and tagged in Tales like any other place.

export async function googleImport(req, res) {
  const { googlePlaceId } = req.valid.body;
  const { data: existing } = await supabase.from('places').select('*').eq('google_place_id', googlePlaceId).maybeSingle();
  if (existing) return res.json(existing);

  const p = await getPlaceDetails(googlePlaceId);
  const row = check(
    await supabase
      .from('places')
      .insert({
        name: p.name,
        description: p.description,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        vibes: p.vibes,
        price_level: p.price_level,
        photos: p.photos, // proxy paths, resolved fresh on every view
        source: 'google',
        google_place_id: p.googlePlaceId,
        rating: p.rating,
        rating_count: p.ratingCount,
        maps_url: p.mapsUrl,
        created_by: req.user.id,
      })
      .select('*')
      .single(),
  );
  res.status(201).json(row);
}
