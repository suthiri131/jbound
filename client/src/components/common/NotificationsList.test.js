// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NotificationsList from './NotificationsList.vue';
import { useNotificationsStore } from '@/stores/notifications';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, errorMessage: () => 'error' }));
vi.mock('@/lib/dialog', () => ({ showAlert: vi.fn() }));

const RouterLink = { props: ['to'], template: '<a :data-to="to"><slot /></a>' };

function mountList({ invites = [], reminders = [] }) {
  api.get.mockImplementation(async (path) => {
    if (path === '/trips/invites') return { data: invites };
    if (path === '/trips/memory-reminders') return { data: reminders };
    throw new Error(`unexpected request: ${path}`);
  });
  return mount(NotificationsList, { global: { stubs: { RouterLink } } });
}

describe('NotificationsList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.get.mockReset();
    api.post.mockReset();
  });

  it('shows a reminder with a button to that trip, and asks for nothing but invites and reminders', async () => {
    const wrapper = mountList({
      reminders: [{ id: 't1-opened', tripId: 't1', text: 'Muar has ended.', date: '2026-11-01', needsPhotos: true }],
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Muar has ended.');
    const button = wrapper.find('[data-cy="memory-reminder"] a');
    expect(button.text()).toBe('Add photos');
    expect(button.attributes('data-to')).toBe('/planner/t1');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('closes the drawer when the button is used', async () => {
    const wrapper = mountList({
      reminders: [{ id: 't1-opened', tripId: 't1', text: 'x', date: '2026-11-01', needsPhotos: false }],
    });
    await flushPromises();
    await wrapper.find('[data-cy="memory-reminder"] a').trigger('click');
    expect(wrapper.emitted('navigate')).toHaveLength(1);
  });

  it('counts one badge per invite and per trip still needing photos', async () => {
    mountList({
      invites: [{ id: 'i1', name: 'KL' }],
      reminders: [
        { id: 't1-opened', tripId: 't1', text: 'a', date: '2026-11-01', needsPhotos: true },
        { id: 't1-reminder', tripId: 't1', text: 'b', date: '2026-11-06', needsPhotos: true },
        { id: 't2-opened', tripId: 't2', text: 'c', date: '2026-11-01', needsPhotos: false },
      ],
    });
    await flushPromises();
    expect(useNotificationsStore().badgeCount).toBe(2);
  });

  it('still shows invites when the reminders fail to load', async () => {
    api.get.mockImplementation(async (path) => {
      if (path === '/trips/invites') return { data: [{ id: 'i1', name: 'KL' }] };
      throw new Error('nope');
    });
    const wrapper = mount(NotificationsList, { global: { stubs: { RouterLink } } });
    await flushPromises();
    expect(wrapper.text()).toContain('KL');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('says so when there is nothing to show', async () => {
    const wrapper = mountList({});
    await flushPromises();
    expect(wrapper.text()).toContain('No post today');
  });
});
