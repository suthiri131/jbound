import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTripMember } from '../middleware/tripAccess.js';
import * as archives from '../controllers/archivesController.js';
import * as s from './schemas.js';

const r = Router();
r.use(requireAuth);

const member = [validate({ params: s.tripParam }), requireTripMember];

// The attic (each user's 7 drawers)
r.get('/', archives.getAttic);
r.post('/:tripId/clear', member, archives.clearFromAttic);
r.put('/:tripId/drawer', member, validate({ body: s.drawerBody }), archives.placeInDrawer);

export default r;
