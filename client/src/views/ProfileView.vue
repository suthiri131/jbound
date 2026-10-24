<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { assetUrl, errorMessage } from '@/lib/api';
import { initials } from '@/utils/format';
import DeleteAccountModal from '@/components/profile/DeleteAccountModal.vue';

const auth = useAuthStore();
const router = useRouter();

const heading = ref(null);
// A single-page app does not reload, so move focus to the page heading: screen readers then announce the new page.
onMounted(() => heading.value?.focus({ preventScroll: true }));

const name = computed(() => auth.profile?.name || '');
const avatarUrl = computed(() => assetUrl(auth.profile?.avatar_url));

const showDelete = ref(false);
const busy = ref(false);
const error = ref('');
const blockedTrips = ref([]);

function openDelete() {
  error.value = '';
  blockedTrips.value = [];
  showDelete.value = true;
}

async function confirmDelete(password) {
  busy.value = true;
  error.value = '';
  blockedTrips.value = [];
  try {
    // go to the public "deleted" page before signing out, so the auth guard does not bounce us to /sign-in
    await auth.deleteAccount(password, () => router.replace({ name: 'account-deleted' }));
  } catch (err) {
    blockedTrips.value = err?.response?.data?.details?.trips || [];
    error.value = errorMessage(err, 'We could not delete your account. Please try again.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="container page profile">
    <header class="head">
      <div class="avatar" aria-hidden="true">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" />
        <span v-else>{{ initials(name) }}</span>
      </div>
      <div>
        <p class="eyebrow accent">Account</p>
        <h1 ref="heading" class="display display-lg" tabindex="-1">Your profile</h1>
      </div>
    </header>

    <section class="card-flat card-pad block" aria-labelledby="details-title">
      <h2 id="details-title" class="display display-sm">Your details</h2>
      <dl class="details">
        <div>
          <dt>Name</dt>
          <dd>{{ name }}</dd>
        </div>
        <div>
          <dt>Username</dt>
          <dd>@{{ auth.profile?.username }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ auth.user?.email }}</dd>
        </div>
      </dl>
    </section>

    <section class="card-flat card-pad block danger" aria-labelledby="danger-title">
      <h2 id="danger-title" class="display display-sm">Delete account</h2>
      <p>Permanently delete your JBound account. This cannot be undone.</p>
      <ul class="effects">
        <li>Your profile, tales, comments and likes are deleted, and so are the photos and memories you added.</li>
        <li>You leave every trip you have joined. Trips that only you are in are deleted too.</li>
        <li>If you own a trip that other people are in, delete it or remove them first. We will tell you which.</li>
        <li>You will need your password to confirm.</li>
      </ul>
      <button type="button" class="btn delete-button" aria-haspopup="dialog" @click="openDelete">Delete account…</button>
    </section>

    <DeleteAccountModal
      v-if="showDelete"
      :busy="busy"
      :error="error"
      :blocked-trips="blockedTrips"
      @close="showDelete = false"
      @confirm="confirmDelete"
    />
  </main>
</template>

<style scoped>
/* The global focus ring (mustard) is only ~2:1 against the paper background; WCAG wants 3:1 for focus indicators. */
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.profile { max-width: 760px; }
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 20px; margin-bottom: 24px; }
.avatar {
  display: grid; place-items: center; flex: none; overflow: hidden;
  width: 72px; height: 72px; border: 2px solid var(--ink); border-radius: 50%;
  background: var(--sage); font-size: 26px; font-weight: 800;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.block { margin-bottom: 24px; }
.block h2 { margin-bottom: 14px; }
.details { display: grid; gap: 14px; margin: 0; }
.details dt { font-size: 13px; font-weight: 700; color: var(--ink-mute); }
.details dd { margin: 2px 0 0; font-size: 17px; overflow-wrap: anywhere; }
.danger { border-color: var(--brick); }
.danger h2 { color: var(--brick); }
.danger p { margin: 0 0 10px; }
.effects { margin: 0 0 18px; padding-left: 22px; display: grid; gap: 6px; }
.delete-button { background: #a12b20; color: var(--card); }
@media (min-width: 560px) {
  .details > div { display: grid; grid-template-columns: 140px 1fr; align-items: baseline; gap: 12px; }
  .details dd { margin: 0; }
}
</style>
