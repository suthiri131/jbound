import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as c from './placesController.js';
import * as g from '../controllers/googlePlacesController.js';
import { placesQuery, autocompleteQuery, createPlaceBody, idParam, googleSearchQuery, googlePhotoQuery, googleImportBody, googlePlaceParam } from './schemas.js';

const r = Router();
r.get('/', validate({ query: placesQuery }), c.listPlaces);
// Google Places (must come before '/:id')
r.get('/google/search', validate({ query: googleSearchQuery }), g.googleSearch);
r.get('/google/details/:googlePlaceId', validate({ params: googlePlaceParam }), g.googlePlaceDetails);
r.get('/google/photo', validate({ query: googlePhotoQuery }), g.googlePhoto);
r.post('/google/import', requireAuth, validate({ body: googleImportBody }), g.googleImport);

r.get('/autocomplete', validate({ query: autocompleteQuery }), c.autocompletePlaces);
r.get('/:id', validate({ params: idParam }), c.getPlace);
r.post('/', requireAuth, validate({ body: createPlaceBody }), c.createPlace);
export default r;