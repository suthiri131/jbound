// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPinia } from 'pinia';
import PlannerView from './PlannerView.vue';
import { useTripsStore } from '@/stores/trips';

vi.mock('@/lib/api', () => ({ api: {}, errorMessage: (err) => err.message }));

let router, store;
beforeEach(() => {
  const pinia = createPinia();
  store = useTripsStore(pinia);
  store.trips = Array.from({ length: 35 }, (_, i) => ({
    id: String(i), name: i === 0 ? 'Kyoto holiday' : `Trip ${i}`,
    phase: i === 0 ? 'planning' : 'on_the_road',
  }));
  store.fetch = vi.fn().mockResolvedValue(store.trips);
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
  it('keeps the list open with 35 trips and carries filters into a trip link', async () => {
    const wrapper = await open('/planner');
    expect(router.currentRoute.value.path).toBe('/planner');
    expect(wrapper.findAll('[data-cy="trip-tab"]')).toHaveLength(35);
    await wrapper.get('input[type="search"]').setValue('KYOTO');
    await flushPromises();
    await wrapper.get('select').setValue('planning');
    await flushPromises();
    const cards = wrapper.findAll('[data-cy="trip-tab"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].attributes('href')).toBe('/planner/0?search=KYOTO&phase=planning');
    await wrapper.get('select').setValue('memory_box');
    await flushPromises();
    expect(wrapper.text()).toContain('No trips match');
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
