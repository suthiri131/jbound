<script setup>
import LedgerSelect from "@/components/common/LedgerSelect.vue";
import BackLabel from "@/components/common/BackLabel.vue";
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage as getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useCampSky } from '@/composables/useCampSky';
import { lookFromId } from '@/lib/camp/look';
import SkyBackdrop from '@/components/scene/SkyBackdrop.vue';
import MarketStall from '@/components/scene/MarketStall.vue';
import AvatarFlat from '@/components/scene/AvatarFlat.vue';
import WanderingEyes from '@/components/common/WanderingEyes.vue';

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
  ticked.value = null;
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
// ---------- the stall scene beside the receipt ----------
const formOpen = ref(false);
const lastSettled = ref('');
const ticked = ref(null); // settlement key whose box is checked, waiting on Confirm
const settling = ref(false);
const settlementKey = (settlement) => `${settlement.from}-${settlement.to}`;

/** Per person: what they paid, what their share came to, and where they stand now (from the API's balances). */
const people = computed(() => members.value.map((member) => {
  const sum = (list, key) => list.reduce((t, x) => t + Number(x[key] || 0), 0);
  const paid = sum(expenses.value.filter((e) => e.paid_by === member.id), 'amount_sgd');
  const sent = sum(transactions.value.filter((t) => t.from_user === member.id), 'amount_sgd');
  const received = sum(transactions.value.filter((t) => t.to_user === member.id), 'amount_sgd');
  const balance = Number(balances.value.find((b) => b.memberId === member.id)?.balanceSgd || 0);
  // balance = paid - share + sent - received, so the share falls out of it
  return { ...member, paid, share: Math.max(0, paid + sent - received - balance), isMe: member.id === auth.user?.id };
}));
// ---------- the crew in front of the stall ----------
const { sky } = useCampSky();
// Continue the backdrop's lowest grass colour through the scrollable page.
const groundColor = computed(() => {
  const [brightness, saturation] = sky.value.landFilter.match(/[\d.]+/g).map(Number);
  const grass = [110, 163, 78]; // #6ea34e, the foreground in SkyBackdrop
  const grey = grass[0] * 0.213 + grass[1] * 0.715 + grass[2] * 0.072;
  return `rgb(${grass.map(channel => Math.round((grey + (channel - grey) * saturation) * brightness)).join(' ')})`;
});
const crewLooks = ref({});
onMounted(async () => {
  try {
    const { data } = await api.get('/auth/crew');
    crewLooks.value = Object.fromEntries(data.map((m) => [m.id, m.look]));
  } catch {
    /* they just get their generated look */
  }
});
const lookFor = (id) => (id === auth.user?.id ? auth.profile?.look : crewLooks.value[id]) || lookFromId(id);
const balanceOf = (id) => Number(balances.value.find((b) => b.memberId === id)?.balanceSgd || 0);
const lineup = computed(() => {
  // you first, up to five people: it is a stall, not a stadium
  const list = [...people.value].sort((a, b) => Number(b.isMe) - Number(a.isMe)).slice(0, 5);
  return list.map((p) => {
    const balance = balanceOf(p.id);
    return { ...p, look: lookFor(p.id), tone: balance > 0.004 ? 'up' : balance < -0.004 ? 'down' : 'even', say: balance > 0.004 ? `is owed ${formatLedgerMoney(balance)}` : balance < -0.004 ? `owes ${formatLedgerMoney(-balance)}` : 'all square' };
  });
});
const stacks = computed(() => people.value.map((p, i) => ({ id: p.id, initial: p.name[0]?.toUpperCase() || '?', amount: p.paid, tint: TILE_TINTS[i % TILE_TINTS.length] })));

const TILE_TINTS = ['#f6d58e', '#bfe3f0', '#c8e6b8', '#f4c4cf', '#d9cdf2', '#f2d0b0'];
const receiptDate = computed(() => {
  const start = selectedTrip.value?.start_date;
  return start ? new Date(`${start}T00:00:00`).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
});
const first = (memberId) => memberName(memberId).split(' ')[0];
const canEdit = (expense) => expense.created_by === auth.user?.id || selectedTrip.value?.myRole === 'owner';
function startEdit(expense) {
  editExpense(expense);
  formOpen.value = true;
}
async function submitExpense() {
  await saveExpense();
  if (!errorMessage.value) formOpen.value = false;
}
function cancelForm() {
  resetForm();
  formOpen.value = false;
}
function toggleTick(settlement, checked) {
  ticked.value = checked ? settlementKey(settlement) : null;
}
async function tickOff(settlement) {
  if (settling.value) return;
  settling.value = true;
  await confirmSettlement(settlement);
  settling.value = false;
  if (!errorMessage.value) {
    ticked.value = null;
    lastSettled.value = `Ticked off: ${first(settlement.from)} is square with you.`;
  }
}

watch(() => route.query.tripId, (value) => {
  if (typeof value === 'string' && value !== tripId.value) { tripId.value = value; loadLedger(); }
});
onMounted(loadTrips);
onMounted(loadConversionRate);
</script>

<template>
  <main class="ledger-camp" :style="{ backgroundColor: groundColor }">
    <SkyBackdrop />
    <RouterLink to="/" class="camp-back back" aria-label="Back to Basecamp"><BackLabel /></RouterLink>

    <section class="stall-scene" aria-label="The market stall: who has paid what">
      <div class="stall-wrap">
        <MarketStall :stacks="stacks" :night="sky.night" />
        <ul class="crew-line">
          <li v-for="p in lineup" :key="p.id" :class="p.tone">
            <span class="say"><b>{{ p.isMe ? 'You' : p.name.split(' ')[0] }}</b> {{ p.say }}</span>
            <AvatarFlat :look="p.look" :height="lineup.length > 3 ? 118 : 138" />
          </li>
        </ul>
      </div>
    </section>

    <div class="receipt-wrap">
      <article class="receipt" aria-labelledby="receipt-title">
        <header class="r-head">
          <LedgerSelect id="trip-picker" v-model="tripId" label="Trip" placeholder="Select a trip"
            :options="trips.map(trip => ({ value: trip.id, label: trip.name }))" @change="chooseTrip" />
          <h1 id="receipt-title" class="r-title" :title="selectedTrip?.name">{{ selectedTrip?.name || 'The Ledger' }}</h1>
          <p class="r-meta">
            <span v-if="receiptDate">{{ receiptDate }} · </span>{{ members.length }} crew<span v-if="conversionRate"> · S$1 = RM{{ conversionRate.toFixed(2) }}</span>
          </p>
          <div class="currency" role="group" aria-label="Show amounts in">
            <button type="button" :aria-pressed="displayCurrency === 'SGD'" @click="displayCurrency = 'SGD'">S$</button>
            <button type="button" :aria-pressed="displayCurrency === 'MYR'" :disabled="!conversionRate" @click="displayCurrency = 'MYR'">RM</button>
          </div>
        </header>

        <p v-if="!trips.length && !loading" class="r-empty">Join or create a trip to open a tab.</p>
        <p v-if="errorMessage" class="error-text" role="alert">{{ errorMessage }}</p>
        <WanderingEyes v-if="loading" center text="Totting up the tab…" />
        <template v-if="tripId && !loading">
          <hr class="dash" />
          <p v-if="!expenses.length" class="r-empty">Nothing on the tab yet. Add the first shared cost below.</p>
          <ul v-else class="items">
            <li v-for="expense in expenses" :key="expense.id">
              <div>
                <strong>{{ expense.description }}</strong>
                <small>
                  Paid by {{ expense.paid_by === auth.user?.id ? 'you' : first(expense.paid_by) }}
                  · split {{ (expense.splitMembers ?? expense.splitAmong ?? []).length }}
                  <template v-if="expense.currency !== 'SGD'"> · {{ formatMoney(expense.amount, expense.currency) }}</template>
                </small>
              </div>
              <span class="amt">{{ formatLedgerMoney(expense.amount_sgd) }}</span>
              <button v-if="canEdit(expense)" type="button" class="edit" :aria-label="`Edit ${expense.description}`" @click="startEdit(expense)">Edit</button>
            </li>
          </ul>

          <hr class="dash" />
          <p class="total"><span>Group total</span><strong>{{ formatLedgerMoney(totalSgd) }}</strong></p>

          <ul v-if="people.length" class="tiles" aria-label="Breakdown per person">
            <li v-for="(p, i) in people" :key="p.id" :style="{ '--tint': TILE_TINTS[i % TILE_TINTS.length] }">
              <strong>{{ p.isMe ? 'You' : p.name.split(' ')[0] }}</strong>
              <small>paid {{ formatLedgerMoney(p.paid) }}</small>
              <small>share {{ formatLedgerMoney(p.share) }}</small>
            </li>
          </ul>

          <h2 class="r-sub">Who owes who</h2>
          <ul v-if="suggestedSettlements.length" class="owes">
            <li v-for="(st, index) in suggestedSettlements" :key="`${st.from}-${st.to}-${index}`">
              <label v-if="st.to === auth.user?.id" class="tick">
                <input type="checkbox" :checked="ticked === settlementKey(st)" :disabled="settling" @change="toggleTick(st, $event.target.checked)" />
                <span>{{ first(st.from) }} owes you</span>
              </label>
              <span v-else class="tick" :class="{ mine: st.from === auth.user?.id }">
                <i class="box" aria-hidden="true" />
                <span>{{ st.from === auth.user?.id ? `You owe ${first(st.to)}` : `${first(st.from)} owes ${first(st.to)}` }}</span>
              </span>
              <strong>{{ formatLedgerMoney(st.amountSgd) }}</strong>
              <small v-if="st.from === auth.user?.id" class="wait">Paid? {{ first(st.to) }} ticks it off once it lands.</small>
              <button
                v-if="st.to === auth.user?.id && ticked === settlementKey(st)"
                type="button"
                class="btn btn-primary btn-sm confirm-paid"
                :disabled="settling"
                :aria-label="`Confirm ${first(st.from)} has paid you ${formatLedgerMoney(st.amountSgd)}`"
                @click="tickOff(st)"
              >
                {{ settling ? 'Confirming…' : 'Confirm' }}
              </button>
            </li>
          </ul>
          <p v-else class="r-empty">{{ expenses.length ? 'Everyone is square. Nice work!' : 'Debts show up here once there is something on the tab.' }}</p>
          <p class="settled-msg" role="status">{{ lastSettled }}</p>

          <details v-if="transactions.length" class="history">
            <summary>Settled up ({{ transactions.length }})</summary>
            <p v-for="t in transactions" :key="t.id">
              <s>{{ first(t.from_user) }} → {{ first(t.to_user) }}</s>
              <span>{{ formatLedgerMoney(t.amount_sgd) }}</span>
            </p>
          </details>

          <hr class="dash" />

          <button v-if="!formOpen" type="button" class="add" @click="formOpen = true">+ Add to the tab</button>
          <form v-else class="add-form" @submit.prevent="submitExpense">
            <h2 class="r-sub">{{ isEditing ? 'Edit expense' : 'Add to the tab' }}</h2>
            <label class="field" for="expense-description">What was it for?
              <input id="expense-description" v-model="form.description" class="input" maxlength="200" placeholder="e.g. Durian at SS2" required />
            </label>
            <div class="two">
              <label class="field" for="expense-amount">Amount
                <input id="expense-amount" v-model.number="form.amount" class="input" type="number" min="0.01" step="0.01" placeholder="0.00" required />
              </label>
              <label class="field" for="expense-currency">Currency
                <LedgerSelect id="expense-currency" v-model="form.currency" label="Currency"
                  :options="[{ value: 'SGD', label: 'S$ SGD' }, { value: 'MYR', label: 'RM MYR' }]" />
              </label>
            </div>
            <label class="field" for="expense-payer">Paid by
              <LedgerSelect id="expense-payer" v-model="form.paidBy" label="Paid by"
                :options="members.map(member => ({ value: member.id, label: member.id === auth.user?.id ? `${member.name} (you)` : member.name }))" />
            </label>
            <fieldset class="split">
              <legend>Split among <button class="link" type="button" @click="toggleCustom">{{ customSplit ? 'Split equally' : 'Custom amounts' }}</button></legend>
              <label v-for="member in members" :key="member.id" class="split-row">
                <input v-model="form.splitAmong" type="checkbox" :value="member.id" />
                <span>{{ member.name }}{{ member.id === auth.user?.id ? ' (you)' : '' }}</span>
                <input v-if="customSplit && form.splitAmong.includes(member.id)" v-model.number="customAmounts[member.id]" class="input custom" type="number" min="0" step="0.01" :aria-label="`${member.name} amount`" />
              </label>
              <small v-if="customSplit" class="split-status" :class="{ complete: customSplitReady, over: customRemaining < 0 }" aria-live="polite">{{ customSplitStatus() }}</small>
            </fieldset>
            <div class="row">
              <button class="btn btn-primary" type="submit" :disabled="saving || !members.length || !form.splitAmong.length || (customSplit && !customSplitReady)">
                {{ saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add it' }}
              </button>
              <button class="btn btn-ghost" type="button" @click="cancelForm">Cancel</button>
            </div>
          </form>

          <div class="convert">
            <label>
              <span class="sr-only">Amount in {{ compassCurrency }}</span>
              <span aria-hidden="true">{{ compassCurrency === 'SGD' ? 'S$' : 'RM' }}</span>
              <input v-model.number="compassAmount" type="number" min="0" step="0.01" />
            </label>
            <button type="button" aria-label="Swap conversion direction" @click="toggleCompassCurrency">⇄</button>
            <output aria-live="polite">≈ {{ compassResult === null ? '—' : formatCompassMoney(compassResult) }}</output>
          </div>
          <small v-if="currencyError" class="r-meta">{{ currencyError }}</small>
        </template>
      </article>
    </div>
  </main>
</template>

<style scoped>
.ledger-camp {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 450px);
  font-family: var(--font-round);
  color: #1f2a24;
  overflow: hidden !important; /* the receipt scrolls on its own, the scene stays put */
}
.back {
  position: absolute;
  z-index: 3;
  top: 18px;
  left: 18px;
}
.stall-scene {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: end center;
  padding: 70px 24px 22px;
}
.stall-wrap {
  position: relative;
  width: min(100%, 720px, calc((100dvh - 180px) * 1.2));
}
.crew-line {
  position: absolute;
  left: 2%;
  right: 12%;
  bottom: -2px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 2%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.crew-line li {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
}
.say {
  max-width: 120px;
  padding: 3px 9px;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  background: #fffdf7;
  font-size: 12px;
  line-height: 1.15;
  text-align: center;
}
.say b {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-weight: 700;
}
.up .say {
  background: #d7efc9;
}
.down .say {
  background: #f8d4cb;
}
.receipt-wrap {
  position: relative;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 30px 48px 8px;
}
.receipt {
  min-width: 0;
  overflow-wrap: anywhere;
  position: relative;
  padding: 22px 22px 34px;
  background: #fffdf7;
  border: 2.5px solid #1f2a24;
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  font-family: var(--font-mono);
  font-size: 13px;
  rotate: 0.7deg;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
  animation: print 0.6s cubic-bezier(0.2, 0.8, 0.3, 1.1) both;
  transform-origin: top center;
}
/* torn zig-zag bottom edge */
.receipt::after {
  content: '';
  position: absolute;
  left: -2.5px;
  right: -2.5px;
  bottom: -14px;
  height: 14px;
  background:
    linear-gradient(-45deg, transparent 7px, #fffdf7 0) 0 0 / 14px 14px repeat-x,
    linear-gradient(45deg, transparent 7px, #fffdf7 0) 0 0 / 14px 14px repeat-x;
  filter: drop-shadow(0 2.5px 0 #1f2a24);
}
@keyframes print {
  from {
    opacity: 0;
    transform: translateY(-24px) scaleY(0.6);
  }
}
.r-head {
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 4px;
}
.r-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  margin: 4px 0 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 32px;
  line-height: 1.05;
}
.r-meta {
  margin: 0;
  font-size: 12px;
  opacity: 0.75;
}
.currency {
  display: inline-flex;
  margin-top: 6px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  overflow: hidden;
}
.currency button {
  border: 0;
  padding: 3px 14px;
  background: transparent;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.currency button[aria-pressed='true'] {
  background: #1f2a24;
  color: #fffdf7;
}
.dash {
  border: 0;
  border-top: 2px dashed #1f2a24;
  opacity: 0.4;
  margin: 14px 0;
}
.r-empty {
  margin: 10px 0;
  text-align: center;
  opacity: 0.75;
}
.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.items li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  grid-template-rows: auto auto;
  gap: 0 10px;
}
.items li > div {
  grid-row: 1 / 3;
}
.items strong {
  display: block;
  font-weight: 700;
}
.items small {
  opacity: 0.7;
  font-size: 11.5px;
}
.amt {
  font-weight: 700;
  text-align: right;
}
.edit {
  grid-column: 2;
  grid-row: 2;
  justify-self: end;
  align-self: start;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 11.5px;
  text-decoration: underline;
  cursor: pointer;
  color: #2e6b46;
}
.total {
  display: flex;
  justify-content: space-between;
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
}
.tiles {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
}
.tiles li {
  display: grid;
  padding: 8px 10px;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  background: var(--tint);
  font-family: var(--font-round);
}
.tiles small {
  font-size: 11.5px;
}
.r-sub {
  margin: 0 0 10px;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 20px;
}
.owes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.owes li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  align-items: center;
  gap: 2px 10px;
  padding: 10px 12px;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  font-family: var(--font-round);
  font-size: 14.5px;
}
.tick {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}
label.tick {
  cursor: pointer;
}
.tick input,
.box {
  appearance: none;
  flex: none;
  width: 22px;
  height: 22px;
  margin: 0;
  border: 2px solid #1f2a24;
  border-radius: 6px;
  background: #fffdf7;
}
.tick input {
  cursor: pointer;
}
.tick input:checked {
  background: #2e6b46 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12l5 5 9-10' fill='none' stroke='white' stroke-width='3'/%3E%3C/svg%3E") center / 80% no-repeat;
}
.tick input:focus-visible {
  outline: 3px solid #1f2a24;
  outline-offset: 2px;
}
.box {
  opacity: 0.35;
}
.tick.mine {
  color: #9e3b1b;
}
.wait {
  grid-column: 1 / -1;
  font-size: 12px;
  opacity: 0.7;
}
.confirm-paid {
  grid-column: 1 / -1;
  justify-self: end;
  margin-top: 6px;
}
.settled-msg {
  margin: 8px 0 0;
  min-height: 1.2em;
  color: #2e6b46;
  font-family: var(--font-round);
  font-weight: 600;
}
.history summary {
  cursor: pointer;
  font-weight: 700;
}
.history p {
  display: flex;
  justify-content: space-between;
  margin: 6px 0 0;
  opacity: 0.7;
}
.add {
  width: 100%;
  min-height: 44px;
  border: 2px dashed #1f2a24;
  border-radius: 10px;
  background: transparent;
  font: inherit;
  font-family: var(--font-round);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}
.add:hover {
  background: #f5bf4f;
}
.add-form {
  display: grid;
  gap: 12px;
  font-family: var(--font-round);
}
.two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.split {
  margin: 0;
  padding: 0;
  border: 0;
  display: grid;
  gap: 6px;
}
.split legend {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.split-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.custom {
  width: 110px;
  min-height: 34px;
  margin-left: auto;
}
.split-status {
  font-size: 12px;
}
.split-status.complete {
  color: #2e6b46;
}
.split-status.over {
  color: #9e3b1b;
}
.convert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f3ead3;
}
.convert label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
}
.convert input {
  width: 90px;
  padding: 4px 6px;
  border: 1.5px solid #1f2a24;
  border-radius: 6px;
  font: inherit;
}
.convert button {
  border: 0;
  background: none;
  font-size: 18px;
  cursor: pointer;
}
.convert output {
  margin-left: auto;
  font-weight: 700;
}


/* Let content shrink inside the receipt instead of widening the page. */
.r-head > *,
.items li > div,
.tiles li,
.tick,
.tick > span,
.field,
.split,
.split-row > span {
  min-width: 0;
}
.total,
.history p {
  flex-wrap: wrap;
  gap: 6px 12px;
}
.total strong,
.history p > span {
  margin-left: auto;
  text-align: right;
}
.add-form .input,
.add-form .select {
  min-width: 0;
  max-width: 100%;
}
.split legend {
  flex-wrap: wrap;
  gap: 6px 12px;
}
.split-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 110px);
}
.split-row > input[type='checkbox'] {
  margin: 0;
}
.custom {
  width: 100%;
}
.convert {
  flex-wrap: wrap;
}
.convert label {
  min-width: 0;
}
.convert output {
  min-width: 0;
}
.crew-line li {
  min-width: 0;
  flex: 1 1 0;
}
.say {
  max-width: 100%;
  overflow-wrap: anywhere;
}
.crew-line :deep(.avatar-flat) {
  max-width: 100%;
  height: auto !important;
  max-height: 138px;
}


@media (max-width: 991.98px) {
  .ledger-camp {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: start;
    overflow-y: auto !important;
  }
  .stall-scene {
    padding: 66px 12px 16px;
  }
  .stall-wrap {
    width: min(100%, 440px);
  }
  .receipt-wrap {
    width: 100%;
    max-width: 640px;
    justify-self: center;
    overflow: visible;
    padding: 12px 20px 44px;
  }
  .receipt {
    rotate: 0deg;
  }
}
@media (max-width: 575.98px) {
  .back {
    top: 14px;
    left: 14px;
  }
  .stall-scene {
    padding: 68px 12px 8px;
  }
  .receipt-wrap {
    padding: 12px 12px 36px;
  }
  .receipt {
    padding: 20px 16px 28px;
  }
  .r-title {
    font-size: 28px;
  }
  .say {
    padding: 3px 4px;
    font-size: 10px;
  }
  .items li {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 10px;
  }
  .items li > div {
    grid-column: 1 / -1;
    grid-row: auto;
  }
  .amt {
    text-align: left;
  }
  .edit {
    grid-row: auto;
  }
  .owes li {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .owes li > strong {
    padding-left: 32px;
  }
  .two {
    grid-template-columns: minmax(0, 1fr);
  }
  .split-row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .custom {
    grid-column: 2;
  }
  .convert output {
    flex-basis: 100%;
  }
  .add-form .row > .btn {
    flex: 1 1 auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .receipt {
    animation: none;
  }
}
</style>
