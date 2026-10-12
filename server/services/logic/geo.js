
export const CHECKPOINTS = {
  woodlands: {
    id: 'woodlands',
    name: 'Woodlands Checkpoint (Causeway)',
    sgSide: { lat: 1.4469, lng: 103.769 },
    jbSide: { lat: 1.4637, lng: 103.7649 }, // Bangunan Sultan Iskandar CIQ
    
    cameras: [
      { id: '2701', label: 'Woodlands Causeway (towards Johor)', direction: 'to_jb' },
      { id: '2702', label: 'Woodlands Checkpoint (towards BKE)', direction: 'to_sg' },
    ],
  },
  tuas: {
    id: 'tuas',
    name: 'Tuas Checkpoint (Second Link)',
    sgSide: { lat: 1.3486, lng: 103.6366 },
    jbSide: { lat: 1.3633, lng: 103.6286 }, // Sultan Abu Bakar CIQ
    cameras: [
      { id: '4703', label: 'Second Link at Tuas', direction: 'to_jb' },
      { id: '4713', label: 'Tuas Checkpoint', direction: 'to_sg' },
    ],
  },
};

/** Great-circle distance in km. */
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance from the JB-side CIQ of the chosen checkpoint. */
export function distanceFromCheckpointKm(place, checkpointId) {
  const point = { lat: place.lat, lng: place.lng };
  if (checkpointId && CHECKPOINTS[checkpointId]) {
    return haversineKm(point, CHECKPOINTS[checkpointId].jbSide);
  }
  return Math.min(...Object.values(CHECKPOINTS).map((cp) => haversineKm(point, cp.jbSide)));
}