// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import LedgerView from './LedgerView.vue';
import { api } from '@/lib/api';
import { askConfirm } from '@/lib/dialog';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), request: vi.fn() },
  errorMessage: (error, fallback) => error?.message || fallback,
}));
vi.mock('@/lib/dialog', () => ({ askConfirm: vi.fn() }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'me' }, profile: null }) }));
vi.mock('@/composables/useCampSky', () => ({
  useCampSky: () => ({ sky: ref({ night: false, landFilter: 'brightness(1) saturate(1)' }) }),
}));

const members = [{ id: 'me', name: 'Coen' }, { id: 'sam', name: 'Sam' }];
const customExpense = {
  id: 'e1',
  description: 'Dinner',
  amount: 30,
  amount_sgd: 30,
  exchange_rate: 1,
  currency: 'SGD',
  paid_by: 'me',
  created_by: 'me',
  splitAmong: ['me', 'sam'],
  splitAmounts: [{ memberId: 'me', amountCents: 2000 }, { memberId: 'sam', amountCents: 1000 }],
};
const equalExpense = { ...customExpense, id: 'e2', description: 'Petrol', splitAmounts: null };

async function openEdit(expense) {
  api.get.mockResolvedValue({ data: [] });
  api.request.mockImplementation(async ({ url, method }) => {
    if (method && method !== 'GET') return { data: { expense } };
    if (url.startsWith('/trips?')) return { data: [{ id: 't1', name: 'Muar' }] };
    if (url.endsWith('/balances')) return { data: { balances: [], settlements: [], transactions: [] } };
    return { data: { expenses: [expense], members } };
  });
  const wrapper = mount(LedgerView, {
    global: {
      stubs: { RouterLink: true, SkyBackdrop: true, MarketStall: true, AvatarFlat: true, BackLabel: true, WanderingEyes: true },
    },
  });
  await flushPromises();
  await wrapper.get('button.edit').trigger('click');
  await flushPromises();
  return wrapper;
}
const sent = (method) => api.request.mock.calls.map(([options]) => options).find((options) => options.method === method);

describe('editing an expense in the Ledger', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.request.mockReset();
    askConfirm.mockReset();
  });

  it('keeps a custom split when only the description changes', async () => {
    const wrapper = await openEdit(customExpense);
    expect(wrapper.findAll('input.custom').map((input) => input.element.value)).toEqual(['20', '10']);

    await wrapper.get('#expense-description').setValue('Team dinner');
    await wrapper.get('form.add-form').trigger('submit');
    await flushPromises();

    const { data, url } = sent('PUT');
    expect(url).toContain('/expenses/e1');
    expect(data.description).toBe('Team dinner');
    expect(data.splitAmounts).toEqual([{ memberId: 'me', amount: 20 }, { memberId: 'sam', amount: 10 }]);
  });

  it('leaves an equal split as equal', async () => {
    const wrapper = await openEdit(equalExpense);
    expect(wrapper.find('input.custom').exists()).toBe(false);

    await wrapper.get('form.add-form').trigger('submit');
    await flushPromises();
    expect(sent('PUT').data.splitAmounts).toBeUndefined();
  });

  it('deletes the expense once confirmed', async () => {
    const wrapper = await openEdit(customExpense);
    askConfirm.mockResolvedValue(true);
    await wrapper.get('button.delete-expense').trigger('click');
    await flushPromises();
    expect(sent('DELETE').url).toContain('/expenses/e1');
  });

  it('keeps the expense if the delete is cancelled', async () => {
    const wrapper = await openEdit(customExpense);
    askConfirm.mockResolvedValue(false);
    await wrapper.get('button.delete-expense').trigger('click');
    await flushPromises();
    expect(sent('DELETE')).toBeUndefined();
  });
});
