<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useAuth } from '@clerk/vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const { getToken, isLoaded, isSignedIn } = useAuth();
const tripId = ref(typeof route.query.tripId === 'string' ? route.query.tripId : '');
const expenses = ref([]);
const members = ref([]);
const balances = ref([]);
const suggestedSettlements = ref([]);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const editingId = ref(null);

const emptyForm = () => ({
  description: '',
  amount: '',
  currency: 'SGD',
  paidBy: '',
  splitAmong: [],
});
const form = reactive(emptyForm());
const isEditing = computed(() => editingId.value !== null);
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function formatMoney(amount, currency = 'SGD') {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(Number(amount));
}

function memberName(memberId) {
  return members.value.find(({ id }) => id === memberId)?.name ?? memberId;
}

async function apiRequest(path, options = {}) {
  if (!isLoaded.value) throw new Error('Authentication is still loading. Try again shortly.');
  if (!isSignedIn.value) throw new Error('Sign in to use the trip ledger.');
  const token = await getToken();
  if (!token) throw new Error('Could not obtain an authentication token for the trip ledger.');

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Ledger request failed (${response.status})`);
  return result;
}

async function loadLedger() {
  if (!tripId.value.trim()) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const path = `/api/trips/${encodeURIComponent(tripId.value.trim())}/expenses`;
    const [ledger, balanceData] = await Promise.all([
      apiRequest(path),
      apiRequest(`${path}/balances`),
    ]);
    expenses.value = ledger.expenses;
    members.value = ledger.members;
    balances.value = balanceData.balances;
    suggestedSettlements.value = balanceData.settlements;
    if (!isEditing.value) {
      if (!members.value.some(({ id }) => id === form.paidBy)) form.paidBy = members.value[0]?.id ?? '';
      form.splitAmong = members.value.map(({ id }) => id);
    }
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = null;
  Object.assign(form, emptyForm(), {
    paidBy: members.value[0]?.id ?? '',
    splitAmong: members.value.map(({ id }) => id),
  });
}

function editExpense(expense) {
  editingId.value = expense.id;
  Object.assign(form, {
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    paidBy: expense.paid_by,
    splitAmong: [...expense.splitAmong],
  });
  document.querySelector('#expense-description')?.focus();
}

async function saveExpense() {
  if (!tripId.value.trim() || !form.splitAmong.length) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const path = `/api/trips/${encodeURIComponent(tripId.value.trim())}/expenses`;
    const result = await apiRequest(
      isEditing.value ? `${path}/${encodeURIComponent(editingId.value)}` : path,
      {
        method: isEditing.value ? 'PUT' : 'POST',
        body: JSON.stringify({
          amount: Number(form.amount),
          currency: form.currency,
          description: form.description.trim(),
          paidBy: form.paidBy,
          splitAmong: form.splitAmong,
        }),
      },
    );
    if (!result.expense) throw new Error('The server did not return the saved expense.');
    resetForm();
    await loadLedger();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    saving.value = false;
  }
}

async function markSettled(settlement) {
  errorMessage.value = '';
  try {
    await apiRequest(`/api/trips/${encodeURIComponent(tripId.value.trim())}/expenses/settlements`, {
      method: 'POST',
      body: JSON.stringify({
        from: settlement.from,
        to: settlement.to,
        amountSgd: settlement.amountSgd,
      }),
    });
    await loadLedger();
  } catch (error) {
    errorMessage.value = error.message;
  }
}

watch(() => route.query.tripId, (value) => {
  if (typeof value === 'string') tripId.value = value;
  loadLedger();
});
onMounted(loadLedger);
</script>

<template>
  <main class="ledger-page">
    <header class="ledger-heading">
      <p class="eyebrow">THE SHARED TAB</p>
      <h1 class="display display-lg">Trip ledger</h1>
      <p class="muted">Track shared costs and settle up in Singapore dollars.</p>
    </header>

    <form class="trip-picker" @submit.prevent="loadLedger">
      <label class="field" for="trip-id">
        Trip ID
        <input id="trip-id" v-model="tripId" class="input" autocomplete="off" placeholder="Paste a trip ID" required />
      </label>
      <button class="btn btn-teal" type="submit" :disabled="loading">Load ledger</button>
    </form>
    <p v-if="errorMessage" class="error-text" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" class="muted" role="status">Loading ledger…</p>

    <section v-if="tripId" class="ledger-content">
      <section class="card card-pad balances" aria-labelledby="balances-heading">
        <h2 id="balances-heading" class="display display-sm">Balances · SGD</h2>
        <ul v-if="balances.length" class="balance-list">
          <li v-for="balance in balances" :key="balance.memberId">
            <span>{{ memberName(balance.memberId) }}</span>
            <strong :class="{ owed: balance.balanceSgd > 0, owes: balance.balanceSgd < 0 }">
              {{ balance.balanceSgd > 0 ? 'is owed ' : balance.balanceSgd < 0 ? 'owes ' : 'settled ' }}
              {{ formatMoney(Math.abs(balance.balanceSgd)) }}
            </strong>
          </li>
        </ul>
        <p v-else class="muted">No balances to settle yet.</p>
        <div v-if="suggestedSettlements.length" class="settle-up">
          <h3>Suggested paybacks</h3>
          <p v-for="(settlement, index) in suggestedSettlements" :key="`${settlement.from}-${settlement.to}-${index}`">
            {{ memberName(settlement.from) }} pays {{ memberName(settlement.to) }}
            <strong>{{ formatMoney(settlement.amountSgd) }}</strong>
            <button class="btn btn-sm" type="button" @click="markSettled(settlement)">Mark paid</button>
          </p>
        </div>
      </section>

      <section class="card card-pad expense-form" aria-labelledby="expense-form-heading">
        <h2 id="expense-form-heading" class="display display-sm">{{ isEditing ? 'Edit expense' : 'Add an expense' }}</h2>
        <form @submit.prevent="saveExpense">
          <label class="field" for="expense-description">
            Description
            <input id="expense-description" v-model="form.description" class="input" maxlength="200" required />
          </label>
          <div class="amount-row">
            <label class="field" for="expense-amount">
              Amount
              <input id="expense-amount" v-model.number="form.amount" class="input" type="number" min="0.01" step="0.01" required />
            </label>
            <label class="field" for="expense-currency">
              Currency paid
              <select id="expense-currency" v-model="form.currency" class="select">
                <option value="SGD">SGD</option>
                <option value="MYR">MYR</option>
              </select>
            </label>
          </div>
          <label class="field" for="expense-payer">
            Paid by
            <select id="expense-payer" v-model="form.paidBy" class="select" required>
              <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
            </select>
          </label>
          <fieldset class="member-picker">
            <legend>Split equally among</legend>
            <label v-for="member in members" :key="member.id">
              <input v-model="form.splitAmong" type="checkbox" :value="member.id" />
              {{ member.name }}
            </label>
          </fieldset>
          <div class="form-actions">
            <button class="btn btn-teal" type="submit" :disabled="saving || !members.length">
              {{ saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add expense' }}
            </button>
            <button v-if="isEditing" class="btn btn-ghost" type="button" @click="resetForm">Cancel edit</button>
          </div>
        </form>
      </section>

      <section class="card card-pad expense-section" aria-labelledby="expenses-heading">
        <div class="expense-title">
          <h2 id="expenses-heading" class="display display-sm">Expenses</h2>
          <span>{{ expenses.length }} {{ expenses.length === 1 ? 'entry' : 'entries' }}</span>
        </div>
        <p v-if="!expenses.length" class="muted">No expenses yet. Add the first shared cost above.</p>
        <div v-else class="table-scroll" role="region" aria-label="Expenses table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">Expense</th>
                <th scope="col">Paid by</th>
                <th scope="col">Original amount</th>
                <th scope="col">SGD equivalent</th>
                <th scope="col">Equal split</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="expense in expenses" :key="expense.id">
                <td>{{ expense.description }}</td>
                <td>{{ expense.paid_by_profile?.name ?? memberName(expense.paid_by) }}</td>
                <td>{{ formatMoney(expense.amount, expense.currency) }} <span class="currency-chip">{{ expense.currency }}</span></td>
                <td>
                  <strong>{{ formatMoney(expense.amount_sgd) }}</strong>
                  <small class="rate-meta">
                    1 {{ expense.currency }} = {{ Number(expense.exchange_rate).toFixed(6) }} SGD
                    · rate date {{ expense.rate_date }}
                  </small>
                </td>
                <td>{{ expense.splitMembers.map((member) => member.name).join(', ') }}</td>
                <td><button class="btn btn-sm" type="button" @click="editExpense(expense)">Edit</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.ledger-page { width: min(100% - 40px, 1180px); margin: 0 auto; padding: 42px 0 72px; }
.ledger-heading { margin-bottom: 22px; }
.ledger-heading h1 { margin: 0 0 8px; }
.ledger-heading p:last-child { margin: 0; }
.trip-picker { display: flex; align-items: end; gap: 12px; max-width: 620px; margin-bottom: 18px; }
.trip-picker .field { flex: 1; min-width: 0; }
.ledger-content { display: grid; gap: 20px; min-width: 0; }
.ledger-content > * { min-width: 0; }
.balances h2, .expense-form h2 { margin-bottom: 14px; }
.balance-list { margin: 0; padding: 0; list-style: none; }
.balance-list li { display: flex; justify-content: space-between; gap: 18px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.balance-list li:last-child { border-bottom: 0; }
.balance-list strong { text-align: right; }
.owed { color: var(--jungle); }
.owes { color: var(--ember); }
.settle-up { margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--line); }
.settle-up h3 { margin-bottom: 8px; font-size: 15px; }
.settle-up p { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }
.amount-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.expense-form form { display: grid; gap: 14px; }
.member-picker { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 8px; }
.member-picker legend { padding: 0 5px; font-size: 13px; font-weight: 700; }
.member-picker label { display: inline-flex; align-items: center; gap: 6px; }
.form-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.expense-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.expense-title span { color: var(--ink-mute); font-size: 13px; }
.table-scroll { width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; }
table { width: 100%; min-width: 820px; border-collapse: collapse; text-align: left; }
th, td { padding: 12px 11px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { white-space: nowrap; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
td { max-width: 260px; overflow-wrap: anywhere; }
.currency-chip { display: inline-block; padding: 1px 6px; border-radius: 999px; background: var(--sage); font-size: 11px; font-weight: 700; }
.rate-meta { display: block; max-width: 190px; margin-top: 3px; color: var(--ink-mute); font-size: 11px; line-height: 1.4; }
@media (max-width: 600px) {
  .ledger-page { width: min(100% - 28px, 1180px); padding-top: 26px; }
  .trip-picker { align-items: stretch; flex-direction: column; }
  .amount-row { grid-template-columns: 1fr; }
  .balance-list li { align-items: start; flex-direction: column; gap: 3px; }
  .balance-list strong { text-align: left; }
}
</style>
