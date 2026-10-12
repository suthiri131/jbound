// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { VueDraggable } from 'vue-draggable-plus';
import TripItinerary from '../TripItinerary.vue';
import { readItinerary, saveItinerary } from '@/services/localTrips';

beforeEach(() => {
  const data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  });
});

test('stops can be added, edited, completed, reordered, and removed within their day', async () => {
  const wrapper = mount(TripItinerary, { props: {
    userId: 'user-a', tripId: 'trip-a', days: ['2026-10-10', '2026-10-11'],
  } });
  const day = wrapper.findAll('.day-section')[0];
  async function add(title) {
    await day.findAll('button').find(button => button.text() === '+ Add stop').trigger('click');
    await day.find('input[id^="title-"]').setValue(title);
    await day.find('form').trigger('submit');
  }
  await add('Bakery');
  await add('Lunch');
  expect(wrapper.findAll('.day-section')[1].findAll('.stop')).toHaveLength(0);
  expect(readItinerary('user-a', 'trip-a')).toHaveLength(2);
  const draggable = wrapper.findAllComponents(VueDraggable)[0];
  draggable.vm.$emit('update:modelValue', [...draggable.props('modelValue')].reverse());
  await wrapper.vm.$nextTick();
  expect(readItinerary('user-a', 'trip-a').find(item => item.title === 'Lunch').position).toBe(0);
  expect(day.findAll('h4')[0].text()).toBe('Lunch');
  await day.find('input[type="checkbox"]').setValue(true);
  expect(day.find('.day-header').text()).not.toContain('ticked');
  expect(day.find('.reorder').exists()).toBe(false);
  expect(readItinerary('user-a', 'trip-a').find(item => item.title === 'Lunch').done_at).toBeTruthy();
  await day.find('.stop-details button').trigger('click');
  await day.find('input[id^="title-"]').setValue('Late lunch');
  await day.find('form').trigger('submit');
  expect(day.find('h4').text()).toBe('Late lunch');
  await day.find('.stop-details .btn-ghost').trigger('click');
  expect(readItinerary('user-a', 'trip-a').map(item => item.title)).toEqual(['Bakery']);
  wrapper.unmount();
});

test('stored stops reload and remain isolated by trip and user', () => {
  saveItinerary('user-a', 'trip-a', [{ id: 'stop', day: '2026-10-10', title: 'Bakery', position: 0, done: false, dwell_minutes: null }]);
  const wrapper = mount(TripItinerary, { props: { userId: 'user-a', tripId: 'trip-a', days: ['2026-10-10'] } });
  expect(wrapper.find('h4').text()).toBe('Bakery');
  expect(readItinerary('user-b', 'trip-a')).toEqual([]);
  expect(readItinerary('user-a', 'trip-b')).toEqual([]);
  wrapper.unmount();
});
