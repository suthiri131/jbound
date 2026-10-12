import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getDrivingRoute } from '../services/ors.js';

const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);

export const routeRequestSchema = z.object({
  coordinates: z.array(coordinateSchema).min(2).max(50),
}).strict();

const router = Router();

router.post('/', validate({ body: routeRequestSchema }), async (req, res) => {
  const route = await getDrivingRoute(req.valid.body.coordinates);
  res.json(route);
});

export default router;
