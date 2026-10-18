/**
 * Google Places API (New) — https://developers.google.com/maps/documentation/places/web-service/op-overview
 *
 * Used by the Explorer to search real JB places, and to import a Google place into our
 * `places` table when someone pins it to a trip (so itinerary items can reference it).
 *
 * - The key stays on the server (GOOGLE_PLACES_API_KEY). The browser never sees it.
 * - Every call sends a field mask, because Google bills by the fields you ask for.
 * - Results are cached in memory to keep usage inside the free monthly allowance.
 * - Photos are served through /api/places/google/photo, which asks Google for a short-lived
 *   image URL and redirects to it (photo URLs must not be stored long-term).
 */
import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { fetchJson } from '../utils/fetchJson.js';
import { HttpError } from '../utils/httpError.js';
import { CHECKPOINTS } from './logic/geo.js';

const SEARCH_CACHE_MS = 24 * 60 * 60 * 1000; // 1 day
const PHOTO_CACHE_MS = 50 * 60 * 1000; // Google photo URIs are short-lived

const FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'primaryType',
  'rating',
  'userRatingCount',
  'priceLevel',
  'photos',
  'googleMapsUri',
  'editorialSummary',
];
const SEARCH_MASK = FIELDS.map((f) => `places.${f}`).join(',');
const DETAIL_MASK = FIELDS.join(',');

/** Centre of the search bias: between Woodlands JB side and JB city. ~40 km radius covers Desaru/Kukup-ish. */
const JB_CENTRE = { latitude: 1.4927, longitude: 103.7414 };

/**
 * Google place types → our four vibes.
 * TODO(team): tune this mapping. Full type list: https://developers.google.com/maps/documentation/places/web-service/place-types
 */
export const TYPE_TO_VIBE = {
  eating: ['restaurant', 'cafe', 'bakery', 'food', 'meal_takeaway', 'coffee_shop', 'dessert_shop', 'food_court', 'bar', 'night_club'],
  culture: ['museum', 'art_gallery', 'hindu_temple', 'church', 'mosque', 'place_of_worship', 'historical_landmark', 'cultural_landmark', 'monument', 'library', 'tourist_attraction'],
  activities: ['shopping_mall', 'amusement_park', 'water_park', 'spa', 'bowling_alley', 'movie_theater', 'market', 'store', 'aquarium', 'tourist_attraction'],
  adventure: ['park', 'national_park', 'hiking_area', 'beach', 'zoo', 'campground', 'marina', 'state_park', 'garden'],
};

/** Words added to the text query when a vibe chip is picked but no search text was typed. */
export const VIBE_QUERY = {
  eating: 'famous food',
  culture: 'heritage temples museums',
  activities: 'things to do',
  adventure: 'nature parks beaches',
};

const PRICE = { PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

export function vibesForTypes(types = []) {
  const vibes = Object.entries(TYPE_TO_VIBE)
    .filter(([, list]) => types.some((t) => list.includes(t)))
    .map(([vibe]) => vibe);
  return vibes.length ? vibes : ['activities'];
}

export function priceLevelFrom(googleLevel) {
  return PRICE[googleLevel] ?? null;
}

/** Proxy URL (relative to the API) for a Google photo resource name. */
export const photoProxyPath = (photoName, width = 600) =>
  `/api/places/google/photo?name=${encodeURIComponent(photoName)}&w=${width}`;

/** Google place → the same shape the Explorer already renders for our own places. */
export function mapGooglePlace(p) {
  return {
    id: null, // not in our DB until someone pins it
    googlePlaceId: p.id,
    name: p.displayName?.text ?? 'Unnamed place',
    description: p.editorialSummary?.text ?? null,
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    vibes: vibesForTypes([p.primaryType, ...(p.types || [])].filter(Boolean)),
    price_level: priceLevelFrom(p.priceLevel),
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? 0,
    photos: (p.photos || []).slice(0, 3).map((ph) => photoProxyPath(ph.name)),
    mapsUrl: p.googleMapsUri ?? null,
    source: 'google',
  };
}

function headers(mask) {
  if (!config.google.placesKey) {
    throw new HttpError(503, 'GOOGLE_PLACES_API_KEY not set — add it to server/.env to search Google Places');
  }
  return { 'X-Goog-Api-Key': config.google.placesKey, 'X-Goog-FieldMask': mask };
}

/**
 * Text search around JB.  e.g. searchPlaces({ q: 'bak kut teh' }) or searchPlaces({ vibe: 'culture' })
 */
export async function searchPlaces({ q, vibe, checkpoint }) {
  const textQuery = `${q?.trim() || VIBE_QUERY[vibe] || 'things to do'} in Johor Bahru`;
  const centre = checkpoint && CHECKPOINTS[checkpoint]
    ? { latitude: CHECKPOINTS[checkpoint].jbSide.lat, longitude: CHECKPOINTS[checkpoint].jbSide.lng }
    : JB_CENTRE;

  return cached(`gplaces:search:${textQuery}:${checkpoint || ''}`, SEARCH_CACHE_MS, async () => {
    const data = await fetchJson(`${config.google.placesBaseUrl}/places:searchText`, {
      method: 'POST',
      headers: headers(SEARCH_MASK),
      body: {
        textQuery,
        maxResultCount: 20,
        languageCode: 'en',
        regionCode: 'MY',
        locationBias: { circle: { center: centre, radius: 40000 } },
      },
      timeoutMs: 10000,
    });
    return (data.places || []).map(mapGooglePlace).filter((p) => p.lat != null && p.lng != null);
  });
}

/** Full details for one place (used when importing). */
export async function getPlaceDetails(googlePlaceId) {
  return cached(`gplaces:detail:${googlePlaceId}`, SEARCH_CACHE_MS, async () => {
    const data = await fetchJson(`${config.google.placesBaseUrl}/places/${encodeURIComponent(googlePlaceId)}`, {
      headers: headers(DETAIL_MASK),
      timeoutMs: 10000,
    });
    return mapGooglePlace(data);
  });
}

/** Resolve a photo resource name ("places/…/photos/…") to a short-lived image URL. */
export async function getPhotoUri(photoName, width = 600) {
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) throw new HttpError(400, 'Invalid photo name');
  if (!config.google.placesKey) throw new HttpError(503, 'GOOGLE_PLACES_API_KEY not set');
  const w = Math.min(Math.max(Number(width) || 600, 100), 1600);
  return cached(`gplaces:photo:${photoName}:${w}`, PHOTO_CACHE_MS, async () => {
    const url = `${config.google.placesBaseUrl}/${photoName}/media?maxWidthPx=${w}&skipHttpRedirect=true`;
    const data = await fetchJson(url, { headers: { 'X-Goog-Api-Key': config.google.placesKey } });
    if (!data.photoUri) throw new HttpError(502, 'Google did not return a photo');
    return data.photoUri;
  });
}
