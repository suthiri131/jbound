import { convertCurrency, getExchangeRate } from '../services/currencyService.js';
import { getDrivingRoute } from '../services/routingService.js';
import { uploadImage } from '../services/storageService.js';
import { badRequest } from '../utils/httpError.js';

/** GET /api/currency/rate?from=SGD&to=MYR&date=latest */
export async function currencyRate(req, res) {
  const { from, to, date } = req.valid.query;
  res.json(await getExchangeRate(date, from, to));
}

/** GET /api/currency/convert?amount=50&from=SGD&to=MYR&date=latest */
export async function currencyConvert(req, res) {
  const { amount, from, to, date } = req.valid.query;
  res.json(await convertCurrency(amount, from, to, date));
}

/** POST /api/routing  */
// export async function route(req, res) {
//     res.json(await getDrivingRoute(req.valid.body.points))
// }

/** POST /api/uploads?folder=posts|avatars|memories */
export async function upload(req, res) {
    if (!req.file ) {
        throw badRequest('Attach an image in the "image" field')
    }

    const result = await uploadImage(req.file, {folder: req.valid.query.folder, userId: req.user.id });
    res.status(201).json(result)
}