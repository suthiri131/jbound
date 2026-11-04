import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conditionFor } from '../services/weatherService.js';

test('maps NEA forecast text to a basecamp sky', () => {
  assert.equal(conditionFor('Thundery Showers'), 'storm');
  assert.equal(conditionFor('Light Rain'), 'rain');
  assert.equal(conditionFor('Showers'), 'rain');
  assert.equal(conditionFor('Partly Cloudy (Night)'), 'partly');
  assert.equal(conditionFor('Cloudy'), 'cloudy');
  assert.equal(conditionFor('Hazy'), 'haze');
  assert.equal(conditionFor('Fair & Warm'), 'clear');
  assert.equal(conditionFor(''), 'clear');
});
