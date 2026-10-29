/**
 * The Archives attic: 7 drawers per user, 4 in the mahogany dresser (slots 0-3)
 * and 3 in the old map chest (slots 4-6).
 */
export const ATTIC_SLOTS = 7;

const byArchivedAt = (a, b) =>
  (a.trip.archived_at || '').localeCompare(b.trip.archived_at || '') || a.trip.id.localeCompare(b.trip.id);

/**
 * Files archived trips that have no drawer yet into the free drawers, oldest first.
 * Whatever doesn't fit is overflow: the user has to clear it out or swap it for an old drawer.
 * @param {{slot:number|null, trip:{id:string, archived_at?:string|null}}[]} entries
 * @returns {{placements:{tripId:string, slot:number}[], overflow:object[]}}
 */
export function fillDrawers(entries) {
  const taken = new Set(entries.filter((e) => e.slot != null).map((e) => e.slot));
  const free = [...Array(ATTIC_SLOTS).keys()].filter((slot) => !taken.has(slot));
  const unplaced = entries.filter((e) => e.slot == null).sort(byArchivedAt);
  return {
    placements: unplaced.slice(0, free.length).map((e, i) => ({ tripId: e.trip.id, slot: free[i] })),
    overflow: unplaced.slice(free.length).map((e) => e.trip),
  };
}
