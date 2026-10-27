import { supabase } from "../db/supabase.js";
import { check } from "../utils/httpError.js";
import {
  searchPlaces,
  getPlaceDetails,
  getPhotoUri,
  getPlaceProfile,
} from "../services/googlePlacesService.js";
import { distanceFromCheckpointKm } from "../services/logic/geo.js";

// Fewer Google reviews than this → shown as a hidden gem
const HIDDEN_GEM_MAX_REVIEWS = 150;


/**
 * One Google search per vibe (each cached for a day), merged into one list.
 * Results take turns by vibe (1st eating, 1st cozy, 2nd eating…) so one category doesn't fill the top.
 * A place found under two vibes appears once, tagged with both.
 */
export async function searchByVibes({ vibes, checkpoint }) {
  const lists = await Promise.all(
    vibes.map((vibe) => searchPlaces({ vibe, checkpoint })),
  );
  const byId = new Map();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    lists.forEach((list, v) => {
      const p = list[i];
      if (!p) return;
      const seen = byId.get(p.googlePlaceId);
      if (seen) {
        if (!seen.vibes.includes(vibes[v])) seen.vibes.push(vibes[v]);
      } else {
        // tag with the vibe it was found under, not Google's type mapping (the newer vibes have no types)
        byId.set(p.googlePlaceId, { ...p, vibes: [vibes[v]] });
      }
    });
  }
  return [...byId.values()];
}

// GET /api/places/google/search?vibes=eating,cozy&q=&checkpoint=&maxDistanceKm=&maxPrice=&hiddenGem=
// Typed search (q) wins over vibes. No q and no vibes → general "things to do".
export async function googleSearch(req, res) {
  const { q, vibe, vibes, checkpoint, maxDistanceKm, maxPrice, hiddenGem } =
    req.valid.query;
  const wanted = vibes.length ? vibes : vibe ? [vibe] : [];
  const results = q
    ? await searchPlaces({ q, checkpoint })
    : wanted.length
      ? await searchByVibes({ vibes: wanted, checkpoint })
      : await searchPlaces({ checkpoint });

  const ids = results.map((p) => p.googlePlaceId);
  const known = ids.length
    ? check(
        await supabase
          .from("places")
          .select("id, google_place_id, posts(count)")
          .in("google_place_id", ids),
      )
    : [];
  const byGoogleId = Object.fromEntries(
    known.map((k) => [k.google_place_id, k]),
  );

  const list = results
    .map((p) => ({
      ...p,
      id: byGoogleId[p.googlePlaceId]?.id ?? null,
      postCount: byGoogleId[p.googlePlaceId]?.posts?.[0]?.count ?? 0,
      distanceKm: Math.round(distanceFromCheckpointKm(p, checkpoint) * 10) / 10,
      isHiddenGem: p.ratingCount < HIDDEN_GEM_MAX_REVIEWS,
      communityQuote: null,
    }))
    // (removed the old vibe-type filter: places are already tagged with the vibe they were found under)
    .filter((p) => maxDistanceKm == null || p.distanceKm <= maxDistanceKm)
    .filter(
      (p) =>
        maxPrice == null || p.price_level == null || p.price_level <= maxPrice,
    )
    .filter((p) => !hiddenGem || p.isHiddenGem);

  res.json(list);
}

// GET /api/places/google/details/:googlePlaceId
// Place page: Google details + reviews, plus our own id and Tales count if someone already pinned it.
export async function googlePlaceDetails(req, res) {
  const { googlePlaceId } = req.valid.params;
  const [profile, { data: ours }] = await Promise.all([
    getPlaceProfile(googlePlaceId),
    supabase
      .from("places")
      .select("id, posts(count)")
      .eq("google_place_id", googlePlaceId)
      .maybeSingle(),
  ]);
  res.json({
    ...profile,
    id: ours?.id ?? null,
    postCount: ours?.posts?.[0]?.count ?? 0,
    distanceKm: {
      woodlands:
        Math.round(distanceFromCheckpointKm(profile, "woodlands") * 10) / 10,
      tuas: Math.round(distanceFromCheckpointKm(profile, "tuas") * 10) / 10,
    },
  });
}

/** GET /api/places/google/photo?name=places/…/photos/…&w=600 → 302 to a short-lived Google image URL */
export async function googlePhoto(req, res) {
  const { name, w } = req.valid.query;
  const uri = await getPhotoUri(name, w);
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.set("Cache-Control", "public, max-age=3000");
  res.redirect(302, uri);
}

// POST /api/places/google/import  { googlePlaceId }
// Saves a Google place into our `places` table (or returns the existing row), so it can be pinned to a trip and tagged in Tales like any other place.

export async function googleImport(req, res) {
  const { googlePlaceId } = req.valid.body;
  const { data: existing } = await supabase
    .from("places")
    .select("*")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (existing) return res.json(existing);

  const p = await getPlaceDetails(googlePlaceId);
  const row = check(
    await supabase
      .from("places")
      .insert({
        name: p.name,
        description: p.description,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        vibes: p.vibes,
        price_level: p.price_level,
        photos: p.photos, // proxy paths, resolved fresh on every view
        source: "google",
        google_place_id: p.googlePlaceId,
        rating: p.rating,
        rating_count: p.ratingCount,
        maps_url: p.mapsUrl,
        created_by: req.user.id,
      })
      .select("*")
      .single(),
  );
  res.status(201).json(row);
}
