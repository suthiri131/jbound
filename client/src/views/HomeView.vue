<script setup>
import { ref } from 'vue';
import NavAuth from '@/components/auth/NavAuth.vue';

const tripName = ref('');
const trips = ref([]);
const showTripForm = ref(false);

function createTrip() {
  const name = tripName.value.trim();
  if (!name) return;
  trips.value.push({ id: Date.now(), name });
  tripName.value = '';
  showTripForm.value = false;
}
</script>

<template>
  <div class="home-page">
    <header class="topbar">
      <a class="brand" href="#home" aria-label="JBound home"><img class="brand-logo" src="/favicon.svg" alt="" /> <span>JBound</span></a>
      <div class="topbar-right">
  <span class="route-label">SINGAPORE <i></i> JOHOR BAHRU</span>
  <NavAuth />
</div>
    </header>

    <main id="home">
      <section class="welcome">
        <div>
          <p class="eyebrow">YOUR NEXT GETAWAY STARTS HERE</p>
          <h1>Good trips start <em>together.</em></h1>
          <p class="intro">Bring your people, plans, and little travel details together in one place.</p>
        </div>
        <button class="btn btn-primary" type="button" @click="showTripForm = !showTripForm">
          <span aria-hidden="true">+</span> Plan a trip
        </button>
      </section>

      <section class="trip-section card card-pad" aria-labelledby="trips-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">YOUR CREW</p>
            <h2 id="trips-title">Trip board</h2>
          </div>
          <span class="trip-count">{{ trips.length }} {{ trips.length === 1 ? 'trip' : 'trips' }}</span>
        </div>

        <form v-if="showTripForm" class="trip-form" @submit.prevent="createTrip">
          <label for="trip-name">What are we calling this trip?</label>
          <div class="form-row">
            <input id="trip-name" class="input" v-model="tripName" autofocus placeholder="A weekend in JB" required />
            <button class="btn btn-primary" type="submit">Create trip</button>
          </div>
        </form>

        <ul v-if="trips.length" class="trip-list">
          <li v-for="trip in trips" :key="trip.id">
            <span class="trip-dot" aria-hidden="true"></span>
            <span>{{ trip.name }}</span>
            <span class="trip-destination">Singapore → Johor Bahru</span>
          </li>
        </ul>
        <div v-else class="empty-state">
          <div class="route-art" aria-hidden="true"><span></span><i></i><span></span></div>
          <h3>Your next story starts here.</h3>
          <p>Start a trip and bring your crew together for the crossing.</p>
          <button class="text-button" type="button" @click="showTripForm = true">Create your first trip <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section class="travel-desk" aria-labelledby="desk-title">
        <p class="eyebrow">READY WHEN YOU ARE</p>
        <h2 id="desk-title">Your travel desk</h2>
        <div class="desk-items">
          <article><span>01</span><div><h3>Border watch</h3><p>Check the crossing before you leave.</p></div><b>Coming soon</b></article>
          <article><span>02</span><div><h3>Shared expenses</h3><p>Keep the group tab in S$ and RM.</p></div><b>Coming soon</b></article>
          <article><span>03</span><div><h3>Trip scrapbook</h3><p>Save the places and moments worth keeping.</p></div><b>Coming soon</b></article>
        </div>
      </section>
    </main>

    <footer class="footer"><strong>JBound</strong><span>Make the crossing part of the story.</span></footer>
  </div>
</template>

<style>
body { min-width: 320px; }
button { cursor: pointer; }
.home-page { min-height: 100vh; }
.topbar, main, .footer { width: min(100% - 48px, 1080px); margin-inline: auto; }
.topbar { height: 76px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--ink); }
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-family: var(--font-display); font-size: 19px; }
.brand-logo { width: 36px; height: 36px; }
.route-label { color: var(--ink-mute); font-size: 11px; font-weight: 700; letter-spacing: 1.3px; }
.route-label i { display: inline-block; width: 25px; height: 2px; margin: 0 8px 3px; background: var(--ember); }
main { padding-block: 62px 76px; }
.welcome { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding-bottom: 48px; }
.eyebrow { margin: 0 0 10px; color: var(--jungle); }
h1, h2, h3, p { margin-top: 0; }
h1 { max-width: 700px; margin-bottom: 13px; font-family: var(--font-display); font-size: clamp(36px, 5vw, 58px); font-weight: 400; line-height: 1.13; }
h1 em { color: var(--ember); font-style: normal; }
.intro { max-width: 600px; margin: 0; color: var(--ink-soft); font-size: 15px; line-height: 1.6; }
.btn { white-space: nowrap; }
.btn span { font-size: 21px; font-weight: 400; }
.trip-section { padding: 26px 30px 28px; }
.section-heading { display: flex; justify-content: space-between; align-items: center; }
.section-heading .eyebrow { margin-bottom: 6px; }
h2 { margin-bottom: 0; font-family: var(--font-display); font-size: 25px; font-weight: 400; }
.trip-count { color: var(--ink-mute); font-size: 13px; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 44px 12px 18px; text-align: center; }
.route-art { display: flex; width: min(100%, 200px); align-items: center; margin-bottom: 25px; }
.route-art span { width: 13px; height: 13px; border: 3px solid var(--jungle); border-radius: 50%; background: var(--card); }
.route-art span:last-child { border-color: var(--ember); }
.route-art i { flex: 1; height: 2px; background: repeating-linear-gradient(90deg, var(--line-strong) 0 5px, transparent 5px 10px); }
.empty-state h3 { margin-bottom: 7px; font-family: var(--font-display); font-size: 20px; font-weight: 400; }
.empty-state p { margin-bottom: 16px; color: var(--ink-soft); font-size: 14px; }
.text-button { padding: 5px; border: 0; color: var(--jungle); background: none; font-size: 14px; font-weight: 700; }
.text-button:hover { color: var(--ember); }
.text-button span { margin-left: 5px; font-size: 18px; }
.trip-form { margin-top: 24px; padding: 18px; border: 2px solid var(--ink); border-radius: 8px; background: var(--sage); }
.trip-form label { display: block; margin-bottom: 9px; font-size: 13px; font-weight: 700; }
.form-row { display: flex; gap: 9px; }
.form-row input { flex: 1; min-width: 0; }
.trip-list { margin: 24px 0 0; padding: 0; list-style: none; }
.trip-list li { display: flex; align-items: center; gap: 12px; min-height: 58px; border-top: 1px solid var(--line); font-weight: 600; }
.trip-dot { width: 9px; height: 9px; border: 1px solid var(--ink); border-radius: 50%; background: var(--ember); }
.trip-destination { margin-left: auto; color: var(--ink-mute); font-size: 12px; font-weight: 400; }
.travel-desk { padding-top: 53px; }
.travel-desk > .eyebrow { margin-bottom: 7px; }
.desk-items { margin-top: 17px; border-top: 2px solid var(--ink); }
.desk-items article { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 12px; min-height: 78px; border-bottom: 1px solid var(--line); }
.desk-items article > span { color: var(--ember); font-family: var(--font-display); font-size: 13px; }
.desk-items h3 { margin-bottom: 4px; font-size: 14px; }
.desk-items p { margin: 0; color: var(--ink-soft); font-size: 12px; }
.desk-items b { padding: 6px 8px; border: 1px solid var(--ink); border-radius: 3px; color: var(--ink); background: var(--leaf); font-size: 10px; }
.footer { display: flex; justify-content: space-between; gap: 16px; padding-block: 22px; border-top: 2px solid var(--ink); color: var(--ink-mute); font-size: 12px; }
.footer strong { color: var(--jungle); font-family: var(--font-display); }
.topbar-right { display: flex; align-items: center; gap: 18px; }
@media (max-width: 600px) {
  .topbar, main, .footer { width: min(100% - 32px, 1080px); }
  .topbar { height: 64px; }
  .route-label { font-size: 9px; letter-spacing: .8px; }
  main { padding-top: 40px; }
  .welcome { align-items: stretch; flex-direction: column; padding-bottom: 33px; }
  .welcome .btn { width: 100%; }
  .trip-section { padding: 21px 17px; }
  .form-row { flex-direction: column; }
  .trip-destination { font-size: 10px; }
  .desk-items article { grid-template-columns: 30px 1fr; padding-block: 14px; }
  .desk-items b { grid-column: 2; justify-self: start; }
  .footer { flex-direction: column; }
}
</style>
