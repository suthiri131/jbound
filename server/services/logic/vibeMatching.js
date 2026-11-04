import { distanceFromCheckpointKm } from './geo.js';

export const VIBES = ['eating', 'activities', 'culture', 'adventure', 'cozy', 'peaceful', 'chaotic'];
export const HIDDEN_GEM_MAX_POSTS = 3;
const POPULARITY_SATURATION = 20; // 20+ posts counts as "very popular"

export function isHiddenGem(place) {
  return place.source === 'community' || (place.postCount ?? 0) <= HIDDEN_GEM_MAX_POSTS;
}

export function scorePlace(place, { vibes = [], hiddenGem = false } = {}) {
  const matched = vibes.length ? place.vibes.filter((v) => vibes.includes(v)).length : 0;
  const vibeScore = vibes.length ? matched / vibes.length : 1;
  const popularity = Math.min(1, Math.log1p(place.postCount ?? 0) / Math.log1p(POPULARITY_SATURATION));

  const score = hiddenGem
    ? 0.6 * vibeScore + 0.3 * (isHiddenGem(place) ? 1 : 0) + 0.1 * (1 - popularity)
    : 0.6 * vibeScore + 0.4 * popularity;
  return Math.round(score * 1000) / 1000;
}

/**
 * @param {Array} places rows with { vibes, lat, lng, price_level, source, postCount, name, description }
 * @param {{vibes?:string[], hiddenGem?:boolean, maxDistanceKm?:number, maxPrice?:number, checkpoint?:string, q?:string}} filters
 */
export function rankPlaces(places, filters = {}) {
  const { vibes = [], hiddenGem = false, maxDistanceKm, maxPrice, checkpoint, q } = filters;
  const needle = q?.trim().toLowerCase();

  return places
    .map((p) => ({
      ...p,
      distanceKm: Math.round(distanceFromCheckpointKm(p, checkpoint) * 10) / 10,
      isHiddenGem: isHiddenGem(p),
    }))
    .filter((p) => !vibes.length || p.vibes.some((v) => vibes.includes(v)))
    .filter((p) => !hiddenGem || p.isHiddenGem)
    .filter((p) => maxDistanceKm == null || p.distanceKm <= maxDistanceKm)
    .filter((p) => maxPrice == null || p.price_level == null || p.price_level <= maxPrice)
    .filter(
      (p) =>
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        (p.description || '').toLowerCase().includes(needle),
    )
    .map((p) => ({ ...p, matchScore: scorePlace(p, { vibes, hiddenGem }) }))
    .sort((a, b) => b.matchScore - a.matchScore || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));
}
