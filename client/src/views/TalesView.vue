<script setup>
import { ref, reactive, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { VIBES, VIBE_LABEL, VIBE_TINT } from '@/utils/constants';
import { timeAgo, initials } from '@/utils/format';
import TalesStorybook from '@/components/tales/TalesStorybook.vue'

const auth = useAuthStore();
const storybookRef = ref(null);

const route = useRoute();
const router = useRouter();

const feed = reactive({ items: [], nextCursor: null, loading: false, error: '' });
const scope = ref('everyone');
const vibe = ref('');
const placeFilter = ref(route.query.placeId || '');

// composer
const draft = reactive({ caption: '', vibe: '', place: null, images: [] });
const placeQuery = ref('');
const suggestions = ref([]);
const uploading = ref(false);
const posting = ref(false);
const composeError = ref(''); 

// comments per post id
const openComments = reactive({});
const commentDraft = reactive({});

const photoDialog = ref(null);

async function load(more = false) {
  feed.loading = true;
  feed.error = '';
  try {
    const { data } = await api.get('/posts', {
      params: {
        scope: scope.value,
        vibe: vibe.value || undefined,
        placeId: placeFilter.value || undefined,
        before: more ? feed.nextCursor : undefined,
        limit: 10,
      },
    });
    feed.items = more ? [...feed.items, ...data.items] : data.items;
    feed.nextCursor = data.nextCursor;
  } catch (err) {
    feed.error = errorMessage(err);
  } finally {
    feed.loading = false;
  }
}
watch([scope, vibe, placeFilter], () => load());
onMounted(() => load());

function clearPlaceFilter() {
  placeFilter.value = '';
  router.replace({ query: {} });
}

let acTimer;
watch(placeQuery, (q) => {
  clearTimeout(acTimer);
  if (!q.trim() || draft.place?.name === q) return (suggestions.value = []);
  acTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/places/autocomplete', { params: { q } });
      suggestions.value = data;
    } catch (error) {
      console.log(error)
      suggestions.value = [];
    }
  }, 200);
});
function pickPlace(p) {
  draft.place = p;
  placeQuery.value = p.name;
  if (!draft.vibe) draft.vibe = p.vibes?.[0] || '';
  suggestions.value = [];
}

watch(placeQuery, (q) => {
    if (draft.place && q !== draft.place.name) {
        draft.place = null;
    }
});


async function addImages(files) {
  uploading.value = true;
  composeError.value = '';
  try {
    for (const f of [...files].slice(0, 6 - draft.images.length)) draft.images.push(await uploadImage(f, 'posts'));
  } catch (err) {
    composeError.value = errorMessage(err);
  } finally {
    uploading.value = false;
  }
}

async function post() {
  posting.value = true;
  composeError.value = '';
  try {
    const { data } = await api.post('/posts', {
      caption: draft.caption,
      vibe: draft.vibe || undefined,
      placeId: draft.place?.id,
      customPlaceName: draft.place ? undefined : (placeQuery.value.trim() || undefined),
      images: draft.images,
    });

    feed.items.unshift(data);
    Object.assign(draft, { caption: '', vibe: '', place: null, images: [] });
    placeQuery.value = '';
    storybookRef.value?.finishComposing();

  } catch (err) {
    composeError.value = errorMessage(err);
  } finally {
    posting.value = false;
  }
}

async function like(p) {
  const { data } = await api.post(`/posts/${p.id}/like`);
  p.likedByMe = data.liked;
  p.likeCount = data.likeCount;
}

async function toggleComments(p) {
  try {
    if (openComments[p.id]) {
      delete openComments[p.id];
      return;
    }

    const { data } = await api.get(`/posts/${p.id}/comments`);

    const items = Array.isArray(data) ? data : data.items ?? [];

    console.table(items.map(c => ({ id: c.id, text: JSON.stringify(c.text), length: c.text?.length })));

    openComments[p.id] = {
      items: items,
      nextCursor: Array.isArray(data) ? null : data.nextCursor ?? null,
      loading: false
    };

  } catch (error) {
    console.log(error);
    alert(errorMessage(error));
  }
}


async function loadMoreComments(p) {
  const state = openComments[p.id];

  if (!state?.nextCursor || state.loading) return;

  state.loading = true;

  try {
    const { data } = await api.get(`/posts/${p.id}/comments`, {
      params: {
        before: state.nextCursor
      }
    });

    state.items.push(...data.items);
    state.nextCursor = data.nextCursor;

  } catch (error) {
    console.log(error);
    alert(errorMessage(error));
  } finally {
    state.loading = false;
  }
}

async function comment(p) {
  const text = (commentDraft[p.id] || '').trim();
  if (!text) return;
  const { data } = await api.post(`/posts/${p.id}/comments`, { text });
  openComments[p.id].items.unshift(data);
  p.commentCount++;
  commentDraft[p.id] = '';
}

async function removePost(p) {
  if (!window.confirm('Delete this tale?')) return;

  try {
    await api.delete(`/posts/${p.id}`);

    feed.items = feed.items.filter(x => x.id !== p.id);

    delete openComments[p.id];
  } catch (error) {
    alert(errorMessage(error));
  }
}


async function removeComment(p, c) {
  if (!window.confirm('Delete this comment?')) return;

  try {
    await api.delete(`/posts/${p.id}/comments/${c.id}`);

    openComments[p.id].items =
      openComments[p.id].items.filter(
        comment => comment.id !== c.id
      );

    p.commentCount = Math.max(0, p.commentCount - 1);

  } catch (error) {
    alert(errorMessage(error));
  }
}


// click-to-enlarge section
const selectedPhotos = ref([]);
const selectedPhotoIndex = ref(0);

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
  if (!selectedPhotos.value.length) return;

  if (event.key === 'Escape') closePhotoViewer();
  if (event.key === 'ArrowRight') nextPhoto();
  if (event.key === 'ArrowLeft') previousPhoto();
}

const composerSection = ref(null);

function openComposer() {
  composerSection.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function changeStorybookFilter(value) {
  scope.value = value;
}

function loadOlderTales() {
  if (feed.nextCursor && !feed.loading) {
    load(true);
  }
}
</script>

<template>
  <main class="container page">
    <span class="tag-stamp" style="color: var(--ember)">Tales</span>
    <h1 class="display display-lg" style="margin-top: 16px">Stories from the other side.</h1>
    <br>

    <div class="layout">
      <section class="storybook-feed" aria-label="Feed">
        <TalesStorybook
          ref="storybookRef"
          :posts="feed.items"
          :current-user-id="auth.user?.id"
          :open-comment-ids="Object.keys(openComments)"
          @like="like"
          @comment="toggleComments"
          @delete="removePost"
          @filter-change="changeStorybookFilter"
          @load-more="loadOlderTales"
          @open-photo="openPhotoViewer"
        >
    
        <template #composer>
          <form class="notebook-form" @submit.prevent="post">
            <label class="field">
              What happened?
              <textarea v-model="draft.caption" class="textarea" required maxlength="2000" placeholder="Tell us about your JB adventure..." data-cy="tale-caption"></textarea>
            </label>
            <div class="field ac">
              <label for="tale-place">Tag a place</label>
              <input id="tale-place" v-model="placeQuery" class="input" autocomplete="off" placeholder="Start typing a place..." role="combobox" :aria-expanded="suggestions.length > 0" aria-controls="tale-place-list" />
              <ul v-if="suggestions.length" id="tale-place-list" class="ac-list" role="listbox">
                <li v-for="s in suggestions" :key="s.id" role="option" :aria-selected="false">
                  <button type="button" @click="pickPlace(s)">{{ s.name }}</button>
                </li>
              </ul>
            </div>
            <label class="field">
              Vibe
              <select v-model="draft.vibe" class="select">
                <option value="">None</option>
                <option v-for="v in VIBES" :key="v.id" :value="v.id">{{ v.label }}</option>
              </select>
            </label>
            <label class="field">
              Photos ({{ draft.images.length }}/6)
              <input type="file" accept="image/*" multiple class="input" :disabled="uploading || draft.images.length >= 6" @change="addImages($event.target.files); $event.target.value = ''" />
            </label>
            <div v-if="draft.images.length" class="thumbs">
              <img v-for="(u, i) in draft.images" :key="u" :src="u" :alt="`Upload ${i + 1}`" />
            </div>
            <p v-if="composeError" class="error-text" role="alert">{{ composeError }}</p>
            <button type="submit" class="btn btn-ember" :disabled="posting || uploading" data-cy="tale-post">
              {{ uploading ? 'Uploading…' : posting ? 'Posting…' : 'Share by the fire' }}
            </button>
          </form>
        </template>
        
      <template #comments="{ post: p }">
        <Transition name="unroll">
          <div v-if="openComments[p.id]" class="comment-scroll">
            <button
              type="button"
              class="scroll-roller"
              aria-label="Close Traveller's Notes"
              title="Roll up Traveller's Notes"
              @click="toggleComments(p)"></button>
            <div class="scroll-paper">
              <div class="scroll-header">✦ Traveller's Notes ✦</div>
              <div class="scroll-comments">
                <div v-if="!openComments[p.id].items.length" class="empty-comments">
                  No comments yet. Be the first!
                </div>
                <div v-for="c in openComments[p.id].items" :key="c.id" class="scroll-comment-row">
                  <div class="scroll-comment-content">
                    <strong>{{ c.author?.name ?? 'Traveller' }}</strong>
                    <p>{{ c.text }}</p>
                  </div>
                  <button v-if="c.author?.id === auth.user?.id" type="button" class="scroll-delete" aria-label="Delete comment" @click="removeComment(p, c)">×</button>
                </div>
                <button v-if="openComments[p.id].nextCursor" type="button" class="scroll-load-more" :disabled="openComments[p.id].loading" @click="loadMoreComments(p)">
                  {{ openComments[p.id].loading ? 'Loading...' : 'Load more notes' }}
                </button>
              </div>
              <form class="scroll-comment-form" @submit.prevent="comment(p)">
                <input v-model="commentDraft[p.id]" maxlength="1000" placeholder="Leave a little note..." :aria-label="`Comment on ${p.author?.name ?? 'this traveller'}'s tale`" />
                <button type="submit" :disabled="!commentDraft[p.id]?.trim()">Post</button>
              </form>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </Transition>
      </template>

      </TalesStorybook>

        <p v-if="feed.error" class="error-text" role="alert">
          {{ feed.error }}
        </p>

        <p v-if="feed.loading" class="muted">
          Loading tales...
        </p>

        <button
          v-if="feed.nextCursor"
          type="button"
          class="btn btn-ghost"
          :disabled="feed.loading"
          @click="loadOlderTales"
        >
          Older Tales
        </button>

      </section>
    </div>

    <!-- Enlarged photo viewer -->
      <div
        v-if="selectedPhotos.length"
        class="photo-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
        tabindex="-1"
        @click.self="closePhotoViewer"
        @keydown="handlePhotoKeydown"
        ref="photoDialog"
      >
        <button
          type="button"
          class="photo-close"
          aria-label="Close photo"
          @click="closePhotoViewer"
        >
          ✕
        </button>

        <button
          v-if="selectedPhotos.length > 1"
          type="button"
          class="photo-prev"
          aria-label="Previous photo"
          @click="previousPhoto"
        >
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
  </main>
</template>


<style scoped>
.storybook-feed { width: 100%; min-width: 0; }
.ac { position: relative; }
.ac-list { position: absolute; z-index: 20; top: 100%; left: 0; right: 0; list-style: none; margin: 4px 0 0; padding: 4px; background: #FFF8EA; border: 2px solid #75462D; border-radius: 8px; max-height: 180px; overflow-y: auto; box-shadow: 0 8px 20px rgba(0,0,0,.08); }
.ac-list button { width: 100%; min-height: 36px; text-align: left; border: 0; background: transparent; padding: 0 10px; cursor: pointer; border-radius: 6px; color: #4A2C20; }
.ac-list button:hover { background: #E8C99B; }
.notebook-form { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.notebook-form * { box-sizing: border-box; }
.notebook-form .field { display: flex; flex-direction: column; gap: 4px; font-family: 'Kalam', cursive; font-size: 16px; font-weight: 700; color: #4A2C20; }
.notebook-form .input, .notebook-form .textarea, .notebook-form .select { width: 100%; padding: 10px 12px; background: rgba(255,248,236,.88); border: 2px solid #3F2A1D; border-radius: 10px; color: #4A2C20; font-size: 15px; line-height: 1.4; box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
.notebook-form .input::placeholder, .notebook-form .textarea::placeholder { color: #7A7A7A; }
.notebook-form .textarea { min-height: 90px; resize: vertical; }
.notebook-form .select { appearance: none; background-image: linear-gradient(45deg,transparent 50%,#4A2C20 50%),linear-gradient(135deg,#4A2C20 50%,transparent 50%); background-position: calc(100% - 18px) calc(50% - 3px),calc(100% - 12px) calc(50% - 3px); background-size: 6px 6px,6px 6px; background-repeat: no-repeat; padding-right: 34px; }
.notebook-form .input:focus, .notebook-form .textarea:focus, .notebook-form .select:focus { outline: none; border-color: #A85A2A; box-shadow: 0 0 0 3px rgba(168,90,42,.18); }
.notebook-form input[type="file"] { padding: 8px 10px; }
.notebook-form input[type="file"]::file-selector-button { margin-right: 12px; padding: 8px 14px; background: #F7EDDA; color: #35251A; border: 2px solid #35251A; border-radius: 10px; font-family: 'Kalam', cursive; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 2px 3px 0 #3A2418; }
.notebook-form input[type="file"]::file-selector-button:hover { background: #E8C99B; }
.notebook-form .btn-ember { align-self: flex-start; background: #C55222; color: #FFF5E6; border: 3px solid #35251A; border-radius: 16px; padding: 10px 24px; font-family: 'Kalam', cursive; font-size: 17px; font-weight: 700; cursor: pointer; box-shadow: 4px 5px 0 #3A2418; }
.notebook-form .btn-ember:hover:not(:disabled) { background: #D8652F; transform: translateY(-1px); }
.notebook-form .btn-ember:disabled { opacity: .6; cursor: not-allowed; }
.thumbs { display: flex; flex-wrap: wrap; gap: 8px; }
.thumbs img { width: 58px; height: 58px; object-fit: cover; border: 2px solid #75462D; border-radius: 8px; }
.photo-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.92); display: flex; align-items: center; justify-content: center; padding: 55px 50px; }
.photo-enlarged { max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px; }
.photo-close { position: absolute; top: 18px; right: 22px; background: transparent; border: 0; color: #FFF; font-size: 30px; cursor: pointer; }
.photo-prev, .photo-next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,.15); border: 0; border-radius: 50%; color: #FFF; font-size: 26px; width: 44px; height: 44px; cursor: pointer; }
.photo-prev { left: 12px; }
.photo-next { right: 12px; }
.photo-counter { position: absolute; bottom: 20px; color: #FFF; font-size: 14px; }
.comment-scroll { position: relative; flex: 0 0 195px; width: 100%; height: 195px; min-height: 0; margin-top: 9px; padding: 8px 3px 5px; font-family: 'Kalam', cursive; transform-origin: top center; }
.scroll-roller { position: absolute; top: 0; left: -5px; right: -5px; height: 17px; z-index: 2; border: 2px solid #845331; border-radius: 12px; background: linear-gradient(to bottom,#D9B788,#F3DDB5 45%,#BC8B55 85%,#865736); box-shadow: 0 3px 5px rgba(64,35,15,.25); }
.scroll-roller::before, .scroll-roller::after { content: ''; position: absolute; top: 2px; width: 5px; height: 9px; background: #87512E; border-radius: 3px; }
.scroll-roller::before { left: 6px; }
.scroll-roller::after { right: 6px; }
.scroll-paper { display: flex; flex-direction: column; height: 176px; min-height: 0; padding: 14px 10px 7px; background: repeating-linear-gradient(to bottom,transparent 0px,transparent 22px,rgba(158,112,62,.1) 23px),linear-gradient(90deg,#E4CAA2,#F9EDD5 8%,#F9EDD5 92%,#DEBF92); border-left: 2px solid #B99266; border-right: 2px solid #B99266; box-shadow: 2px 3px 8px rgba(55,32,17,.19); overflow: visible; }
.scroll-header { flex-shrink: 0; text-align: center; color: #8B5A38; font-size: 14px; font-weight: 700; }
.scroll-comments { flex: 1 1 auto; min-height: 0; margin: 6px 0; padding: 3px 5px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #B88A5D transparent; }
.scroll-comments::-webkit-scrollbar { width: 5px; }
.scroll-comments::-webkit-scrollbar-thumb { background: #B88A5D; border-radius: 10px; }
.scroll-comment-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed rgba(133,83,49,.28); }
.scroll-comment-content { flex: 1; min-width: 0; }
.scroll-comment-content strong { display: block; color: #5F3B26; font-size: 13px; line-height: 1.3; }
.scroll-comment-content p { margin: 2px 0 0; color: #583B2A; font-size: 13px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
.scroll-delete { flex-shrink: 0; border: 0; background: transparent; color: #A1674D; font-size: 19px; cursor: pointer; }
.scroll-load-more { display: block; margin: 5px auto; padding: 4px 8px; border: 0; background: transparent; color: #87512E; font-family: 'Kalam', cursive; font-size: 12px; text-decoration: underline; cursor: pointer; }
.empty-comments { padding: 10px; text-align: center; color: #947151; font-size: 13px; }
.scroll-comment-form { display: flex; flex-shrink: 0; gap: 5px; padding-top: 7px; border-top: 1px solid #D6B991; }
.scroll-comment-form input { flex: 1; min-width: 0; padding: 6px 9px; background: rgba(255,251,239,.8); border: 1px solid #B99770; border-radius: 7px; font-size: 12px; }
.scroll-comment-form button { flex-shrink: 0; padding: 5px 10px; border: 1px solid #4E301F; border-radius: 7px; background: #75462D; color: #FFF5E6; font-family: 'Kalam', cursive; font-size: 13px; font-weight: 700; cursor: pointer; }
.scroll-comment-form button:disabled { opacity: .5; cursor: not-allowed; }
.scroll-bottom { position: relative; height: 11px; margin: 0 -5px; border: 2px solid #90613D; border-radius: 10px; background: linear-gradient(to bottom,#F3DDB5,#C4935D,#865736); box-shadow: 0 3px 5px rgba(64,35,15,.2); }
.comment-scroll { margin-top: 0; transform-origin: top center; }
.unroll-enter-active { animation: unfurlScroll .55s cubic-bezier(.2,.75,.25,1) both; }
.unroll-leave-active { animation: unfurlScroll .3s ease-in reverse both; }
.book-layout { padding-bottom: 0; }
.book-layout:has(.comment-scroll) { padding-bottom: 230px; }
@keyframes unfurlScroll {
  0% { opacity: 0; transform: translateY(-20px) scaleY(.02); }
  35% { opacity: 1; }
  70% { transform: translateY(0) scaleY(1.05); }
  100% { opacity: 1; transform: translateY(0) scaleY(1); }
}
@media (max-width: 600px) {
  .photo-overlay { padding: 60px 12px; }
  .photo-prev, .photo-next { width: 36px; height: 36px; font-size: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .unroll-enter-active, .unroll-leave-active { animation: none; }
}

.storybook-section { overflow: visible; }
.journal-stage { overflow: visible; }
.book-layout { position: relative; padding-bottom: 0; overflow: visible; }
.book-layout:has(.comment-scroll) { padding-bottom: 235px; }
.book-cover { overflow: visible; }
.open-book { overflow: visible; }
.book-page { position: relative; overflow: visible; z-index: 1; }
.book-page:has(.comment-scroll) { z-index: 10; }
.tale-card { overflow: hidden; }
.comments-drop { position: absolute; top: calc(100% - 47px); left: 24px; right: 24px; z-index: 20; pointer-events: none; }
.comments-drop.comments-expanded { top: calc(100% + 12px); z-index: 30; }
.comments-drop :deep(.comment-scroll) { pointer-events: auto; margin-top: 0; }

.scroll-roller { width: auto; padding: 0; cursor: pointer; appearance: none; }
.scroll-roller:hover { filter: brightness(1.1); }
.scroll-roller:focus-visible { outline: 3px solid #A85A2A; outline-offset: 3px; }
</style>


