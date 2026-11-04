// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MemoryBox from './MemoryBox.vue';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  errorMessage: (_error, fallback) => fallback || 'Something went wrong',
}));
vi.mock('@/composables/useTripRealtime', () => ({ useTripRealtime: vi.fn() }));

const trip = { id: 'trip-1', itinerary: [] };
beforeEach(() => setActivePinia(createPinia()));
const dialog = () => document.querySelector('[role="alertdialog"]');
const dialogButton = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.includes(label));

describe('MemoryBox: sending a trip to the Archives', () => {
  let wrapper;
  let confirmSpy;

  beforeEach(async () => {
    api.post.mockReset();
    confirmSpy = vi.spyOn(window, 'confirm');
    api.get.mockResolvedValue({ data: { window: { phase: 'memory_box', daysLeft: 3 }, memories: [], contributors: [] } });
    wrapper = mount(MemoryBox, { props: { trip }, attachTo: document.body });
    await flushPromises();
    await wrapper.get('[data-cy="archive-now"]').trigger('click');
  });
  afterEach(() => {
    wrapper.unmount();
    confirmSpy.mockRestore();
  });

  it('asks in its own popup, not a browser alert, with Cancel focused', () => {
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dialog().textContent).toContain('Send this trip up to the Archives now?');
    expect(dialog().textContent).toContain('Nobody will be able to add more photos.');
    expect(document.activeElement.textContent).toContain('Cancel');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('does nothing on Cancel', async () => {
    dialogButton('Cancel').click();
    await flushPromises();
    expect(dialog()).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(wrapper.emitted('archived')).toBeUndefined();
  });

  it('archives once confirmed', async () => {
    api.post.mockResolvedValue({});
    dialogButton('Send to the Archives').click();
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/trips/trip-1/archive');
    expect(wrapper.emitted('archived')).toHaveLength(1);
    expect(dialog()).toBeNull();
  });

  it('stays open and explains if it fails', async () => {
    api.post.mockRejectedValue(new Error('nope'));
    dialogButton('Send to the Archives').click();
    await flushPromises();
    expect(dialog().querySelector('[role="alert"]').textContent).toContain('Could not send');
    expect(wrapper.emitted('archived')).toBeUndefined();
  });
});

describe('MemoryBox: the bell keeps up', () => {
  it('rechecks the notification badge after a photo is added', async () => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockImplementation(async (path) => (path.endsWith('/memories')
      ? { data: { window: { phase: 'memory_box', daysLeft: 3 }, memories: [], contributors: [] } }
      : { data: [] }));
    api.post.mockResolvedValue({ data: {} });
    const wrapper = mount(MemoryBox, { props: { trip }, attachTo: document.body });
    await flushPromises();
    api.get.mockClear();

    const input = wrapper.get('[data-cy="memory-input"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })], configurable: true });
    await input.trigger('change');
    await flushPromises();

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get.mock.calls.map(([path]) => path)).toContain('/trips/memory-reminders');
    wrapper.unmount();
  });
});
