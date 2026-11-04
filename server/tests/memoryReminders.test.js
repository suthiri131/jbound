import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryReminders, addDays } from '../services/logic/memoryWindow.js';

const END = '2026-11-01';
const trip = { id: 't1', name: 'Muar', start_date: '2026-10-30', end_date: END, archived_at: null };
const onDay = (n, hasPhotos = false) => memoryReminders(trip, hasPhotos, addDays(END, n));
const kinds = (list) => list.map((r) => r.id.replace('t1-', ''));

test('nothing while the trip is still on', () => {
  assert.deepEqual(onDay(0), []);
});

test('the day after the trip ends: told there are 7 days left', () => {
  const [opened, ...rest] = onDay(1);
  assert.match(opened.text, /Muar.*7 days left/);
  assert.equal(opened.daysLeft, 7);
  assert.equal(opened.tripId, 't1');
  assert.equal(opened.date, addDays(END, 1));
  assert.deepEqual(rest, []);
});

test('no second reminder until 5 days have gone by', () => {
  assert.deepEqual(kinds(onDay(5)), ['opened']);
});

test('after 5 days with no photos: reminded there are 2 days left', () => {
  const list = onDay(6);
  assert.deepEqual(kinds(list), ['reminder', 'opened']);
  assert.match(list[0].text, /2 days left/);
  assert.equal(list[0].daysLeft, 2);
  assert.equal(list[0].date, addDays(END, 6));
});

test('on the last day the reminder says 1 day', () => {
  assert.match(onDay(7)[0].text, /1 day left/);
});

test('anyone who has added a photo gets no second reminder and no longer needs chasing', () => {
  const list = onDay(6, true);
  assert.deepEqual(kinds(list), ['opened']);
  assert.equal(list[0].needsPhotos, false);
});

test('everything goes once the memory box has closed', () => {
  assert.deepEqual(onDay(8), []);
});

test('an archived trip has no reminders', () => {
  assert.deepEqual(memoryReminders({ ...trip, archived_at: '2026-11-03T00:00:00Z' }, false, addDays(END, 2)), []);
});

test('a one-day trip with no end date counts from its start date', () => {
  const list = memoryReminders({ ...trip, end_date: null, start_date: END }, false, addDays(END, 1));
  assert.deepEqual(kinds(list), ['opened']);
});
