import { config } from '../config.js';
import { cached } from '../utils/cache.js';
import { fetchJson } from '../utils/fetchJson.js';
import { HttpError } from '../utils/httpError.js';
import { CHECKPOINTS, haversineKm } from './logic/geo.js';

const CACHE_MS = 60_000;
const NEAREST_FALLBACK_KM = 2.5;

// retreives traffic camera information from LTA DataMall
async function fetchAllCameras() {
  if (!config.lta.accountKey) {
    throw new HttpError(503, 'LTA_ACCOUNT_KEY not set — register at datamall.lta.gov.sg and add it to .env');
  }
  return cached('lta:traffic-images', CACHE_MS, async () => {
    const data = await fetchJson(config.lta.trafficImagesUrl, {
      headers: { AccountKey: config.lta.accountKey },
    });
    return (data.value || []).map((c) => ({
      cameraId: String(c.CameraID),
      lat: Number(c.Latitude),
      lng: Number(c.Longitude),
      imageUrl: c.ImageLink,
    }));
  });
}

export async function getCheckpointCameras(checkpointId) {
  const cp = CHECKPOINTS[checkpointId];
  if (!cp) {
    throw new HttpError(404, 'Unknown checkpoint');
  }

  const all = await fetchAllCameras();
  let cameras = cp.cameras
    .map((meta) => {
      const cam = all.find((c) => c.cameraId === meta.id);
      return cam ? { ...cam, label: meta.label, direction: meta.direction } : null;
    })
    .filter(Boolean);

  // fallback, if the known IDs aren't in the feed, use whatever cameras are near the checkpoint.
  if (cameras.length === 0) {
    cameras = all
      .map((c) => ({ ...c, distanceKm: haversineKm(c, cp.sgSide) }))
      .filter((c) => c.distanceKm <= NEAREST_FALLBACK_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 2)
      .map(({ distanceKm, ...c }) => ({ ...c, label: `Camera ${c.cameraId}`, direction: null }));
  }

  return {
    checkpoint: { id: cp.id, name: cp.name },
    cameras,
    fetchedAt: new Date().toISOString(),
    source: 'LTA DataMall Traffic Images',
  };
}