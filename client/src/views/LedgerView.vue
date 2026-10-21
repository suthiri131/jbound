<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage as getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const trips = ref([]);
const tripId = ref(typeof route.query.tripId === 'string' ? route.query.tripId : '');
const expenses = ref([]);
const members = ref([]);
const balances = ref([]);
const suggestedSettlements = ref([]);
const transactions = ref([]);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const showForm = ref(false);
const editingId = ref(null);
const customSplit = ref(false);
const customAmounts = reactive({});
const emptyForm = () => ({ description: '', amount: '', currency: 'SGD', paidBy: '', splitAmong: [] });
const form = reactive(emptyForm());
const isEditing = computed(() => editingId.value !== null);
const selectedTrip = computed(() => trips.value.find((trip) => trip.id === tripId.value));
const recentTrip = (list) => [...list].sort((a, b) =>
  (b.created_at || b.start_date || '').localeCompare(a.created_at || a.start_date || ''),
)[0];

function formatMoney(amount, currency = 'SGD') {
  const numericAmount = Number(amount);
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}
function memberName(memberId) { return members.value.find(({ id }) => id === memberId)?.name ?? memberId; }
function clearLedger() {
  expenses.value = []; members.value = []; balances.value = []; suggestedSettlements.value = []; transactions.value = [];
}
async function apiRequest(path, options = {}) {
  try { return (await api.request({ url: path, ...options })).data; }
  catch (error) { throw new Error(getErrorMessage(error, 'Ledger request failed')); }
}
async function loadTrips() {
  try {
    const list = await apiRequest('/trips?include=all');
    trips.value = list;
    const requested = typeof route.query.tripId === 'string' ? route.query.tripId : '';
    tripId.value = list.some((trip) => trip.id === requested) ? requested : (recentTrip(list)?.id ?? '');
    await loadLedger();
  } catch (error) { errorMessage.value = error.message; }
}
async function loadLedger() {
  clearLedger();
  if (!tripId.value) return;
  loading.value = true;
  errorMessage.value = '';
  const currentTrip = tripId.value;
  try {
    const path = `/trips/${encodeURIComponent(currentTrip)}/expenses`;
    const [ledger, balanceData] = await Promise.all([apiRequest(path), apiRequest(`${path}/balances`)]);
    if (tripId.value !== currentTrip) return;
    expenses.value = ledger.expenses ?? [];
    members.value = ledger.members ?? [];
    balances.value = balanceData.balances ?? [];
    suggestedSettlements.value = balanceData.settlements ?? [];
    transactions.value = balanceData.transactions ?? [];
    if (!form.paidBy || !members.value.some(({ id }) => id === form.paidBy)) form.paidBy = auth.user?.id || members.value[0]?.id || '';
    if (!form.splitAmong.length) form.splitAmong = members.value.map(({ id }) => id);
  } catch (error) { errorMessage.value = error.message; }
  finally { loading.value = false; }
}
function chooseTrip() {
  clearLedger();
  router.replace({ query: { ...route.query, tripId: tripId.value || undefined } });
  resetForm();
  loadLedger();
}
function resetForm() {
  editingId.value = null;
  customSplit.value = false;
  for (const key of Object.keys(customAmounts)) delete customAmounts[key];
  Object.assign(form, emptyForm(), { paidBy: auth.user?.id || members.value[0]?.id || '', splitAmong: members.value.map(({ id }) => id) });
}
function openForm() { resetForm(); showForm.value = true; }
function editExpense(expense) {
  editingId.value = expense.id; showForm.value = true; customSplit.value = false;
  Object.assign(form, { description: expense.description, amount: expense.amount, currency: expense.currency, paidBy: expense.paid_by, splitAmong: [...expense.splitAmong] });
}
function setEqualSplit() { form.splitAmong = members.value.map(({ id }) => id); customSplit.value = false; }
function toggleCustom() { customSplit.value = !customSplit.value; if (!customSplit.value) setEqualSplit(); }
const customTotal = computed(() => form.splitAmong.reduce((sum, memberId) => sum + (Number(customAmounts[memberId]) || 0), 0));
const customRemaining = computed(() => Number((Number(form.amount || 0) - customTotal.value).toFixed(2)));
const customSplitReady = computed(() => customSplit.value
  && form.splitAmong.length > 0
  && Math.abs(customRemaining.value) < 0.001
  && form.splitAmong.every((memberId) => customAmounts[memberId] !== undefined && customAmounts[memberId] !== ''));
function customSplitStatus() {
  if (customRemaining.value > 0) return `${formatMoney(customTotal.value, form.currency)} assigned; ${formatMoney(customRemaining.value, form.currency)} remaining`;
  if (customRemaining.value < 0) return `${formatMoney(Math.abs(customRemaining.value), form.currency)} over the total`;
  return `${formatMoney(customTotal.value, form.currency)} fully assigned`;
}
function splitDescription(expense) {
  const people = expense.splitMembers ?? [];
  if (!people.length) return 'No split members';
  const custom = new Map((expense.splitAmounts ?? []).map(({ memberId, amountCents }) => [memberId, amountCents]));
  const totalCents = Math.round(Number(expense.amount_sgd || 0) * 100);
  const baseCents = Math.floor(totalCents / people.length);
  const remainder = totalCents % people.length;
  return people.map((person, index) => {
    const cents = custom.get(person.id) ?? (Number.isFinite(Number(person.amountSgd))
      ? Math.round(Number(person.amountSgd) * 100)
      : baseCents + (index < remainder ? 1 : 0));
    return `${person.name} ${formatMoney(cents / 100)}`;
  }).join(' · ');
}
async function saveExpense() {
  if (!tripId.value || !form.splitAmong.length) return;
  saving.value = true; errorMessage.value = '';
  try {
    const path = `/trips/${encodeURIComponent(tripId.value)}/expenses`;
    const payload = { amount: Number(form.amount), currency: form.currency, description: form.description.trim(), paidBy: form.paidBy, splitAmong: form.splitAmong };
    if (customSplit.value) payload.splitAmounts = form.splitAmong.map((memberId) => ({ memberId, amount: Number(customAmounts[memberId]) }));
    const result = await apiRequest(isEditing.value ? `${path}/${encodeURIComponent(editingId.value)}` : path, { method: isEditing.value ? 'PUT' : 'POST', data: payload });
    if (!result.expense) throw new Error('The server did not return the saved expense.');
    showForm.value = false; resetForm(); await loadLedger();
  } catch (error) { errorMessage.value = error.message; }
  finally { saving.value = false; }
}
async function confirmSettlement(settlement) {
  errorMessage.value = '';
  try {
    await apiRequest(`/trips/${encodeURIComponent(tripId.value)}/expenses/settlements`, { method: 'POST', data: { from: settlement.from, to: settlement.to, amountSgd: settlement.amountSgd } });
    await loadLedger();
  } catch (error) { errorMessage.value = error.message; }
}
watch(() => route.query.tripId, (value) => {
  if (typeof value === 'string' && value !== tripId.value) { tripId.value = value; loadLedger(); }
});
onMounted(loadTrips);
</script>

<template>
  <main class="ledger-page">
    <header class="ledger-heading">
      <p class="eyebrow">THE SHARED TAB</p>
      <h1 class="display display-lg">Trip ledger</h1>
      <p class="muted">Track shared costs and settle up in Singapore dollars.</p>
    </header>

    <div class="trip-picker">
      <label class="trip-label" for="trip-picker">Trip</label>
      <select id="trip-picker" v-model="tripId" class="select" @change="chooseTrip">
        <option value="" disabled>Select a trip</option>
        <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.name }}</option>
      </select>
      <button v-if="tripId" class="btn btn-teal" type="button" @click="openForm">Add Expense</button>
    </div>
    <p v-if="!trips.length && !loading" class="muted">Join or create a trip to start a ledger.</p>
    <p v-if="errorMessage" class="error-text" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" class="muted" role="status">Loading ledger…</p>

    <section v-if="tripId && !loading" class="ledger-content">
      <section class="card card-pad balances" aria-labelledby="balances-heading">
        <h2 id="balances-heading" class="display display-sm">Balances · SGD</h2>
        <ul v-if="balances.length" class="balance-list">
          <li v-for="balance in balances" :key="balance.memberId">
            <span>{{ memberName(balance.memberId) }}</span>
            <strong :class="{ owed: balance.balanceSgd > 0, owes: balance.balanceSgd < 0 }">
              {{ balance.balanceSgd > 0 ? 'is owed ' : balance.balanceSgd < 0 ? 'owes ' : 'settled ' }}{{ formatMoney(Math.abs(balance.balanceSgd)) }}
            </strong>
          </li>
        </ul>
        <p v-else class="muted">No balances to settle yet.</p>
        <div v-if="suggestedSettlements.length" class="settle-up">
          <h3>Suggested paybacks</h3>
          <p v-for="(settlement, index) in suggestedSettlements" :key="`${settlement.from}-${settlement.to}-${index}`">
            {{ memberName(settlement.from) }} pays {{ memberName(settlement.to) }} <strong>{{ formatMoney(settlement.amountSgd) }}</strong>
            <button v-if="settlement.to === auth.user?.id" class="btn btn-sm" type="button" @click="confirmSettlement(settlement)">Confirm Settlement</button>
            <span v-else class="muted">Awaiting {{ memberName(settlement.to) }} to confirm</span>
          </p>
        </div>
        <div v-if="transactions.length" class="settle-up">
          <h3>Settlement history</h3>
          <p v-for="transaction in transactions" :key="transaction.id">
            {{ memberName(transaction.from_user) }} paid {{ memberName(transaction.to_user) }}
            <strong>{{ formatMoney(transaction.amount_sgd) }}</strong>
            <small>{{ new Date(transaction.created_at).toLocaleDateString() }}</small>
          </p>
        </div>
      </section>

      <section v-if="showForm" class="card card-pad expense-form" aria-labelledby="expense-form-heading">
        <div class="expense-title"><h2 id="expense-form-heading" class="display display-sm">{{ isEditing ? 'Edit expense' : 'Add an expense' }}</h2><button type="button" class="btn btn-ghost" @click="showForm = false; resetForm()">Close</button></div>
        <form @submit.prevent="saveExpense">
          <label class="field" for="expense-description">Description<input id="expense-description" v-model="form.description" class="input" maxlength="200" required /></label>
          <div class="amount-row">
            <label class="field" for="expense-amount">Amount<input id="expense-amount" v-model.number="form.amount" class="input" type="number" min="0.01" step="0.01" required /></label>
            <label class="field" for="expense-currency">Currency paid<select id="expense-currency" v-model="form.currency" class="select"><option value="SGD">S$ · SGD</option><option value="MYR">RM · MYR</option></select></label>
          </div>
          <p class="natural-language">Paid by
            <select id="expense-payer" v-model="form.paidBy" class="inline-select" aria-label="Payer"><option v-for="member in members" :key="member.id" :value="member.id">{{ member.id === auth.user?.id ? 'you' : member.name }}</option></select>
            <span>and split</span><button class="inline-select split-toggle" type="button" @click="toggleCustom">{{ customSplit ? 'custom amounts' : 'equally' }}</button>
          </p>
          <fieldset class="member-picker">
            <legend>{{ customSplit ? 'Individual shares' : 'Included in the equal split' }}</legend>
            <template v-if="customSplit">
              <label v-for="member in members" :key="member.id" class="custom-member"><input v-model="form.splitAmong" type="checkbox" :value="member.id" /><span>{{ member.name }}</span><input v-if="form.splitAmong.includes(member.id)" v-model.number="customAmounts[member.id]" class="input custom-amount" type="number" min="0" step="0.01" :aria-label="`${member.name} amount`" /></label>
              <small class="split-status" :class="{ complete: customSplitReady, over: customRemaining < 0 }" aria-live="polite">
                {{ customSplitStatus() }} out of {{ formatMoney(form.amount || 0, form.currency) }}
                <template v-if="form.splitAmong.length === 2"> · For example, assigning {{ formatMoney(7, form.currency) }} to one person out of {{ formatMoney(12, form.currency) }} leaves {{ formatMoney(5, form.currency) }} to assign to the other.</template>
              </small>
            </template>
            <label v-else v-for="member in members" :key="member.id"><input v-model="form.splitAmong" type="checkbox" :value="member.id" />{{ member.name }}</label>
          </fieldset>
          <div class="form-actions"><button class="btn btn-teal" type="submit" :disabled="saving || !members.length || (customSplit && !customSplitReady)">{{ saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add expense' }}</button><button v-if="isEditing" class="btn btn-ghost" type="button" @click="resetForm(); showForm = false">Cancel edit</button></div>
        </form>
      </section>

      <section class="card card-pad expense-section" aria-labelledby="expenses-heading">
        <div class="expense-title"><h2 id="expenses-heading" class="display display-sm">Expenses</h2><span>{{ expenses.length }} {{ expenses.length === 1 ? 'entry' : 'entries' }}</span></div>
        <p v-if="!expenses.length" class="muted">No expenses yet. Add the first shared cost.</p>
        <ol v-else class="expense-feed">
          <li v-for="expense in expenses" :key="expense.id" class="expense-entry">
            <div class="expense-top"><div><h3>{{ expense.description }}</h3><p>Paid by {{ expense.paid_by_profile?.name ?? memberName(expense.paid_by) }} · {{ new Date(expense.created_at).toLocaleString() }}</p><p class="expense-split">Split: {{ splitDescription(expense) }}</p></div><div class="expense-total"><strong>{{ formatMoney(expense.amount, expense.currency) }}</strong><small>{{ formatMoney(expense.amount_sgd) }} SGD equivalent</small><small class="expense-meta">1 {{ expense.currency }} = {{ Number(expense.exchange_rate || 0).toFixed(6) }} SGD</small><small class="expense-meta">Rate date: {{ expense.rate_date || '—' }}</small></div></div>
            <button v-if="expense.created_by === auth.user?.id || selectedTrip?.myRole === 'owner'" class="btn btn-sm" type="button" @click="editExpense(expense)">Edit</button>
          </li>
        </ol>
      </section>
    </section>
  </main>
</template>

<style scoped>
.ledger-page { width: min(100% - 40px, 1180px); margin: 0 auto; padding: 42px 0 72px; }
.ledger-heading { margin-bottom: 22px; }
.ledger-heading h1 { margin: 0 0 8px; }
.ledger-heading p:last-child { margin: 0; }
.trip-picker { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: end; gap: 12px; max-width: 720px; margin-bottom: 18px; }
.trip-picker .field { flex: 1; min-width: 0; }
.trip-label { align-self: end; padding-bottom: 10px; color: var(--ink); font-size: 16px; font-weight: 700; }
.ledger-content { display: grid; gap: 20px; min-width: 0; }
.ledger-content > * { min-width: 0; }
.balances h2, .expense-form h2 { margin-bottom: 14px; }
.balance-list { margin: 0; padding: 0; list-style: none; }
.balance-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px; min-height: 48px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.balance-list li:last-child { border-bottom: 0; }
.balance-list strong { text-align: right; }
.owed { color: var(--jungle); }
.owes { color: var(--ember); }
.settle-up { margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--line); }
.settle-up h3 { margin-bottom: 8px; font-size: 15px; }
.settle-up p { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }
.amount-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.expense-form form { display: grid; gap: 14px; }
.natural-language { margin: 0; line-height: 2.3; }
.inline-select { display: inline-block; max-width: 100%; padding: 3px 24px 3px 7px; color: var(--jungle); font: inherit; font-weight: 700; border: 1px solid var(--line-strong); border-radius: 6px; background: white; }
.split-toggle { cursor: pointer; }
.member-picker { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px; }
.member-picker legend { padding: 0 5px; font-size: 13px; font-weight: 700; }
.member-picker label { display: inline-flex; align-items: center; gap: 6px; }
.member-picker .custom-member { display: grid; grid-template-columns: auto minmax(70px, 1fr) minmax(90px, 130px); width: 100%; }
.custom-amount { min-width: 0; padding: 8px; }
.split-status { flex-basis: 100%; color: var(--ink-mute); line-height: 1.5; }
.split-status.complete { color: var(--jungle); font-weight: 700; }
.split-status.over { color: var(--ember); font-weight: 700; }
.form-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.expense-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.expense-title h2 { margin: 0; }
.expense-title span { color: var(--ink-mute); font-size: 13px; }
.expense-feed { display: grid; gap: 14px; margin: 0; padding: 2px; list-style: none; }
.expense-entry { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: 14px; row-gap: 4px; padding: 18px 20px 16px; border: 1px dashed var(--line-strong); border-radius: 3px; background: #fffdf7; box-shadow: 0 3px 10px rgb(35 30 18 / 7%); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.expense-entry::before, .expense-entry::after { position: absolute; width: 9px; height: 9px; border: 1px solid var(--line); border-radius: 50%; background: var(--paper, #f8f5e9); content: ''; }
.expense-entry::before { top: 20px; left: -5px; }
.expense-entry::after { right: -5px; bottom: 20px; }
.expense-top { display: contents; }
.expense-top > div:first-child { grid-column: 1; grid-row: 1; min-width: 0; }
.expense-total { display: grid; justify-items: end; align-content: start; gap: 3px; flex: none; text-align: right; }
.expense-top > .expense-total { grid-column: 2; grid-row: 1; }
.expense-total > strong { color: var(--ink); font-size: 19px; }
.expense-total small { color: var(--ink-mute); font-size: 11px; line-height: 1.35; }
.expense-total .expense-meta { max-width: 230px; margin: 0; }
.expense-top h3 { margin: 0 0 4px; font-size: 16px; }
.expense-top p, .expense-meta, .expense-split { margin: 4px 0; color: var(--ink-mute); font-size: 13px; overflow-wrap: anywhere; }
.expense-split { margin-top: 2px !important; }
.expense-entry > .btn { grid-column: 2; grid-row: 2; justify-self: end; }
@media (max-width: 600px) {
  .ledger-page { width: min(100% - 28px, 1180px); padding-top: 26px; }
  .trip-picker { grid-template-columns: minmax(0, 1fr); align-items: stretch; }
  .trip-label { align-self: auto; padding-bottom: 0; }
  .amount-row { grid-template-columns: 1fr; }
  .balance-list li { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .balance-list strong { text-align: right; }
  .expense-total { max-width: 48%; }
  .expense-entry { column-gap: 8px; padding: 15px 13px 14px; }
}
</style>
