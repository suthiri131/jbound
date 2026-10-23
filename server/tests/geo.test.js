import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCheckpointRouteStart } from '../services/logic/geo.js';

test('checkpoint route starts from the selected crossing', () => {
  assert.deepEqual(getCheckpointRouteStart('woodlands'), {
    id: 'checkpoint-woodlands',
    title: 'Woodlands Checkpoint (Causeway) approach',
    lat: 1.4469,
    lng: 103.769,
  });
  assert.deepEqual(getCheckpointRouteStart('tuas'), {
    id: 'checkpoint-tuas',
    title: 'Tuas Checkpoint (Second Link) approach',
    lat: 1.3633,
    lng: 103.6286,
  });
  assert.equal(getCheckpointRouteStart('unknown'), null);
});
