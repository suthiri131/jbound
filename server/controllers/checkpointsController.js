import { supabase } from '../db/supabase.js';
import { check, notFound } from '../utils/httpError.js';
import { CHECKPOINTS } from '../services/logic/geo.js';
import { estimateCongestion, sgNow, scoreFor, levelFor, DISCLAIMER } from '../services/logic/congestionHeuristic.js';
import { getCheckpointCameras } from '../services/trafficService.js';

const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const lastSnapshotAt = {};

function assertCheckpoint(id) {
  if (!CHECKPOINTS[id]) {
    throw notFound('Unknown checkpoint (use woodlands or tuas)');
    }
}

async function logSnapshot(checkpointId, imageUrl, level) {
    if (Date.now() - (lastSnapshotAt[checkpointId] || 0) < SNAPSHOT_EVERY_MS)
        {return}

    const { error } = await supabase
    .from('congestion_snapshots')
    .insert({
      checkpoint_id: checkpointId,
      image_url: imageUrl,
      estimated_level: level
    });

    if (error) {
        console.warn('[snapshot] failed:', error.message)
        return;
    }

    lastSnapshotAt[checkpointId] = Date.now()
}

// logs camera pulls
// pulls once every 10mins
export async function getCameras(req, res) {
  const { id } = req.params;
  assertCheckpoint(id);
  const data = await getCheckpointCameras(id);
  const { dayOfWeek, hour } = sgNow();

  const cameras = data.cameras.map((cam) => {
    const direction = cam.direction || 'to_jb';
    const score = scoreFor({ checkpoint: id, direction, dayOfWeek, hour });
    return { ...cam, estimate: { score, level: levelFor(score) } };
  });

  if (cameras[0]) {
    await logSnapshot(id, cameras[0].imageUrl, cameras[0].estimate.level)
  };
  res.json({ ...data, cameras, disclaimer: DISCLAIMER });
}


export function listCheckpoints(_req, res) {
  res.json(
    Object.values(CHECKPOINTS).map(({ id, name, sgSide, jbSide }) => ({ id, name, sgSide, jbSide })),
  );
}


export function getCongestion(req, res) {
  const { id } = req.params;
  assertCheckpoint(id);
  const now = sgNow();
  const { direction, day, hour, holiday } = req.valid.query;
  res.json(
    estimateCongestion({
      checkpoint: id,
      direction,
      dayOfWeek: day ?? now.dayOfWeek,
      hour: hour ?? now.hour,
      holiday,
    }),
  );
}

// get recent logged snapshots
export async function getSnapshots(req, res) {
  const { id } = req.params;
  assertCheckpoint(id);
  const data = check(
    await supabase
      .from('congestion_snapshots')
      .select('id, captured_at, image_url, estimated_level')
      .eq('checkpoint_id', id)
      .order('captured_at', { ascending: false })
      .limit(req.valid.query.limit),
  );
  res.json(data);
}