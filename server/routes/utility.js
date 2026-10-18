import { Router } from 'express';
import { currencyConvert, currencyRate } from '../controllers/utilityController.js';
import { validate } from '../middleware/validate.js';
import { convertQuery, rateQuery } from './schemas.js';

const router = Router();

router.get('/currency/rate', validate({ query: rateQuery }), currencyRate);
router.get('/currency/convert', validate({ query: convertQuery }), currencyConvert);

export default router;
import multer from 'multer';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/httpError.js';
import { ALLOWED_IMAGE_TYPES } from '../services/storageService.js';

import * as c from '../controllers/utilityController.js';


import { rateQuery, convertQuery, routingBody, uploadQuery } from './schemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPG, PNG, WEBP or GIF images')),
});

const r = Router();
r.get('/currency/rate', validate({ query: rateQuery }), c.currencyRate);
r.get('/currency/convert', validate({ query: convertQuery }), c.currencyConvert);
r.post('/routing', validate({ body: routingBody }), c.route);
r.post('/uploads', requireAuth, validate({ query: uploadQuery }), upload.single('image'), c.upload);

export default r;
