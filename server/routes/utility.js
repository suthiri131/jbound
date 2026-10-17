import { Router } from 'express';
import { currencyConvert, currencyRate } from '../controllers/utilityController.js';
import { validate } from '../middleware/validate.js';
import { convertQuery, rateQuery } from './schemas.js';

const router = Router();

router.get('/currency/rate', validate({ query: rateQuery }), currencyRate);
router.get('/currency/convert', validate({ query: convertQuery }), currencyConvert);

export default router;
