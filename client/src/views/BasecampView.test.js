// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import BasecampView from './BasecampView.vue';
import CampScene from '@/components/basecamp/CampScene.vue';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/components/basecamp/CampScene.vue', () => ({
  default: { name: 'CampScene', props: ['subtitles'], render: () => null },
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ options: { history: { state: {} } }, push: vi.fn() }) }));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'me' }, profile: null, firstName: 'Alex' }) }));
vi.mock('@/stores/trips', () => ({
  useTripsStore: () => ({ fetch: vi.fn().mockResolvedValue(), trips: [], defaultTrip: { id: 'trip-1' } }),
}));
vi.mock('@/composables/useCampPresence', () => ({
  useCampPresence: () => ({ online: {}, start: vi.fn(), send: vi.fn(), wave: vi.fn() }),
}));
vi.mock('@/composables/useCampSky', () => ({
  useCampSky: () => ({
    mode: ref('day'), condition: ref('clear'), forecast: ref(''), forced: ref(false), isNight: ref(false),
    modeLabel: ref(''), cycleMode: vi.fn(), conditionLabel: ref(''),
  }),
}));
vi.mock('@/composables/useCampMusic', () => ({
  useCampMusic: () => ({ on: ref(false), toggle: vi.fn() }),
}));

async function ledgerSubtitleFor(balanceCents, totalSpent = 42.5) {
  api.get.mockImplementation(async (url) => {
    if (url === '/trips/trip-1/expenses/balances') {
      return { data: { balances: [{ memberId: 'me', balanceCents }], totalSpent } };
    }
    throw new Error(`no stub for ${url}`);
  });
  const wrapper = mount(BasecampView);
  await flushPromises();
  return wrapper.findComponent(CampScene).props('subtitles').ledger;
}

describe('Basecamp ledger subtitle', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('shows what you are owed', async () => {
    expect(await ledgerSubtitleFor(1250)).toBe("You're owed S$12.50");
  });

  it('shows what you owe', async () => {
    expect(await ledgerSubtitleFor(-1250)).toBe('You owe S$12.50');
  });

  it('shows the total spent when you are square', async () => {
    expect(await ledgerSubtitleFor(0)).toBe('All square · S$42.50 spent');
  });
});
