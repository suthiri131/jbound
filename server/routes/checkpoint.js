import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import * as c from '../controllers/checkpointsController.js';
import { checkpointParam, congestionQuery, snapshotsQuery } from './schemas.js';

const r = Router();
r.get('/', c.listCheckpoints);

r.get('/:id/cameras', validate({ params: checkpointParam }), c.getCameras);

r.get('/:id/congestion', validate({ params: checkpointParam, query: congestionQuery }), c.getCongestion);

r.get('/:id/snapshots', validate({ params: checkpointParam, query: snapshotsQuery }), c.getSnapshots);

export default r;