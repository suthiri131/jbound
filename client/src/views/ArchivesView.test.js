// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import ArchivesView from './ArchivesView.vue';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  errorMessage: (_error, fallback) => fallback || 'Something went wrong',
  assetUrl: (url) => url,
}));

const trip = {
  id: 'trip-42',
  name: 'A little Johor adventure',
  phase: 'archived',
  cover_color: '#70452f',
  start_date: '2026-10-01',
  end_date: '2026-10-03',
  members: [{ name: 'Coen' }],
  itinerary: [
    { id: 'stop-a', title: 'Bazaar Karat', day: '2026-10-01', done: true, notes: 'Night market!' },
    { id: 'stop-b', title: 'Glass Temple', day: '2026-10-02', done: true },
  ],
};

function mockTrip({ memories = [], expenses = [], window = { phase: 'archived' } } = {}) {
  api.get.mockImplementation(async (path) => {
    if (path === '/trips') return { data: [trip, { ...trip, id: 'live', phase: 'planning', name: 'Upcoming' }] };
    if (path === '/trips/trip-42') return { data: trip };
    if (path === '/trips/trip-42/memories') return { data: { memories, window } };
    if (path === '/trips/trip-42/expenses') return { data: { expenses } };
    throw new Error(`Unexpected API request: ${path}`);
  });
}

let router;

beforeEach(() => {
  api.get.mockReset();
  window.innerWidth = 1024;
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/archives/:tripId?', component: ArchivesView },
      { path: '/planner/:tripId', component: { template: '<div />' } },
    ],
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function open(path) {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(ArchivesView, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe('ArchivesView', () => {
  it('lists only archived trips', async () => {
    mockTrip();
    const wrapper = await open('/archives');
    const links = wrapper.findAll('a.cover-link');
    expect(links).toHaveLength(1);
    expect(links[0].attributes('href')).toBe('/archives/trip-42');
    wrapper.unmount();
  });

  it('loads the trip, photos and ledger into a closed scrapbook', async () => {
    mockTrip({
      memories: [{ id: 'm1', image_url: '/photo.jpg', caption: 'Market lights', author: { name: 'Coen' }, stop: { id: 'stop-a' } }],
      expenses: [{ id: 'e1', description: 'Satay', amount_sgd: 21.5 }, { id: 'e2', amount_sgd: 8 }],
    });
    const wrapper = await open('/archives/trip-42');
    expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/trips/trip-42', '/trips/trip-42/memories', '/trips/trip-42/expenses']);

    const cover = wrapper.get('.leaf .front');
    expect(cover.text()).toContain('A little Johor adventure');
    expect(cover.text()).toContain('Thu 1 Oct – Sat 3 Oct');
    expect(cover.text()).toContain('JBOUND · TRAVEL JOURNAL');
    expect(wrapper.get('.page-label').text()).toBe('Front cover');

    expect(wrapper.get('.polaroid img').attributes('src')).toBe('/photo.jpg');
    expect(wrapper.text()).toContain('Market lights');
    expect(wrapper.text()).toContain('Night market!');
    expect(wrapper.text()).toContain('$29.50');
    expect(wrapper.findAll('.polaroid.blank')).toHaveLength(2);
    expect(wrapper.find('.upload').exists()).toBe(false);

    await wrapper.get('.open-cover').trigger('click');
    expect(wrapper.get('.page-label').text()).toMatch(/^Pages 1–2 of/);
    wrapper.unmount();
  });

  it('fills a trip with no photos with blank polaroids and links to the Memory Box while it is open', async () => {
    mockTrip({ window: { phase: 'memory_box' } });
    const wrapper = await open('/archives/trip-42');
    expect(wrapper.findAll('.polaroid.blank')).toHaveLength(3);
    expect(wrapper.text()).toContain('Add a photo from the Memory Box');
    expect(wrapper.get('.upload a').attributes('href')).toBe('/planner/trip-42');
    wrapper.unmount();
  });

  it('shows an error instead of a book when the trip cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    const wrapper = await open('/archives/trip-42');
    expect(wrapper.get('[role="alert"]').text()).toBe('Could not load this scrapbook');
    expect(wrapper.find('.book').exists()).toBe(false);
    wrapper.unmount();
  });
});
