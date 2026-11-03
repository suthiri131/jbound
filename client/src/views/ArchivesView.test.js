// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import ArchivesView from './ArchivesView.vue';
import { api } from '@/lib/api';
import { askConfirm, showAlert } from '@/lib/dialog';

vi.mock('@/lib/dialog', () => ({ askConfirm: vi.fn(), showAlert: vi.fn() }));
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
      api.get.mockImplementation(async (path) => {
        if (path === '/archives') return { data: { capacity: 7, drawers: full, pending } };
        if (path === '/trips/old-5') return { data: { ...trip, id: 'old-5', name: 'Old trip 5' } };
        if (path === '/trips/old-5/memories') return { data: { memories: [], window: { phase: 'archived' } } };
        if (path === '/trips/old-5/expenses') return { data: { expenses: [] } };
        throw new Error(`Unexpected API request: ${path}`);
      });
      api.post.mockImplementation(async () => { pending = []; });
      api.put.mockImplementation(async () => { pending = []; });
    });

    const dialogButton = (label) => [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.includes(label));
    const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().includes(label));

    it('asks the user to discard it or swap it', async () => {
      const wrapper = await open('/archives');
      const dialog = document.querySelector('[role="alertdialog"]');
      expect(dialog.textContent).toContain('Kukup Seafood Day Trip');
      expect(dialogButton('Discard it')).toBeTruthy();
      expect(dialogButton('Swap')).toBeTruthy();
      wrapper.unmount();
    });

    it('only discards after the user confirms', async () => {
      const wrapper = await open('/archives');
      dialogButton('Discard it').click();
      await flushPromises();
      expect(api.post).not.toHaveBeenCalled();
      expect(document.querySelector('[role="alertdialog"]').textContent).toContain('Are you sure?');

      dialogButton('Go back').click();
      await flushPromises();
      expect(api.post).not.toHaveBeenCalled();
      expect(document.querySelector('[role="alertdialog"]').textContent).toContain('The tent is full');

      dialogButton('Discard it').click();
      await flushPromises();
      dialogButton('Yes, discard it').click();
      await flushPromises();
      expect(api.post).toHaveBeenCalledWith('/archives/eighth/clear');
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      wrapper.unmount();
    });

    async function openDrawerToSwap(wrapper) {
      dialogButton('Swap').click();
      await flushPromises();
      expect(wrapper.text()).toContain('Pick a drawer to look inside');
      await wrapper.get('button.drawer[data-slot="5"]').trigger('click');
      await flushPromises();
    }

    it('opens the picked drawer to look through without changing anything', async () => {
      const wrapper = await open('/archives');
      await openDrawerToSwap(wrapper);
      expect(router.currentRoute.value.path).toBe('/archives/old-5');
      expect(wrapper.find('.scrapbook').exists()).toBe(true);
      expect(wrapper.get('.decide').text()).toContain('Kukup Seafood Day Trip');
      expect(api.put).not.toHaveBeenCalled();
      wrapper.unmount();
    });

    it('keeps the drawer and goes back to choosing', async () => {
      const wrapper = await open('/archives');
      await openDrawerToSwap(wrapper);
      await button(wrapper, 'Keep').trigger('click');
      await flushPromises();
      expect(api.put).not.toHaveBeenCalled();
      expect(router.currentRoute.value.path).toBe('/archives');
      expect(wrapper.find('.swap-banner').exists()).toBe(true);
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      wrapper.unmount();
    });

    it('swaps the 8th trip into the drawer once the user decides', async () => {
      const wrapper = await open('/archives');
      await openDrawerToSwap(wrapper);
      await button(wrapper, 'Discard this').trigger('click');
      await flushPromises();
      expect(api.put).toHaveBeenCalledWith('/archives/eighth/drawer', { slot: 5 });
      expect(router.currentRoute.value.path).toBe('/archives');
      expect(wrapper.find('.swap-banner').exists()).toBe(false);
      wrapper.unmount();
    });

    it('stays on the drawer and says so if the swap fails', async () => {
      api.put.mockRejectedValueOnce(new Error('nope'));
      const wrapper = await open('/archives');
      await openDrawerToSwap(wrapper);
      await button(wrapper, 'Discard this').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.path).toBe('/archives/old-5');
      expect(wrapper.get('.decide [role="alert"]').exists()).toBe(true);
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
    expect(cover.text()).not.toContain('JBound Tales');
    expect(cover.text()).toContain('THE JB TRAVEL JOURNAL');
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

  describe('deleting a scrapbook', () => {
    beforeEach(() => {
      mockTrip();
      askConfirm.mockReset();
      showAlert.mockReset();
    });
    const clickDelete = async (wrapper) => {
      await wrapper.get('.delete-book').trigger('click');
      await flushPromises();
    };

    it('stops if the user says no to the first question', async () => {
      askConfirm.mockResolvedValueOnce(false);
      const wrapper = await open('/archives/trip-42');
      await clickDelete(wrapper);
      expect(askConfirm).toHaveBeenCalledTimes(1);
      expect(api.post).not.toHaveBeenCalled();
      expect(router.currentRoute.value.path).toBe('/archives/trip-42');
      wrapper.unmount();
    });

    it('stops if the user says no to the second question', async () => {
      askConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const wrapper = await open('/archives/trip-42');
      await clickDelete(wrapper);
      expect(askConfirm).toHaveBeenCalledTimes(2);
      expect(api.post).not.toHaveBeenCalled();
      wrapper.unmount();
    });

    it('deletes after both yeses, closes the drawer and refreshes the tent', async () => {
      askConfirm.mockResolvedValue(true);
      api.post.mockResolvedValue({});
      const wrapper = await open('/archives/trip-42');
      api.get.mockImplementation(async () => ({ data: { capacity: 7, drawers: [], pending: [] } }));
      await clickDelete(wrapper);
      expect(api.post).toHaveBeenCalledWith('/archives/trip-42/clear');
      expect(router.currentRoute.value.path).toBe('/archives');
      expect(wrapper.find('a.drawer[data-trip="trip-42"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('stays open and explains if the delete fails', async () => {
      askConfirm.mockResolvedValue(true);
      api.post.mockRejectedValue(new Error('nope'));
      const wrapper = await open('/archives/trip-42');
      await clickDelete(wrapper);
      expect(showAlert).toHaveBeenCalledTimes(1);
      expect(router.currentRoute.value.path).toBe('/archives/trip-42');
      wrapper.unmount();
    });

    it('is not offered while choosing a drawer to swap', async () => {
      const full = [...Array(7).keys()].map((slot) => ({ slot, trip: { ...trip, id: slot === 5 ? 'trip-42' : `old-${slot}` } }));
      api.get.mockImplementation(async (path) => {
        if (path === '/archives') return { data: { capacity: 7, drawers: full, pending: [{ ...trip, id: 'eighth', name: 'Eighth' }] } };
        if (path === '/trips/trip-42') return { data: trip };
        if (path === '/trips/trip-42/memories') return { data: { memories: [], window: { phase: 'archived' } } };
        return { data: { expenses: [] } };
      });
      const wrapper = await open('/archives');
      [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.includes('Swap')).click();
      await flushPromises();
      await wrapper.get('button.drawer[data-slot="5"]').trigger('click');
      await flushPromises();
      expect(wrapper.find('.decide').exists()).toBe(true);
      expect(wrapper.find('.delete-book').exists()).toBe(false);
      wrapper.unmount();
    });
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
