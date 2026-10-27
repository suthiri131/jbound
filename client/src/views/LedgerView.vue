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
const currencyError = ref('');
const editingId = ref(null);
const customSplit = ref(false);
const customAmounts = reactive({});
const displayCurrency = ref('SGD');
const conversionRate = ref(null);
const conversionDate = ref('');
const compassAmount = ref(100);
const compassCurrency = ref('SGD');
const emptyForm = () => ({ description: '', amount: '', currency: 'SGD', paidBy: '', splitAmong: [] });
const form = reactive(emptyForm());
const isEditing = computed(() => editingId.value !== null);
const selectedTrip = computed(() => trips.value.find((trip) => trip.id === tripId.value));
const totalSgd = computed(() => expenses.value.reduce((total, expense) => total + Number(expense.amount_sgd || 0), 0));
const displayRate = computed(() => displayCurrency.value === 'MYR' ? conversionRate.value : 1);
const compassResult = computed(() => {
  if (!conversionRate.value) return null;
  return Number(compassAmount.value || 0) * (
    compassCurrency.value === 'SGD' ? conversionRate.value : 1 / conversionRate.value
  );
});
const recentTrip = (list) => [...list].sort((a, b) =>
  (b.created_at || b.start_date || '').localeCompare(a.created_at || a.start_date || ''),
)[0];

function formatMoney(amount, currency = 'SGD') {
  const numericAmount = Number(amount);
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}
function formatLedgerMoney(amountSgd) {
  const rate = displayRate.value;
  const amount = Number(amountSgd || 0) * (rate || 1);
  return formatMoney(amount, displayCurrency.value);
}
function formatCompassMoney(amount) {
  const targetCurrency = compassCurrency.value === 'SGD' ? 'MYR' : 'SGD';
  return formatMoney(amount, targetCurrency);
}
function initials(memberId) {
  return memberName(memberId).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
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
async function loadConversionRate() {
  currencyError.value = '';
  try {
    const { data } = await api.get('/currency/rate', { params: { from: 'SGD', to: 'MYR' } });
    conversionRate.value = Number(data.rate);
    conversionDate.value = data.date || '';
  } catch (error) {
    currencyError.value = getErrorMessage(error, 'Could not load the SGD/MYR exchange rate');
  }
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
function editExpense(expense) {
  editingId.value = expense.id; customSplit.value = false;
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
function toggleCompassCurrency() {
  compassCurrency.value = compassCurrency.value === 'SGD' ? 'MYR' : 'SGD';
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
    resetForm(); await loadLedger();
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
onMounted(loadConversionRate);
</script>

<template>
  <main class="ledger-page">
    <header class="ledger-heading">
      <div class="heading-copy">
        <p class="eyebrow">THE SHARED TAB</p>
        <h1 class="display display-xl">Expense <span>Ledger.</span></h1>
        <p class="muted">Log it in ringgit or dollars as you go. The ledger converts everything and works out the fewest transfers to settle up.</p>
      </div>
      <div class="heading-tools">
        <label class="trip-picker" for="trip-picker">
          <span>Trip</span>
          <select id="trip-picker" v-model="tripId" class="select" @change="chooseTrip">
            <option value="" disabled>Select a trip</option>
            <option v-for="trip in trips" :key="trip.id" :value="trip.id">{{ trip.name }}</option>
          </select>
        </label>
        <div class="currency-toggle" role="group" aria-label="Balance display currency">
          <button type="button" :aria-pressed="displayCurrency === 'SGD'" @click="displayCurrency = 'SGD'">S$ SGD</button>
          <button type="button" :aria-pressed="displayCurrency === 'MYR'" :disabled="!conversionRate" @click="displayCurrency = 'MYR'">RM MYR</button>
        </div>
        <small v-if="conversionRate" class="rate-caption">
          1 SGD = {{ conversionRate.toFixed(4) }} MYR<span v-if="conversionDate"> · Rate date {{ conversionDate }}</span>
        </small>
        <small v-else-if="currencyError" class="rate-caption rate-error" role="status">{{ currencyError }}</small>
      </div>
    </header>

    <p v-if="!trips.length && !loading" class="muted">Join or create a trip to start a ledger.</p>
    <p v-if="errorMessage" class="error-text" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" class="muted" role="status">Loading ledger…</p>

    <section v-if="tripId && !loading" class="ledger-content">
      <div class="overview-grid">
        <section class="haul-card" aria-labelledby="balances-heading">
          <p class="eyebrow">TOTAL HAUL SO FAR</p>
          <h2 id="balances-heading" class="display haul-total">{{ formatLedgerMoney(totalSgd) }}</h2>
          <p class="haul-meta">{{ expenses.length }} {{ expenses.length === 1 ? 'expense' : 'expenses' }} · {{ members.length }} {{ members.length === 1 ? 'explorer' : 'explorers' }}</p>
          <ul v-if="balances.length" class="balance-list">
            <li v-for="balance in balances" :key="balance.memberId">
              <span>{{ memberName(balance.memberId) }}{{ balance.memberId === auth.user?.id ? ' (you)' : '' }}</span>
              <strong :class="{ owed: balance.balanceSgd > 0, owes: balance.balanceSgd < 0 }">
                {{ balance.balanceSgd > 0 ? '+' : balance.balanceSgd < 0 ? '−' : '' }}{{ formatLedgerMoney(Math.abs(balance.balanceSgd)) }}
              </strong>
            </li>
          </ul>
          <p v-else class="haul-empty">No balances to settle yet.</p>
        </section>

        <section class="iou-section" aria-labelledby="iou-heading">
          <div class="section-heading">
            <h2 id="iou-heading" class="display display-sm">IOU slips</h2>
            <span class="hand muted">fewest transfers to square up</span>
          </div>
          <div v-if="suggestedSettlements.length" class="iou-grid">
            <article
              v-for="(settlement, index) in suggestedSettlements"
              :key="`${settlement.from}-${settlement.to}-${index}`"
              class="iou-card"
              :class="{ 'iou-paid': settlement.to === auth.user?.id }"
            >
              <div class="iou-route">
                <span class="avatar">{{ initials(settlement.from) }}</span>
                <span class="route-arrow" aria-hidden="true">→</span>
                <span class="avatar avatar-to">{{ initials(settlement.to) }}</span>
              </div>
              <p class="iou-names">{{ memberName(settlement.from) }} pays {{ memberName(settlement.to) }}</p>
              <strong class="iou-amount">{{ formatLedgerMoney(settlement.amountSgd) }}</strong>
              <div class="iou-action">
                <button v-if="settlement.to === auth.user?.id" class="btn btn-sm" type="button" @click="confirmSettlement(settlement)">Mark as settled</button>
                <span v-else class="muted">Awaiting {{ memberName(settlement.to) }} to confirm</span>
              </div>
            </article>
          </div>
          <p v-else class="no-ious">{{ expenses.length ? 'Everyone is square. Nice work!' : 'Your IOU slips will show up here once expenses are added.' }}</p>
          <div v-if="transactions.length" class="settlement-history">
            <h3>Settled up</h3>
            <p v-for="transaction in transactions" :key="transaction.id">
              <span>{{ memberName(transaction.from_user) }} paid {{ memberName(transaction.to_user) }}</span>
              <strong>{{ formatLedgerMoney(transaction.amount_sgd) }}</strong>
              <small>{{ new Date(transaction.created_at).toLocaleDateString() }}</small>
            </p>
          </div>
        </section>
      </div>

      <section class="currency-compass" aria-labelledby="compass-heading">
        <div class="compass-copy">
          <h2 id="compass-heading" class="display display-sm">Currency compass</h2>
          <p>Quick check at the stall before you pay.</p>
        </div>
        <label class="compass-value">
          <span>YOU HAVE · {{ compassCurrency }}</span>
          <input v-model.number="compassAmount" type="number" min="0" step="0.01" aria-label="Amount to convert" />
        </label>
        <button class="compass-swap" type="button" aria-label="Swap conversion direction" @click="toggleCompassCurrency">⇄</button>
        <div class="compass-value compass-output" aria-live="polite">
          <span>THAT’S ABOUT · {{ compassCurrency === 'SGD' ? 'MYR' : 'SGD' }}</span>
          <strong>{{ compassResult === null ? 'Rate unavailable' : formatCompassMoney(compassResult) }}</strong>
        </div>
      </section>
      <section class="ledger-grid">
        <section class="expense-form" aria-labelledby="expense-form-heading">
          <div class="section-heading">
            <h2 id="expense-form-heading" class="display display-sm">{{ isEditing ? 'Edit expense' : 'Log a supply run' }}</h2>
            <button class="form-reset" type="button" @click="resetForm">Clear</button>
          </div>
          <form @submit.prevent="saveExpense">
            <label class="field" for="expense-description">What was it for?
              <input id="expense-description" v-model="form.description" class="input" maxlength="200" placeholder="e.g. Durian at the night market" required />
            </label>
            <div class="amount-row">
              <label class="field" for="expense-amount">Amount
                <input id="expense-amount" v-model.number="form.amount" class="input" type="number" min="0.01" step="0.01" placeholder="0.00" required />
              </label>
              <label class="field" for="expense-currency">Currency
                <select id="expense-currency" v-model="form.currency" class="select"><option value="SGD">SGD · S$</option><option value="MYR">MYR · RM</option></select>
              </label>
            </div>
            <label class="field" for="expense-payer">Paid by
              <select id="expense-payer" v-model="form.paidBy" class="select"><option v-for="member in members" :key="member.id" :value="member.id">{{ member.id === auth.user?.id ? `${member.name} (you)` : member.name }}</option></select>
            </label>
            <fieldset class="member-picker">
              <legend>Split among</legend>
              <p class="split-choice">
                <span>{{ customSplit ? 'Set each person’s share' : 'Split the amount equally' }}</span>
                <button class="form-reset" type="button" @click="toggleCustom">{{ customSplit ? 'Use equal split' : 'Customize' }}</button>
              </p>
              <template v-if="customSplit">
                <label v-for="member in members" :key="member.id" class="custom-member">
                  <input v-model="form.splitAmong" type="checkbox" :value="member.id" />
                  <span>{{ member.name }}</span>
                  <input v-if="form.splitAmong.includes(member.id)" v-model.number="customAmounts[member.id]" class="input custom-amount" type="number" min="0" step="0.01" :aria-label="`${member.name} amount`" />
                </label>
                <small class="split-status" :class="{ complete: customSplitReady, over: customRemaining < 0 }" aria-live="polite">
                  {{ customSplitStatus() }} out of {{ formatMoney(form.amount || 0, form.currency) }}
                  <template v-if="form.splitAmong.length === 2"> · Assigning {{ formatMoney(7, form.currency) }} out of {{ formatMoney(12, form.currency) }} leaves {{ formatMoney(5, form.currency) }}.</template>
                </small>
              </template>
              <div v-else class="split-members">
                <label v-for="member in members" :key="member.id">
                  <input v-model="form.splitAmong" type="checkbox" :value="member.id" />
                  {{ member.name }}{{ member.id === auth.user?.id ? ' (you)' : '' }}
                </label>
              </div>
            </fieldset>
            <div class="form-actions">
              <button class="btn btn-teal add-expense" type="submit" :disabled="saving || !members.length || !form.splitAmong.length || (customSplit && !customSplitReady)">
                {{ saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add to the ledger' }}
              </button>
              <button v-if="isEditing" class="btn btn-ghost" type="button" @click="resetForm">Cancel edit</button>
            </div>
          </form>
        </section>

        <section class="expense-section" aria-labelledby="expenses-heading">
          <div class="section-heading">
            <h2 id="expenses-heading" class="display display-sm">The ledger</h2>
            <span class="hand muted">{{ expenses.length }} {{ expenses.length === 1 ? 'entry' : 'entries' }}</span>
          </div>
          <p v-if="!expenses.length" class="muted empty-ledger">No expenses yet. Add the first shared cost.</p>
          <div v-else class="ledger-table-wrap">
            <table class="ledger-table">
              <thead><tr><th scope="col">Item</th><th scope="col">Paid by</th><th scope="col">Split</th><th scope="col">Amount</th></tr></thead>
              <tbody>
                <tr v-for="expense in expenses" :key="expense.id">
                  <td>
                    <strong>{{ expense.description }}</strong>
                    <small>{{ new Date(expense.created_at).toLocaleDateString() }} · {{ formatMoney(expense.amount_sgd) }} SGD equivalent</small>
                    <button v-if="expense.created_by === auth.user?.id || selectedTrip?.myRole === 'owner'" class="edit-expense" type="button" @click="editExpense(expense)">Edit entry</button>
                  </td>
                  <td>{{ expense.paid_by_profile?.name ?? memberName(expense.paid_by) }}</td>
                  <td>{{ (expense.splitMembers ?? []).map((person) => person.name).join(', ') || '—' }}</td>
                  <td class="table-amount">
                    <strong>{{ formatMoney(expense.amount, expense.currency) }}</strong>
                    <small>1 {{ expense.currency }} = {{ Number(expense.exchange_rate || 0).toFixed(4) }} SGD · {{ expense.rate_date || '—' }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </section>
  </main>
</template>

<style scoped>
.ledger-page { width: min(100% - 48px, 1440px); margin: 0 auto; padding: 38px 0 72px; }
.ledger-heading { display: flex; align-items: end; justify-content: space-between; gap: 32px; margin-bottom: 26px; }
.heading-copy { max-width: 690px; }
.heading-copy .eyebrow { margin-bottom: 5px; }
.heading-copy h1 { margin: 0 0 10px; font-size: clamp(42px, 5vw, 70px); }
.heading-copy h1 span { color: var(--teal); }
.heading-copy > p:last-child { max-width: 520px; margin: 0; font-size: 16px; }
.heading-tools { display: grid; justify-items: end; gap: 8px; min-width: 220px; }
.trip-picker { display: grid; grid-template-columns: auto minmax(150px, 220px); align-items: center; gap: 8px; color: var(--ink); font-weight: 700; }
.trip-picker select { min-width: 0; }
.currency-toggle { display: flex; overflow: hidden; border: 2px solid var(--ink); border-radius: 24px; background: var(--card); }
.currency-toggle button { min-height: 38px; padding: 0 16px; border: 0; background: transparent; color: var(--ink); font-size: 13px; font-weight: 800; cursor: pointer; }
.currency-toggle button[aria-pressed="true"] { background: var(--teal); color: var(--card); }
.currency-toggle button:disabled { opacity: .5; cursor: not-allowed; }
.rate-caption { color: var(--ink-mute); font-size: 11px; text-align: right; }
.rate-error { max-width: 280px; color: var(--ember); }
.ledger-content { display: grid; gap: 24px; min-width: 0; }
.overview-grid { display: grid; grid-template-columns: minmax(300px, .8fr) minmax(0, 1.45fr); gap: 22px; align-items: stretch; }
.haul-card { padding: 22px 24px; border: 2px solid var(--ink); border-radius: var(--radius); background: var(--teal); color: var(--card); box-shadow: var(--shadow); }
.haul-card .eyebrow { color: #bcd3c4; font-size: 11px; }
.haul-total { margin: 7px 0 3px; color: var(--sand); font-size: clamp(32px, 4vw, 48px); overflow-wrap: anywhere; }
.haul-meta { margin: 0 0 15px; color: #d9e4d9; font-size: 13px; }
.balance-list { margin: 0; padding: 0; list-style: none; }
.balance-list li { display: flex; justify-content: space-between; gap: 16px; padding: 7px 0; border-top: 1px dashed rgb(255 255 255 / 26%); font-size: 13px; }
.balance-list strong { text-align: right; white-space: nowrap; }
.balance-list .owed { color: #c8dfbf; }
.balance-list .owes { color: #f2cdb8; }
.haul-empty { margin: 12px 0 0; color: #d9e4d9; font-size: 13px; }
.iou-section { min-width: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.section-heading h2 { margin: 0; }
.section-heading .hand { flex: none; font-size: 20px; }
.iou-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.iou-card { display: flex; flex-direction: column; min-height: 190px; padding: 16px 18px; border: 2px solid var(--ink); border-radius: 12px; background: var(--sage); box-shadow: var(--shadow-sm); }
.iou-card:nth-child(even) { background: var(--card); }
.iou-route { display: flex; align-items: center; gap: 9px; }
.avatar { display: grid; width: 36px; height: 36px; place-items: center; border: 2px solid var(--ink); border-radius: 50%; background: var(--clay); font-size: 12px; font-weight: 800; }
.avatar-to { background: var(--sage); }
.route-arrow { font-size: 22px; }
.iou-names { margin: 9px 0 1px; font-size: 14px; font-weight: 700; }
.iou-amount { color: var(--teal); font-family: var(--font-display); font-size: clamp(25px, 2.5vw, 34px); line-height: 1.2; }
.iou-action { display: flex; align-items: center; min-height: 48px; margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--line-strong); }
.iou-action .muted { font-size: 12px; }
.iou-paid { background: var(--sage); }
.no-ious { display: grid; min-height: 140px; place-items: center; padding: 20px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); color: var(--ink-mute); text-align: center; }
.settlement-history { margin-top: 14px; padding: 13px 16px; border: 2px solid var(--ink); border-radius: 12px; background: var(--card); }
.settlement-history h3 { margin: 0 0 6px; font-size: 14px; }
.settlement-history p { display: flex; align-items: center; gap: 10px; margin: 5px 0 0; font-size: 13px; }
.settlement-history p span { flex: 1; }
.settlement-history small { color: var(--ink-mute); }
.currency-compass { display: grid; grid-template-columns: minmax(190px, 1fr) minmax(170px, .95fr) auto minmax(190px, 1fr); align-items: center; gap: 14px; padding: 18px 20px; border: 2px solid var(--ink); border-radius: var(--radius); background: var(--card); box-shadow: var(--shadow); }
.compass-copy h2 { margin: 0 0 4px; }
.compass-copy p { margin: 0; color: var(--ink-mute); font-size: 13px; }
.compass-value { display: grid; gap: 3px; min-width: 0; padding: 10px 14px; border: 2px solid var(--ink); border-radius: 9px; background: var(--paper-deep); }
.compass-value > span { font-size: 10px; font-weight: 800; letter-spacing: 1.4px; }
.compass-value input, .compass-value strong { width: 100%; min-width: 0; padding: 0; border: 0; background: transparent; color: var(--ink); font-family: var(--font-display); font-size: clamp(22px, 2.5vw, 30px); }
.compass-output { background: var(--sage); }
.compass-swap { width: 44px; height: 44px; border: 2px solid var(--ink); border-radius: 50%; background: var(--mustard); box-shadow: var(--shadow-sm); font-size: 24px; cursor: pointer; }
.currency-error { margin: -15px 0 0; color: var(--ember); font-size: 12px; }
.ledger-grid { display: grid; grid-template-columns: minmax(340px, .82fr) minmax(0, 1.25fr); gap: 22px; align-items: start; }
.expense-form, .expense-section { min-width: 0; padding: 20px 22px; border: 2px solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow); }
.expense-form { background: var(--paper-deep); }
.expense-section { background: var(--card); }
.expense-form form { display: grid; gap: 13px; }
.expense-form .field { display: grid; gap: 5px; color: var(--ink); font-size: 13px; font-weight: 700; }
.expense-form .input, .expense-form .select { width: 100%; min-width: 0; }
.amount-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(115px, .55fr); gap: 12px; }
.member-picker { display: grid; gap: 9px; margin: 0; padding: 10px 12px 12px; border: 2px dashed var(--ink-soft); border-radius: 10px; }
.member-picker legend { padding: 0 6px; font-weight: 800; }
.split-choice { display: flex; justify-content: space-between; gap: 12px; margin: 0; font-size: 12px; color: var(--ink-mute); }
.form-reset, .edit-expense { border: 0; background: none; color: var(--teal); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.split-members { display: flex; flex-wrap: wrap; gap: 9px 15px; }
.split-members label { display: inline-flex; align-items: center; gap: 7px; font-weight: 700; }
.split-members input, .custom-member input[type="checkbox"] { accent-color: var(--teal); }
.custom-member { display: grid; grid-template-columns: auto minmax(80px, 1fr) minmax(90px, 125px); align-items: center; gap: 8px; }
.custom-amount { min-width: 0; padding: 8px; }
.split-status { color: var(--ink-mute); font-size: 12px; line-height: 1.5; }
.split-status.complete { color: var(--jungle); font-weight: 700; }
.split-status.over { color: var(--ember); font-weight: 700; }
.form-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.add-expense { width: 100%; }
.ledger-table-wrap { overflow-x: auto; }
.ledger-table { width: 100%; border-collapse: collapse; text-align: left; }
.ledger-table th { padding: 9px 8px; border-bottom: 2px solid var(--ink); font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; }
.ledger-table td { padding: 12px 8px; border-bottom: 1px dashed var(--line-strong); vertical-align: top; font-size: 13px; }
.ledger-table td:first-child { min-width: 165px; }
.ledger-table td:nth-child(2) { min-width: 82px; }
.ledger-table td:nth-child(3) { min-width: 120px; }
.ledger-table td:last-child { min-width: 130px; }
.ledger-table td strong, .ledger-table td small { display: block; }
.ledger-table td small { margin-top: 4px; color: var(--ink-mute); font-size: 10px; line-height: 1.4; }
.ledger-table .table-amount { text-align: right; }
.edit-expense { margin-top: 5px; font-size: 11px; }
.empty-ledger { padding: 20px 0; }
@media (max-width: 900px) {
  .ledger-heading { align-items: start; flex-direction: column; gap: 18px; }
  .heading-tools { width: 100%; grid-template-columns: 1fr auto; justify-items: start; align-items: center; }
  .rate-caption { grid-column: 2; }
  .overview-grid { grid-template-columns: 1fr; }
  .ledger-grid { grid-template-columns: 1fr; }
  .currency-compass { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .compass-copy { grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .ledger-page { width: min(100% - 28px, 1440px); padding-top: 25px; }
  .heading-copy h1 { font-size: clamp(40px, 12vw, 56px); }
  .heading-copy > p:last-child { font-size: 14px; }
  .heading-tools { grid-template-columns: 1fr; justify-items: stretch; }
  .trip-picker { grid-template-columns: 1fr; gap: 4px; }
  .currency-toggle { justify-self: start; }
  .rate-caption { grid-column: auto; text-align: left; }
  .haul-card { padding: 19px; }
  .iou-grid { grid-template-columns: 1fr; }
  .section-heading { align-items: start; }
  .section-heading .hand { font-size: 17px; }
  .currency-compass { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 9px; padding: 14px; }
  .compass-copy { grid-column: 1 / -1; }
  .compass-value { padding: 9px; }
  .compass-value > span { font-size: 8px; letter-spacing: .8px; }
  .compass-value input, .compass-value strong { font-size: 19px; }
  .compass-swap { width: 38px; height: 38px; }
  .expense-form, .expense-section { padding: 17px 14px; }
  .amount-row { grid-template-columns: minmax(0, 1fr) minmax(105px, .7fr); gap: 8px; }
  .ledger-table { min-width: 600px; }
  .settlement-history p { flex-wrap: wrap; }
}
</style>
