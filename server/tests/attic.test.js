import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillDrawers, ATTIC_SLOTS } from '../services/logic/attic.js';

const entry = (id, slot, archivedAt) => ({ slot, trip: { id, archived_at: archivedAt } });

test('new archives fill the first empty drawers, oldest first', () => {
  const { placements, overflow } = fillDrawers([
    entry('b', null, '2026-09-02T00:00:00Z'),
    entry('kept', 0, '2026-01-01T00:00:00Z'),
    entry('a', null, '2026-09-01T00:00:00Z'),
    entry('kept2', 2, '2026-02-01T00:00:00Z'),
  ]);
  assert.deepEqual(placements, [{ tripId: 'a', slot: 1 }, { tripId: 'b', slot: 3 }]);
  assert.deepEqual(overflow, []);
});

test('an 8th archive waits as overflow once every drawer is full', () => {
  const full = [...Array(ATTIC_SLOTS).keys()].map((slot) => entry(`t${slot}`, slot, '2026-01-01T00:00:00Z'));
  const { placements, overflow } = fillDrawers([...full, entry('eighth', null, '2026-10-01T00:00:00Z')]);
  assert.deepEqual(placements, []);
  assert.deepEqual(overflow.map((t) => t.id), ['eighth']);
});
