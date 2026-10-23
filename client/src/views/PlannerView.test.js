// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPinia } from 'pinia';
import PlannerView from './PlannerView.vue';
import { useTripsStore } from '@/stores/trips';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() }, errorMessage: (err) => err.message }));

let router, store;
beforeEach(() => {
  const pinia = createPinia();
  store = useTripsStore(pinia);
  store.trips = Array.from({ length: 35 }, (_, i) => ({
    id: String(i), name: i === 0 ? 'Kyoto holiday' : `Trip ${i}`,
    phase: i === 0 ? 'planning' : 'on_the_road',
  }));
  store.fetch = vi.fn().mockResolvedValue(store.trips);
  api.get.mockReset();
  api.get.mockImplementation(async (url, { params }) => {
    const matching = store.trips.filter((trip) => (!params.phase || trip.phase === params.phase)
      && trip.name.toLowerCase().includes((params.search || '').toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(matching.length / params.pageSize));
    const page = Math.min(params.page, totalPages);
    return { data: { items: matching.slice((page - 1) * params.pageSize, page * params.pageSize),
      page, totalPages, total: matching.length } };
  });
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/planner', component: PlannerView },
    { path: '/planner/:tripId', component: { template: '<div>Details</div>' } },
    { path: '/archives', component: { template: '<div />' } },
  ] });
});

async function open(path) {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(PlannerView, {
    global: { plugins: [router], stubs: { TripModal: true } },
  });
  await flushPromises();
  return wrapper;
}

describe('planner trip list', () => {
  it('paginates 35 trips and filters across all pages', async () => {
    const wrapper = await open('/planner');
    expect(router.currentRoute.value.path).toBe('/planner');
    expect(api.get).toHaveBeenCalledWith('/trips', { params: {
      page: 1, pageSize: 12, search: undefined, phase: undefined,
    } });
    expect(store.fetch).not.toHaveBeenCalled();
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(12);
    expect(wrapper.text()).toContain('Page 1 of 3');
    expect(wrapper.get('nav[aria-label="Trip pages"] button').attributes('disabled')).toBeDefined();
    await wrapper.findAll('nav[aria-label="Trip pages"] button')[1].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBe('2');
    expect(api.get).toHaveBeenLastCalledWith('/trips', { params: {
      page: 2, pageSize: 12, search: undefined, phase: undefined,
    } });
    expect(wrapper.findAll('[data-cy="trip-tab"]')[0].attributes('href')).toBe('/planner/12?page=2');
    await wrapper.get('input[type="search"]').setValue('KYOTO');
    await flushPromises();
    await wrapper.get('select').setValue('planning');
    await flushPromises();
    expect(router.currentRoute.value.query.page).toBeUndefined();
    const cards = wrapper.findAll('[data-cy="trip-tab"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].attributes('href')).toBe('/planner/0?search=KYOTO&phase=planning');
    await wrapper.get('select').setValue('memory_box');
    await flushPromises();
    expect(wrapper.text()).toContain('No trips match');
    wrapper.unmount();
  });

  it('supports the last page and clamps an out-of-range page', async () => {
    const wrapper = await open('/planner?page=99');
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(11);
    expect(wrapper.text()).toContain('Page 3 of 3');
    expect(router.currentRoute.value.query.page).toBe('3');
    expect(wrapper.findAll('nav[aria-label="Trip pages"] button')[1].attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('handles invalid page numbers and hides pagination for a single result', async () => {
    const wrapper = await open('/planner?page=invalid');
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(12);
    expect(router.currentRoute.value.query.page).toBeUndefined();
    await wrapper.get('input[type="search"]').setValue('Kyoto');
    await flushPromises();
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(1);
    expect(wrapper.find('nav[aria-label="Trip pages"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows a restart message when an old backend returns an unpaged array', async () => {
    api.get.mockResolvedValueOnce({ data: store.trips });
    const wrapper = await open('/planner');
    expect(wrapper.text()).toContain('Restart the backend');
    expect(wrapper.text()).not.toContain('No trips yet');
    wrapper.unmount();
  });

  it('shows API errors and retries the page', async () => {
    api.get.mockRejectedValueOnce(new Error('Could not reach server'));
    const wrapper = await open('/planner');
    expect(wrapper.text()).toContain('Could not reach server');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(12);
    wrapper.unmount();
  });

  it('ignores an older response after the filter changes', async () => {
    let finishOldRequest;
    api.get.mockImplementationOnce(() => new Promise((resolve) => { finishOldRequest = resolve; }));
    const wrapper = await open('/planner');
    await wrapper.get('input[type="search"]').setValue('Kyoto');
    await flushPromises();
    finishOldRequest({ data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await flushPromises();
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(1);
    expect(wrapper.text()).toContain('Kyoto holiday');
    wrapper.unmount();
  });

  it('opens the create dialog from a direct new-trip link', async () => {
    const wrapper = await open('/planner?new=1');
    expect(wrapper.find('trip-modal-stub').exists()).toBe(true);
    wrapper.unmount();
  });

  it('resolves invite links to the joined trip', async () => {
    store.join = vi.fn().mockResolvedValue({ id: 'joined' });
    const wrapper = await open('/planner?join=invite-code');
    expect(store.join).toHaveBeenCalledWith('invite-code');
    expect(router.currentRoute.value.path).toBe('/planner/joined');
    wrapper.unmount();
  });
});
