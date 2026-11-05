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

describe('people who are no longer in the crew', () => {
  const stubs = { RouterLink: true, SkyBackdrop: true, MarketStall: true, AvatarFlat: true, BackLabel: true, WanderingEyes: true };
  const former = [{ id: 'gone', name: 'Gone Member' }, { id: 'also', name: 'Also Gone' }];
  const expense = { ...equalExpense, paid_by: 'me', splitAmong: ['me', 'gone'] };

  async function openLedger({ settlements = [], myRole = 'member' } = {}) {
    api.get.mockReset();
    api.request.mockReset();
    api.get.mockResolvedValue({ data: [] });
    api.request.mockImplementation(async ({ url, method }) => {
      if (method && method !== 'GET') return { data: { expense, settlement: {} } };
      if (url.startsWith('/trips?')) return { data: [{ id: 't1', name: 'Muar', myRole }] };
      if (url.endsWith('/balances')) return { data: { balances: [], settlements, transactions: [] } };
      return { data: { expenses: [expense], members, formerMembers: former } };
    });
    const wrapper = mount(LedgerView, { global: { stubs } });
    await flushPromises();
    return wrapper;
  }
  const owed = (from, to) => ({ from, to, amountSgd: 12 });
  const firstOwes = (wrapper) => wrapper.get('.owes li');

  it('uses their name, never their raw ID', async () => {
    const wrapper = await openLedger({ settlements: [owed('gone', 'sam')] });
    expect(firstOwes(wrapper).text()).toContain('Gone owes Sam');
    expect(wrapper.text()).not.toContain('gone owes');
  });

  it('calls someone with no profile a former member', async () => {
    const wrapper = await openLedger({ settlements: [owed('deleted-user-id', 'sam')] });
    expect(firstOwes(wrapper).text()).toContain('Former owes Sam');
    expect(wrapper.text()).not.toContain('deleted-user-id');
  });

  it('lets you tick off a debt from someone who has left, when you are owed', async () => {
    const wrapper = await openLedger({ settlements: [owed('gone', 'me')] });
    expect(firstOwes(wrapper).text()).toContain("Gone isn't in the crew");
    await firstOwes(wrapper).get('input[type="checkbox"]').setValue(true);
    await firstOwes(wrapper).get('button.confirm-paid').trigger('click');
    await flushPromises();
    expect(sent('POST').data).toEqual({ from: 'gone', to: 'me', amountSgd: 12 });
    expect(wrapper.get('.settled-msg').text()).toBe('Ticked off: Gone is square with you.');
  });

  it('lets you tick off what you owe once the person owed has left', async () => {
    const wrapper = await openLedger({ settlements: [owed('me', 'gone')] });
    expect(firstOwes(wrapper).text()).toContain('You owe Gone');
    await firstOwes(wrapper).get('input[type="checkbox"]').setValue(true);
    await firstOwes(wrapper).get('button.confirm-paid').trigger('click');
    await flushPromises();
    expect(sent('POST').data).toEqual({ from: 'me', to: 'gone', amountSgd: 12 });
    expect(wrapper.get('.settled-msg').text()).toBe("Ticked off: you're square with Gone.");
  });

  it('still waits for the person owed while they are in the crew', async () => {
    const wrapper = await openLedger({ settlements: [owed('me', 'sam')] });
    expect(firstOwes(wrapper).find('input[type="checkbox"]').exists()).toBe(false);
    expect(firstOwes(wrapper).text()).toContain('Sam ticks it off once it lands');
  });

  it('only lets the owner step in between two people who have left', async () => {
    let wrapper = await openLedger({ settlements: [owed('gone', 'also')] });
    expect(firstOwes(wrapper).find('input[type="checkbox"]').exists()).toBe(false);
    wrapper = await openLedger({ settlements: [owed('gone', 'also')], myRole: 'owner' });
    expect(firstOwes(wrapper).find('input[type="checkbox"]').exists()).toBe(true);
  });

  it('shows them on an expense being edited, so it can be saved or they can be taken off', async () => {
    const wrapper = await openLedger();
    await wrapper.get('button.edit').trigger('click');
    await flushPromises();
    const row = wrapper.findAll('.split-row').find((r) => r.text().includes('Gone Member'));
    expect(row.text()).toContain('(not in the crew)');
    expect(wrapper.findAll('.split-row').some((r) => r.text().includes('Also Gone'))).toBe(false);

    await row.get('input[type="checkbox"]').setValue(false);
    await wrapper.get('form.add-form').trigger('submit');
    await flushPromises();
    expect(sent('PUT').data.splitAmong).toEqual(['me']);
  });
});
