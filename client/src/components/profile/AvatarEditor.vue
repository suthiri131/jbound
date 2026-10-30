<script setup>

import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/lib/api';
import { AVATAR_TYPES, prepareAvatar } from '@/utils/avatarImage';
import UserAvatar from '@/components/common/UserAvatar.vue';

const auth = useAuthStore();
const fileInput = ref(null);
const pending = ref(null); // the cropped File waiting to be saved
const previewUrl = ref('');
const busy = ref(false);
const status = ref('');
const error = ref('');

const hasPhoto = computed(() => Boolean(auth.profile?.avatar_url));
const shownUrl = computed(() => previewUrl.value || auth.profile?.avatar_url || '');
const alt = computed(() => (previewUrl.value ? 'Preview of your new profile photo' : hasPhoto.value ? 'Your current profile photo' : ''));
const describedBy = computed(() => (error.value ? 'avatar-hint avatar-error' : 'avatar-hint'));

function forgetPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  pending.value = null;
}
function resetInput() {
  if (fileInput.value) fileInput.value.value = '';
}
async function focusInput() {
  await nextTick();
  fileInput.value?.focus();
}
onBeforeUnmount(forgetPreview);

async function onPick(event) {
  const file = event.target.files?.[0];
  if (!file) return; // the picker was cancelled
  error.value = '';
  status.value = 'Getting your photo ready…';
  busy.value = true;
  try {
    const prepared = await prepareAvatar(file);
    forgetPreview();
    pending.value = prepared;
    previewUrl.value = URL.createObjectURL(prepared);
    status.value = 'Photo chosen, but not saved yet. Choose “Save photo” to use it.';
  } catch (err) {
    status.value = '';
    error.value = err?.userMessage || 'We could not read that photo. Please try another one.';
    resetInput();
  } finally {
    busy.value = false;
  }
}

async function save() {
  if (!pending.value || busy.value) return;
  error.value = '';
  status.value = 'Saving your photo…';
  busy.value = true;
  try {
    await auth.setAvatar(pending.value);
    forgetPreview();
    resetInput();
    status.value = 'Your profile photo has been updated.';
    await focusInput(); // the Save button is about to disappear
  } catch (err) {
    status.value = '';
    error.value = errorMessage(err, 'We could not save your photo. Please try again.');
  } finally {
    busy.value = false;
  }
}

function cancel() {
  if (busy.value) return;
  forgetPreview();
  resetInput();
  error.value = '';
  status.value = 'Cancelled. Your profile photo has not changed.';
  focusInput();
}

async function remove() {
  if (busy.value) return;
  error.value = '';
  status.value = 'Removing your photo…';
  busy.value = true;
  try {
    await auth.removeAvatar();
    status.value = 'Your profile photo has been removed.';
    await focusInput(); // the Remove button is about to disappear
  } catch (err) {
    status.value = '';
    error.value = errorMessage(err, 'We could not remove your photo. Please try again.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card-flat card-pad block" aria-labelledby="photo-title" :aria-busy="busy">
    <h2 id="photo-title" class="display display-sm">Profile photo</h2>

    <div class="photo">
      <UserAvatar class="preview" :name="auth.profile?.name" :url="shownUrl" :size="96" :alt="alt" />

      <div class="controls">
        <div class="field">
          <label for="avatar-file">Choose a photo</label>
          <input
            id="avatar-file"
            ref="fileInput"
            class="file"
            type="file"
            :accept="AVATAR_TYPES.join(',')"
            :disabled="busy"
            :aria-describedby="describedBy"
            @change="onPick"
          />
          <p id="avatar-hint" class="hint">
            JPG, PNG or WebP. Your browser crops it to a square before it is sent, which also removes hidden details such
            as where the photo was taken.
          </p>
        </div>

        <div v-if="pending || hasPhoto" class="row buttons">
          <template v-if="pending">
            <button type="button" class="btn btn-primary" :aria-disabled="busy" @click="save">Save photo</button>
            <button type="button" class="btn btn-ghost" :aria-disabled="busy" @click="cancel">Cancel</button>
          </template>
          <button v-else type="button" class="btn btn-ghost" :aria-disabled="busy" @click="remove">Remove photo</button>
        </div>

        <p v-if="!hasPhoto && !pending" class="hint">No photo yet, so your initials are shown instead.</p>

        <!-- always in the DOM so screen readers announce changes to the text -->
        <p class="status" role="status">{{ status }}</p>
        <p v-if="error" id="avatar-error" class="error-text" role="alert">{{ error }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The global focus ring (mustard) is only ~2:1 against the paper background; WCAG wants 3:1 for focus indicators. */
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.block h2 { margin-bottom: 14px; }
.photo { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px 24px; }
.preview { border: 2px solid var(--ink); }
.controls { flex: 1 1 260px; display: grid; gap: 12px; min-width: 0; }
.hint { margin: 0; font-size: 14px; color: var(--ink-mute); }
.status { margin: 0; min-height: 1.4em; font-size: 14px; font-weight: 600; }
.buttons { gap: 12px; }
.file { max-width: 100%; font: inherit; }
.file::file-selector-button {
  min-height: 44px; margin-right: 12px; padding: 0 14px; cursor: pointer;
  border: 2px solid var(--ink); border-radius: 10px; background: var(--card); color: var(--ink); font: inherit; font-weight: 700;
}
</style>
