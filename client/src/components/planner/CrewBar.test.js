// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import CrewBar from './CrewBar.vue';
import { api } from '@/lib/api';
import { answerDialog, currentDialog, dismissDialogs } from '@/lib/dialog';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), delete: vi.fn() },
  assetUrl: (url) => url,
  errorMessage: (_error, fallback) => fallback || 'Something went wrong',
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'me' }, profile: null }) }));
vi.mock('../../composables/useTripPresence', () => ({ useTripPresence: () => ({ viewerIds: ref([]) }) }));

const member = (id, name, status = 'accepted') => ({ id, name, status });
const tripWith = (myRole, members) => ({ id: 't1', invite_code: 'ABC123', myRole, members });

describe('CrewBar popups', () => {
  let wrapper;
  let confirmSpy;

  const mountBar = (trip) => {
    wrapper = mount(CrewBar, { props: { trip }, attachTo: document.body });
    return wrapper;
  };
  const clickMemberButton = (name) => wrapper.get(`[aria-label="${name}"]`).trigger('click');
  const openInviteAndAskForNewCode = async () => {
    await wrapper.get('[data-cy="invite-open"]').trigger('click');
    await flushPromises();
    await wrapper.get('.icon-btn').trigger('click');
  };

  beforeEach(() => {
    api.post.mockReset().mockResolvedValue({});
    api.delete.mockReset().mockResolvedValue({});
    confirmSpy = vi.spyOn(window, 'confirm');
  });
  afterEach(() => {
    dismissDialogs();
    wrapper.unmount();
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('asks in the app popup before making a new invite code', async () => {
    mountBar(tripWith('owner', [member('me', 'Coen')]));
    await openInviteAndAskForNewCode();
    expect(currentDialog.value.title).toBe('Make a new invite code?');
    expect(currentDialog.value.danger).toBe(false);
    expect(api.post).not.toHaveBeenCalled();

    answerDialog(true);
    await flushPromises();
    expect(api.post).toHaveBeenCalledWith('/trips/t1/invite-code');
  });

  it('makes no new code if the popup is cancelled', async () => {
    mountBar(tripWith('owner', [member('me', 'Coen')]));
    await openInviteAndAskForNewCode();
    answerDialog(false);
    await flushPromises();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('keeps the invite popover open while the popup is answered, then still closes on an outside click', async () => {
    mountBar(tripWith('owner', [member('me', 'Coen')]));
    await openInviteAndAskForNewCode();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('#crew-invite').exists()).toBe(true);

    answerDialog(true);
    await flushPromises();
    expect(wrapper.find('#crew-invite').exists()).toBe(true);

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('#crew-invite').exists()).toBe(false);
  });

  it('removes a crewmate once confirmed', async () => {
    mountBar(tripWith('owner', [member('me', 'Coen'), member('sam', 'Sam')]));
    await clickMemberButton('Remove Sam');
    expect(currentDialog.value).toMatchObject({ title: 'Remove Sam from the crew?', confirmLabel: 'Remove', danger: true });

    answerDialog(true);
    await flushPromises();
    expect(api.delete).toHaveBeenCalledWith('/trips/t1/members/sam');
    expect(wrapper.emitted('changed')).toHaveLength(1);
  });

  it('labels the buttons clearly when cancelling an invite, and keeps it if you back out', async () => {
    mountBar(tripWith('owner', [member('me', 'Coen'), member('sam', 'Sam', 'pending')]));
    await clickMemberButton('Remove Sam');
    expect(currentDialog.value).toMatchObject({ title: 'Cancel the invite to Sam?', confirmLabel: 'Cancel invite', cancelLabel: 'Keep invite', danger: true });

    answerDialog(false);
    await flushPromises();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('asks before you leave the crew', async () => {
    mountBar(tripWith('member', [member('me', 'Coen'), member('sam', 'Sam')]));
    await clickMemberButton('Leave crew');
    expect(currentDialog.value).toMatchObject({ title: 'Leave this crew?', message: 'You can be invited back later.', confirmLabel: 'Leave crew', danger: true });

    answerDialog(true);
    await flushPromises();
    expect(api.delete).toHaveBeenCalledWith('/trips/t1/members/me');
    expect(wrapper.emitted('left')).toHaveLength(1);
    expect(wrapper.emitted('changed')).toBeUndefined();
  });
});
