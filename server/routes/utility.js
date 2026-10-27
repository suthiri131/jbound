import { Router } from 'express';
import multer from 'multer';
import * as c from '../controllers/utilityController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ALLOWED_IMAGE_TYPES } from '../services/storageService.js';
import { badRequest } from '../utils/httpError.js';
import { convertQuery, rateQuery, routingBody, uploadQuery } from './schemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MiB leaves room for multipart overhead on Vercel.
  fileFilter: (_req, file, cb) =>
    ALLOWED_IMAGE_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(badRequest('Only JPG, PNG, WEBP or GIF images')),
});

const router = Router();
router.get('/currency/rate', validate({ query: rateQuery }), c.currencyRate);
router.get('/currency/convert', validate({ query: convertQuery }), c.currencyConvert);
router.post('/routing', validate({ body: routingBody }), c.route);
router.post('/uploads', requireAuth, validate({ query: uploadQuery }), upload.single('image'), c.upload);

export default router;
