<script setup>
import { ref, reactive, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api, assetUrl, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { VIBE_LABEL, VIBE_TINT } from '@/utils/constants';
import { timeAgo, initials } from '@/utils/format';
import { askConfirm, showAlert } from '@/lib/dialog';

/** The tales about one place: a saved place (placeId) or a typed-in name (customName). */
const props = defineProps({
  placeId: { type: String, default: undefined },
  customName: { type: String, default: undefined },
});

const route = useRoute();
const auth = useAuthStore();

const posts = defineModel('posts', { type: Array, default: () => [] });
const loading = ref(false);
const error = ref('');
const openComments = reactive({});
const commentDraft = reactive({});

// Profile photos. Your own comes from the auth store so a new photo shows straight away;
// a photo that fails to load falls back to the initials.
const brokenAvatars = reactive({});
const avatarUrl = (person) => (person?.id === auth.user?.id && auth.profile ? auth.profile.avatar_url : person?.avatar_url);
const avatarSrc = (person) => {
  const url = avatarUrl(person);
  return url && !brokenAvatars[url] ? assetUrl(url) : '';
};

let requestId = 0;
async function load() {
  if (!props.placeId && props.customName === undefined) return; // on the way to another page
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  posts.value = [];
  try {
    const params = props.placeId ? { placeId: props.placeId } : { customPlaceName: props.customName, limit: 50 };
    const { data } = await api.get('/posts', { params });
    if (id === requestId) posts.value = data.items ?? [];
  } catch (err) {
    if (id === requestId) error.value = errorMessage(err);
  } finally {
    if (id === requestId) loading.value = false;
  }
}
watch(() => [props.placeId, props.customName], load, { immediate: true });

// ---------- photo viewer ----------
const selectedPhotos = ref([]);
const selectedPhotoIndex = ref(0);
const photoDialog = ref(null);

async function openPhotoViewer(images, index) {
    selectedPhotos.value = images;
    selectedPhotoIndex.value = index;
    await nextTick();
    photoDialog.value?.focus();
}

function closePhotoViewer() {
    selectedPhotos.value = [];
    selectedPhotoIndex.value = 0;
}

function nextPhoto() {
    selectedPhotoIndex.value =
        (selectedPhotoIndex.value + 1) % selectedPhotos.value.length;
}

function previousPhoto() {
    selectedPhotoIndex.value =
        (selectedPhotoIndex.value - 1 + selectedPhotos.value.length)
        % selectedPhotos.value.length;
}

function handlePhotoKeydown(event) {
    if (event.key === 'Escape') closePhotoViewer();
    if (event.key === 'ArrowRight') nextPhoto();
    if (event.key === 'ArrowLeft') previousPhoto();
}

// ---------- likes and comments ----------
async function like(p) {
    try {
        const { data } = await api.post(`/posts/${p.id}/like`);
        p.likedByMe = data.liked;
        p.likeCount = data.likeCount;
    } catch (err) {
        showAlert(errorMessage(err));
    }
}

async function toggleComments(p) {
    try {
        if (openComments[p.id]) {
        delete openComments[p.id];
        return;
        }

        const { data } = await api.get(`/posts/${p.id}/comments`);
        openComments[p.id] = { items: data.items ?? [], nextCursor: data.nextCursor ?? null, loading: false };
    } catch (err) {
        showAlert(errorMessage(err));
    }
    }

async function loadMoreComments(p) {
    const state = openComments[p.id];
    if (!state?.nextCursor || state.loading) return;

    state.loading = true;
    try {
        const { data } = await api.get(`/posts/${p.id}/comments`, {
            params: { before: state.nextCursor }
        });
        state.items.push(...data.items);
        state.nextCursor = data.nextCursor;
    } catch (err) {
        showAlert(errorMessage(err));
    } finally {
        state.loading = false;
    }
}

async function comment(p) {
    const text = (commentDraft[p.id] || '').trim();
    if (!text) return;

    try {
        const { data } = await api.post(`/posts/${p.id}/comments`, { text });
        openComments[p.id].items.unshift(data); // newest first, like the rest of the list
        p.commentCount++;
        commentDraft[p.id] = '';
    } catch (err) {
        showAlert(errorMessage(err));
    }
    }

async function removeComment(p, c) {
    if (!(await askConfirm({ title: 'Delete this comment?', confirmLabel: 'Delete comment', danger: true }))) return;

    try {
        await api.delete(`/posts/${p.id}/comments/${c.id}`);
        openComments[p.id].items = openComments[p.id].items.filter(x => x.id !== c.id);
        p.commentCount = Math.max(0, p.commentCount - 1);
    } catch (err) {
        showAlert(errorMessage(err));
    }
}

async function removePost(p) {
    if (!(await askConfirm({ title: 'Delete this tale?', confirmLabel: 'Delete tale', danger: true }))) return;

    try {
        await api.delete(`/posts/${p.id}`);
        posts.value = posts.value.filter(x => x.id !== p.id);
    } catch (err) {
        showAlert(errorMessage(err));
    }
    }

defineExpose({ openPhotoViewer });
</script>

<template>
  <div>
    <p v-if="loading">Loading Tales...</p>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <div v-else class="place-feed">
      <p>{{ posts.length }} {{ posts.length === 1 ? 'Tale' : 'Tales' }} about this place</p>

      <div v-if="posts.length === 0" class="card card-pad">
        No Tales have been shared about this place yet.
      </div>

    <article v-for="post in posts" :key="post.id" class="card tale">
        <header class="row" style="gap: 10px">
            <span class="avatar" aria-hidden="true">
            <img v-if="avatarSrc(post.author)" :src="avatarSrc(post.author)" alt="" @error="brokenAvatars[avatarUrl(post.author)] = true" />
            <template v-else>{{ initials(post.author?.name) }}</template>
            </span>

            <div style="flex: 1">
            <strong>{{ post.author?.name }}</strong>
            <span class="muted" style="font-size: 13px">
                · {{ timeAgo(post.created_at) }}
            </span>
            </div>

            <span
            v-if="post.vibe"
            class="pill"
            :style="{ background: VIBE_TINT[post.vibe] }"
            >
            {{ VIBE_LABEL[post.vibe] }}
            </span>
        </header>

        <p class="caption">{{ post.caption }}</p>

        <div v-if="post.images?.length" class="photos">
            <img
            v-for="(image, index) in post.images"
            :key="image"
            :src="image"
            :alt="`Tale photo ${index + 1}`"
            loading="lazy"
            tabindex="0"
            role="button"
            @click="openPhotoViewer(post.images, index)"
            @keydown.enter="openPhotoViewer(post.images, index)"
            @keydown.space.prevent="openPhotoViewer(post.images, index)"
            />
        </div>

        <footer class="row" style="gap: 8px; margin-top: 12px">
            <button
            type="button"
            class="btn btn-sm"
            :aria-pressed="post.likedByMe"
            :class="{ liked: post.likedByMe }"
            @click="like(post)"
            >
            ♥ {{ post.likeCount }}
            </button>

            <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="toggleComments(post)"
            >
            Comments {{ post.commentCount }}
            </button>

            <span class="spacer"></span>

            <button
            v-if="post.author?.id === auth.user?.id"
            type="button"
            class="btn btn-sm btn-ghost"
            @click="removePost(post)"
            >
            Delete
            </button>
        </footer>

        <div v-if="openComments[post.id]" class="comments">
            <p v-if="!openComments[post.id].items.length" class="muted">No comments yet.</p>
            <p v-for="c in openComments[post.id].items" :key="c.id" class="comment-row">
            <span><strong>{{ c.author?.name }}</strong> {{ c.text }}</span>
            <button
                v-if="c.author?.id === auth.user?.id"
                type="button"
                class="btn btn-sm btn-ghost"
                @click="removeComment(post, c)"
            >
                Delete
            </button>
            </p>

            <button
                v-if="openComments[post.id].nextCursor"
                type="button"
                class="btn btn-sm btn-ghost older"
                :disabled="openComments[post.id].loading"
                @click="loadMoreComments(post)"
            >
                {{ openComments[post.id].loading ? 'Loading…' : 'Older comments' }}
            </button>

            <form v-if="auth.isLoggedIn" class="row" style="gap: 8px; flex-wrap: nowrap" @submit.prevent="comment(post)">
            <input
                v-model="commentDraft[post.id]"
                class="input"
                maxlength="1000"
                placeholder="Add a comment…"
                :aria-label="`Comment on ${post.author?.name}'s tale`"
            />
            <button type="submit" class="btn btn-sm btn-dark">Post</button>
            </form>
            <!-- the Explorer is open to guests, but commenting needs an account -->
            <RouterLink v-else :to="{ path: '/sign-in', query: { next: route.fullPath } }">Sign in to comment</RouterLink>
        </div>

        </article>
    </div>

    <div
      v-if="selectedPhotos.length"
      ref="photoDialog"
      class="photo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      tabindex="-1"
      @click.self="closePhotoViewer"
      @keydown="handlePhotoKeydown">

      <button
        type="button"
        class="photo-close"
        aria-label="Close photo"
        @click="closePhotoViewer">
        ✕
      </button>

      <button
        v-if="selectedPhotos.length > 1"
        type="button"
        class="photo-prev"
        aria-label="Previous photo"
        @click="previousPhoto">
        ❮
      </button>

      <img
        class="photo-enlarged"
        :src="selectedPhotos[selectedPhotoIndex]"
        :alt="`Photo ${selectedPhotoIndex + 1}`"
      />

      <button
        v-if="selectedPhotos.length > 1"
        type="button"
        class="photo-next"
        aria-label="Next photo"
        @click="nextPhoto">
        ❯
      </button>

      <div class="photo-counter">
        {{ selectedPhotoIndex + 1 }} / {{ selectedPhotos.length }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tale { margin-top: 18px; padding: 18px 20px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 2px solid var(--ink); border-radius: 50%; background: var(--sand); font-weight: 800; font-size: 14px; overflow: hidden; }
.avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.caption { margin: 12px 0 0; white-space: pre-line; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 12px; }
.photos img { width: 100%; height: 140px; object-fit: contain; border: 2px solid var(--ink); border-radius: 8px; cursor: zoom-in; }
.liked { background: var(--clay); }
.comments { margin-top: 12px; padding-top: 12px; border-top: 1.5px dashed var(--line); font-size: 14px; }
.comments p { margin: 0 0 8px; }
.comment-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; overflow-wrap: anywhere; }
.comment-row .btn { flex: none; }
.older { margin-bottom: 8px; }

.photo-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0, 0, 0, 0.92); display: flex; align-items: center; justify-content: center; padding: 55px 50px; }
.photo-enlarged { max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px; }
.photo-close { position: absolute; top: 18px; right: 22px; background: none; border: none; color: white; font-size: 30px; cursor: pointer; }
.photo-prev, .photo-next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255, 255, 255, 0.15); border: none; border-radius: 50%; color: white; font-size: 26px; width: 44px; height: 44px; cursor: pointer; }
.photo-prev { left: 12px; }
.photo-next { right: 12px; }
.photo-counter { position: absolute; bottom: 20px; color: white; font-size: 14px; }
.place-feed { width: 100%; max-width: none; margin: 16px 0 0; }
@media (max-width: 600px) { .photo-overlay { padding: 60px 12px; } .photo-prev, .photo-next { width: 36px; height: 36px; font-size: 20px; } }
</style>
