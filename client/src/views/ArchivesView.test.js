// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import ArchivesView from './ArchivesView.vue';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
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
    if (path === '/archives') return { data: { capacity: 7, drawers: [{ slot: 0, trip, isNew: false }], pending: [] } };
    if (path === '/trips/trip-42') return { data: trip };
    if (path === '/trips/trip-42/memories') return { data: { memories, window } };
    if (path === '/trips/trip-42/expenses') return { data: { expenses } };
    throw new Error(`Unexpected API request: ${path}`);
  });
}

let router;

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
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
  it('puts each archived trip in its drawer and keeps the rest shut', async () => {
    mockTrip();
    const wrapper = await open('/archives');
    const filled = wrapper.findAll('a.drawer');
    expect(filled).toHaveLength(1);
    expect(filled[0].attributes('href')).toBe('/archives/trip-42');
    expect(filled[0].text()).toContain('A little Johor adventure');
    expect(filled[0].text()).toContain('OCT 2026');
    expect(wrapper.findAll('.drawer.empty')).toHaveLength(6);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    wrapper.unmount();
  });

  describe('when an 8th trip arrives', () => {
    const full = [...Array(7).keys()].map((slot) => ({ slot, trip: { ...trip, id: `old-${slot}`, name: `Old trip ${slot}` }, isNew: false }));
    const eighth = { ...trip, id: 'eighth', name: 'Kukup Seafood Day Trip' };

    beforeEach(() => {
      let pending = [eighth];
      api.get.mockImplementation(async () => ({ data: { capacity: 7, drawers: full, pending } }));
      api.post.mockImplementation(async () => { pending = []; });
      api.put.mockImplementation(async () => { pending = []; });
    });

    it('asks the user to clear it out or swap it, and can clear it', async () => {
      const wrapper = await open('/archives');
      const dialog = document.querySelector('[role="alertdialog"]');
      expect(dialog.textContent).toContain('Kukup Seafood Day Trip');
      [...dialog.querySelectorAll('button')].find((b) => b.textContent.includes('Clear it out')).click();
      await flushPromises();
      expect(api.post).toHaveBeenCalledWith('/archives/eighth/clear');
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      wrapper.unmount();
    });

    it('swaps it into the drawer the user picks', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const wrapper = await open('/archives');
      [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.includes('Swap')).click();
      await flushPromises();
      expect(wrapper.text()).toContain('Pick a drawer to swap out');
      await wrapper.get('button.drawer[data-slot="5"]').trigger('click');
      await flushPromises();
      expect(api.put).toHaveBeenCalledWith('/archives/eighth/drawer', { slot: 5 });
      expect(wrapper.find('.swap-banner').exists()).toBe(false);
      window.confirm.mockRestore();
      wrapper.unmount();
    });
  });

  it('loads the trip, photos and ledger into a closed scrapbook', async () => {
    mockTrip({
      memories: [{ id: 'm1', image_url: '/photo.jpg', caption: 'Market lights', author: { name: 'Coen' }, stop: { id: 'stop-a' } }],
      expenses: [{ id: 'e1', description: 'Satay', amount_sgd: 21.5 }, { id: 'e2', amount_sgd: 8 }],
    });
    const wrapper = await open('/archives/trip-42');
    expect(api.get.mock.calls.map(([path]) => path).sort()).toEqual(['/archives', '/trips/trip-42', '/trips/trip-42/expenses', '/trips/trip-42/memories']);
    // the scrapbook opens over the attic rather than replacing it
    expect(wrapper.find('.attic').exists()).toBe(true);
    expect(wrapper.get('[role="dialog"]').text()).toContain('From the mahogany dresser, 2026');

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

  it('closes the drawer back into the attic', async () => {
    mockTrip();
    const wrapper = await open('/archives/trip-42');
    await wrapper.get('.close-drawer').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/archives');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.find('a.drawer[data-trip="trip-42"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows an error instead of a book when the trip cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    const wrapper = await open('/archives/trip-42');
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe('Could not load this scrapbook');
    expect(wrapper.find('.book').exists()).toBe(false);
    wrapper.unmount();
  });
});
