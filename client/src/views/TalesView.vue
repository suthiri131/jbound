<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { VIBES, VIBE_LABEL, VIBE_TINT } from '@/utils/constants';
import { timeAgo } from '@/utils/format';
import SkyBackdrop from '@/components/scene/SkyBackdrop.vue';
import FiresideCircle from '@/components/tales/FiresideCircle.vue';
import { useCampSky } from '@/composables/useCampSky';


const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

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


// ---------- postcards ----------
const flipped = reactive({}); // post id -> showing the story side
const composing = ref(false);

const newThisWeek = computed(() => {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  return feed.items.filter((p) => p.created_at > weekAgo).length;
});
const placeName = (p) => p.place?.name || p.custom_place_name || 'Somewhere in JB';

function flip(p) {
  flipped[p.id] = !flipped[p.id];
}
async function send() {
  await post();
  if (!composeError.value) composing.value = false;
}

// ---------- the fire ----------
const { sky } = useCampSky();

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
</script>

<template>
  <main class="tales-page">
    <SkyBackdrop :path="false" />
    <RouterLink to="/" class="camp-back home" aria-label="Back to Basecamp">← <span class="home-label">Basecamp</span></RouterLink>

    <section class="bubble" aria-label="Postcards from JB">
      <header class="toolbar">
          <div class="b-text">
            <h1 class="b-title">Postcards from JB</h1>
            <p class="b-sub">{{ newThisWeek ? `${newThisWeek} new this week` : 'Stories from people who made the crossing' }} · tap a card to read it</p>
          </div>
          <div class="filters">
            <div class="seg" role="group" aria-label="Whose tales">
              <button type="button" :aria-pressed="scope === 'everyone'" @click="scope = 'everyone'">Everyone</button>
              <button type="button" :aria-pressed="scope === 'friends'" @click="scope = 'friends'">My crews</button>
              <button type="button" :aria-pressed="scope === 'mine'" @click="scope = 'mine'">Mine</button>
            </div>
            <select v-model="vibe" class="vibe-select" aria-label="Filter by vibe">
              <option value="">All vibes</option>
              <option v-for="v in VIBES" :key="v.id" :value="v.id">{{ v.label }}</option>
            </select>
            <button v-if="placeFilter" type="button" class="chip-x" @click="clearPlaceFilter">One place only ✕</button>
          </div>
          <button type="button" class="send" :aria-expanded="composing" @click="composing = !composing">
            <template v-if="composing">Close</template><template v-else>+ Send<span class="send-more"> a postcard</span></template>
          </button>
      </header>

      <div class="scroller">

      <!-- composer: a blank postcard -->
      <form v-if="composing" class="postcard blank" @submit.prevent="send">
        <div class="pc-left">
          <label class="field">
            Your story
            <textarea v-model="draft.caption" class="textarea hand-input" required maxlength="2000" placeholder="The banana cake at Hiap Joo is gone by 11am. Worth the early start." data-cy="tale-caption" />
          </label>
        </div>
        <div class="pc-right">
          <span class="stamp-box" aria-hidden="true">JB</span>
          <div class="field ac">
            <label for="tale-place">Where?</label>
            <input id="tale-place" v-model="placeQuery" class="input" autocomplete="off" placeholder="Start typing…" role="combobox" :aria-expanded="suggestions.length > 0" aria-controls="tale-place-list" />
            <ul v-if="suggestions.length" id="tale-place-list" class="ac-list" role="listbox">
              <li v-for="s in suggestions" :key="s.id" role="option" :aria-selected="false">
                <button type="button" @click="pickPlace(s)">{{ s.name }}</button>
              </li>
            </ul>
          </div>
          <label class="field">Vibe
            <select v-model="draft.vibe" class="select">
              <option value="">None</option>
              <option v-for="v in VIBES" :key="v.id" :value="v.id">{{ v.label }}</option>
            </select>
          </label>
          <label class="field">
            Photos ({{ draft.images.length }}/6)
            <input type="file" accept="image/*" multiple class="file" :disabled="uploading || draft.images.length >= 6" @change="addImages($event.target.files); $event.target.value = ''" />
          </label>
          <div v-if="draft.images.length" class="thumbs">
            <img v-for="(u, i) in draft.images" :key="u" :src="u" :alt="`Upload ${i + 1}`" />
          </div>
        </div>
        <p v-if="composeError" class="error-text full" role="alert">{{ composeError }}</p>
        <button type="submit" class="btn btn-ember full" :disabled="posting || uploading" data-cy="tale-post">
          {{ uploading ? 'Uploading…' : posting ? 'Posting…' : 'Drop it in the mailbox' }}
        </button>
      </form>

      <p v-if="feed.error" class="error-text" role="alert">{{ feed.error }}</p>

      <ul class="cards">
        <li v-for="p in feed.items" :key="p.id" class="card-slot" data-cy="tale">
          <button
            type="button"
            class="postcard flip"
            :class="{ flipped: flipped[p.id] }"
            :aria-pressed="Boolean(flipped[p.id])"
            :aria-label="`${placeName(p)} postcard from ${p.author?.name || 'a traveller'}. ${flipped[p.id] ? 'Showing the story' : 'Flip to read the story'}`"
            @click="flip(p)"
          >
            <span class="face front">
              <img v-if="p.images?.length" :src="p.images[0]" alt="" class="pc-photo" loading="lazy" />
              <span v-else class="pc-photo blank-photo" :style="{ background: VIBE_TINT[p.vibe] || '#f6d58e' }">Greetings from<br /><b>{{ placeName(p) }}</b></span>
              <span class="pc-caption">
                <strong>{{ placeName(p) }}</strong>
                <small v-if="p.vibe">{{ VIBE_LABEL[p.vibe] }}</small>
              </span>
            </span>
            <span class="face back">
              <span class="pc-story">{{ p.caption }}</span>
              <span class="pc-addr">
                <span class="stamp-box" :style="{ background: VIBE_TINT[p.vibe] || '#f4c4cf' }" aria-hidden="true">JB</span>
                <span class="postmark" aria-hidden="true">{{ timeAgo(p.created_at) }}</span>
                <span class="sig">— {{ p.author?.name?.split(' ')[0] || 'A traveller' }}</span>
              </span>
            </span>
          </button>

          <div class="pc-actions">
            <button type="button" class="mini" :aria-pressed="p.likedByMe" :class="{ liked: p.likedByMe }" @click="like(p)">♥ {{ p.likeCount }}</button>
            <button type="button" class="mini" :aria-expanded="Boolean(openComments[p.id])" @click="toggleComments(p)">💬 {{ p.commentCount }}</button>
            <button v-if="p.images?.length > 1" type="button" class="mini" @click="openPhotoViewer(p.images, 0)">📷 {{ p.images.length }}</button>
            <RouterLink v-if="p.place" class="mini" :to="`/tales/place/${p.place.id}`">More here</RouterLink>
            <span class="spacer" />
            <button v-if="p.author?.id === auth.user?.id" type="button" class="mini ghost" @click="removePost(p)">Delete</button>
          </div>

          <div v-if="openComments[p.id]" class="comments">
            <p v-for="c in openComments[p.id]?.items ?? []" :key="c.id" class="comment-row">
              <span><strong>{{ c.author?.name?.split(' ')[0] }}:</strong> {{ c.text }}</span>
              <button v-if="c.author?.id === auth.user?.id" type="button" class="mini ghost" @click="removeComment(p, c)">Delete</button>
            </p>
            <button v-if="openComments[p.id]?.nextCursor" type="button" class="mini" :disabled="openComments[p.id]?.loading" @click="loadMoreComments(p)">
              {{ openComments[p.id]?.loading ? 'Loading…' : 'Older comments' }}
            </button>
            <form class="comment-form" @submit.prevent="comment(p)">
              <input v-model="commentDraft[p.id]" class="input" maxlength="1000" placeholder="Add a comment…" :aria-label="`Comment on ${p.author?.name}'s tale`" />
              <button type="submit" class="btn btn-sm btn-dark">Post</button>
            </form>
          </div>
        </li>
      </ul>

      <p v-if="!feed.loading && !feed.items.length" class="empty">No postcards yet. Be the first by the fire.</p>
      <p v-if="feed.loading" class="empty" role="status">Checking the mailbox…</p>
      <button v-if="feed.nextCursor" type="button" class="send older" :disabled="feed.loading" @click="load(true)">Older postcards</button>
      </div>
    </section>

    <!-- the whole ring is thinking the one thought bubble above -->
    <div class="fireside" aria-hidden="true">
      <FiresideCircle :night="sky.night" />
    </div>

    <!-- enlarged photo viewer -->
    <div
      v-if="selectedPhotos.length"
      ref="photoDialog"
      class="photo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      tabindex="-1"
      @click.self="closePhotoViewer"
      @keydown="handlePhotoKeydown"
    >
      <button type="button" class="photo-close" aria-label="Close photo" @click="closePhotoViewer">✕</button>
      <button v-if="selectedPhotos.length > 1" type="button" class="photo-prev" aria-label="Previous photo" @click="previousPhoto">❮</button>
      <img class="photo-enlarged" :src="selectedPhotos[selectedPhotoIndex]" :alt="`Photo ${selectedPhotoIndex + 1}`" />
      <button v-if="selectedPhotos.length > 1" type="button" class="photo-next" aria-label="Next photo" @click="nextPhoto">❯</button>
      <div class="photo-counter">{{ selectedPhotoIndex + 1 }} / {{ selectedPhotos.length }}</div>
    </div>
  </main>
</template>

<style scoped>
.tales-page {
  position: relative;
  display: grid;
  /* the button sits beside the bubble, which takes the full height above the fire */
  grid-template-columns: 1fr minmax(0, 1180px) 1fr;
  grid-template-rows: minmax(0, 1fr) auto;
  column-gap: 14px;
  padding: 12px 20px 10px;
  font-family: var(--font-round);
  color: #1f2a24;
  overflow: hidden !important; /* the fire stays put, the postcards scroll inside the bubble */
}
.home {
  position: relative;
  z-index: 3;
  grid-column: 1;
  grid-row: 1;
  align-self: start;
  justify-self: start;
}
/* a cloud of a thought bubble: the scalloped outline is a 9-slice image, so it fits any size of bubble */
.bubble {
  position: relative;
  z-index: 1;
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 4px 22px 12px;
  border: 34px solid transparent;
  border-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cpath d='M40 18A21 15 0 0 1 80 18A16.5 16.5 0 1 1 102 40A15 21 0 0 1 102 80A16.5 16.5 0 1 1 80 102A21 15 0 0 1 40 102A16.5 16.5 0 1 1 18 80A15 21 0 0 1 18 40A16.5 16.5 0 1 1 40 18Z' fill='%23fdf3da' stroke='%231f2a24' stroke-width='2'/%3E%3C/svg%3E") 40 fill / 60px round;
}
.toolbar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 0 6px 10px;
  border-bottom: 2px dashed rgba(31, 42, 36, 0.35);
}
/* a size container: the postcards use its height so the first row always fits, buttons and all */
.scroller {
  --fade: 28px; /* matches the bottom padding, so the first row's buttons stay clear of the fade */
  flex: 1;
  min-height: 0;
  container-type: size;
  overflow: hidden auto;
  scrollbar-gutter: stable;
  display: grid;
  align-content: start;
  gap: 22px;
  padding: 14px 6px var(--fade) 6px;
  /* postcards fade out into the cloud rather than stopping at a hard line */
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - var(--fade)), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - var(--fade)), transparent);
}
/* a slim thumb with no track or arrows, so nothing sits on the cloud's edge */
.scroller::-webkit-scrollbar {
  width: 8px;
}
.scroller::-webkit-scrollbar-button {
  display: none;
}
.scroller::-webkit-scrollbar-track {
  background: transparent;
}
.scroller::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(31, 42, 36, 0.28);
}
.scroller::-webkit-scrollbar-thumb:hover {
  background: rgba(31, 42, 36, 0.45);
}
@supports not selector(::-webkit-scrollbar) {
  .scroller {
    scrollbar-width: thin;
    scrollbar-color: rgba(31, 42, 36, 0.28) transparent;
  }
}
.b-text {
  flex: 1 1 240px;
  min-width: 0;
}
.b-title {
  margin: 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 24px;
  line-height: 1.1;
}
.b-sub {
  margin: 2px 0 0;
  font-size: 13px;
  opacity: 0.75;
}
.send {
  flex: none;
  min-height: 40px;
  padding: 0 14px;
  border: 2.5px solid #1f2a24;
  border-radius: 12px;
  background: #f5bf4f;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.2);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.send:active {
  translate: 0 2px;
  box-shadow: none;
}
.older {
  justify-self: center;
  background: #fffdf7;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.seg {
  display: inline-flex;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  overflow: hidden;
}
.seg button {
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  background: #fffdf7;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.seg button[aria-pressed='true'] {
  background: #1f2a24;
  color: #fffdf7;
}
.vibe-select,
.chip-x {
  min-height: 34px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* ---------- postcards ---------- */
.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start; /* opening one card's comments doesn't stretch its neighbours */
  gap: 30px 26px;
}
.card-slot {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr); /* a long place name truncates instead of widening the card */
  gap: 8px;
}
.card-slot:nth-child(odd) .postcard {
  rotate: -1.2deg;
}
.card-slot:nth-child(even) .postcard {
  rotate: 1deg;
}
.postcard {
  rotate: -1.2deg;
}
.card-slot:nth-child(even) .postcard {
  rotate: 1deg;
}
.card-slot.on .postcard {
  rotate: 0deg;
  box-shadow: 0 0 0 4px #f5bf4f, 0 6px 0 rgba(0, 0, 0, 0.18);
}
.postcard {
  position: relative;
  width: 100%;
  border: 2.5px solid #1f2a24;
  border-radius: 6px;
  background: #fffaf0;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.18);
  transition: rotate 0.2s, box-shadow 0.2s;
}
.flip {
  display: block;
  height: clamp(120px, calc(100cqh - 84px), 210px);
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  perspective: 1000px;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.face {
  position: absolute;
  inset: 0;
  border: 2.5px solid #1f2a24;
  border-radius: 6px;
  background: #fffaf0;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.18);
  backface-visibility: hidden;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  overflow: hidden;
}
.back {
  transform: rotateY(180deg);
  display: grid;
  grid-template-columns: 1.5fr 1fr;
}
.flip.flipped .front {
  transform: rotateY(-180deg);
}
.flip.flipped .back {
  transform: rotateY(0deg);
}
.flip:focus-visible {
  outline: none;
}
.flip:focus-visible .face {
  outline: 3px solid #1f2a24;
  outline-offset: 3px;
}
.front {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  padding: 10px 10px 0;
}
.pc-photo {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: cover;
  border: 2px solid #1f2a24;
  border-radius: 3px;
}
.blank-photo {
  display: grid;
  place-content: center;
  text-align: center;
  font-family: var(--font-hand);
  font-size: 20px;
  line-height: 1.1;
}
.blank-photo b {
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 24px;
}
.pc-caption {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 7px 2px 9px;
}
.pc-caption strong {
  min-width: 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-caption small {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.75;
}
.pc-story {
  padding: 14px 12px 14px 14px;
  border-right: 2px dashed rgba(31, 42, 36, 0.35);
  font-family: var(--font-hand);
  font-size: 20px;
  line-height: 1.15;
  overflow-y: auto;
  white-space: pre-line;
}
.pc-addr {
  position: relative;
  display: grid;
  align-content: end;
  gap: 6px;
  padding: 12px;
  background: repeating-linear-gradient(transparent 0 30px, rgba(31, 42, 36, 0.25) 30px 31.5px);
}
.stamp-box {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 52px;
  border: 2px dashed #9e3b1b;
  background: #f4c4cf;
  font-family: var(--font-display);
  color: #9e3b1b;
  font-size: 14px;
}
.postmark {
  position: absolute;
  top: 42px;
  right: 40px;
  padding: 6px 4px;
  border: 2px solid rgba(46, 107, 70, 0.6);
  border-radius: 50%;
  color: rgba(46, 107, 70, 0.85);
  font-size: 10px;
  font-weight: 700;
  rotate: -14deg;
}
.sig {
  font-family: var(--font-hand);
  font-size: 20px;
  text-align: right;
}

.pc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.mini {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
  color: #1f2a24;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.mini.liked {
  background: #f4c4cf;
}
.mini.ghost {
  border-style: dashed;
}
.spacer {
  flex: 1;
}
.comments {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  background: #fffaf0;
  font-size: 14px;
}
.comment-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
}
.comment-form {
  display: flex;
  gap: 6px;
}
.empty {
  margin: 4px 0;
  text-align: center;
  font-family: var(--font-hand);
  font-size: 20px;
  opacity: 0.75;
}

/* composer */
.blank {
  width: min(100%, 680px);
  justify-self: center;
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 12px;
  padding: 14px;
  rotate: -0.6deg;
}
.pc-left {
  padding-right: 12px;
  border-right: 2px dashed rgba(31, 42, 36, 0.35);
}
.pc-right {
  position: relative;
  display: grid;
  gap: 10px;
  align-content: start;
  padding-top: 56px;
}
.hand-input {
  min-height: 170px;
  font-family: var(--font-hand);
  font-size: 20px;
  line-height: 1.2;
  background: transparent;
}
.file {
  max-width: 100%;
  font-size: 12px;
}
.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.thumbs img {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border: 2px solid #1f2a24;
  border-radius: 4px;
}
.full {
  grid-column: 1 / -1;
}
.ac {
  position: relative;
}
.ac-list {
  position: absolute;
  z-index: 5;
  top: 100%;
  left: 0;
  right: 0;
  list-style: none;
  margin: 4px 0 0;
  padding: 4px;
  background: #fffdf7;
  border: 2px solid #1f2a24;
  border-radius: 8px;
}
.ac-list button {
  width: 100%;
  min-height: 40px;
  text-align: left;
  border: 0;
  background: none;
  padding: 0 10px;
  cursor: pointer;
  border-radius: 6px;
  font: inherit;
}
.ac-list button:hover {
  background: #f6e2b3;
}

/* ---------- the fire and the people around it ---------- */
.fireside {
  position: relative;
  z-index: 2;
  grid-column: 2;
  grid-row: 2;
  justify-self: center;
  width: min(100%, 720px);
  margin-top: -14px; /* the biggest thought clouds drift up against the bubble */
  pointer-events: none;
}

/* photo viewer */
.photo-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 55px 50px;
}
.photo-enlarged {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
}
.photo-close {
  position: absolute;
  top: 18px;
  right: 22px;
  background: none;
  border: none;
  color: white;
  font-size: 30px;
  cursor: pointer;
}
.photo-prev,
.photo-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 26px;
  width: 44px;
  height: 44px;
  cursor: pointer;
}
.photo-prev {
  left: 12px;
}
.photo-next {
  right: 12px;
}
.photo-counter {
  position: absolute;
  bottom: 20px;
  color: white;
  font-size: 14px;
}
@media (max-width: 1180px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 960px) {
  /* the button gets its own row, so the bubble is centred on the page */
  .tales-page {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    row-gap: 8px;
    padding: 10px 10px 8px;
  }
  .home {
    grid-column: 1;
    grid-row: 1;
  }
  .bubble {
    grid-column: 1;
    grid-row: 2;
    padding: 2px 8px 8px;
    border-width: 24px;
    border-image-width: 40px;
  }
  .fireside {
    grid-column: 1;
    grid-row: 3;
    margin-top: -16px;
  }
  .toolbar {
    padding: 0 2px 8px;
  }
  .scroller {
    --fade: 20px;
    padding: 12px 2px var(--fade) 2px;
  }
}
@media (max-width: 680px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }
  /* a compact header, so a whole postcard and its buttons still fit on a small phone */
  .b-text {
    flex: 1 1 0;
  }
  .b-title {
    font-size: 20px;
  }
  .b-sub,
  .send-more {
    display: none;
  }
  .send {
    order: 1;
    min-height: 34px;
    padding: 0 10px;
    font-size: 13px;
  }
  .filters {
    order: 2;
    flex: 1 1 100%;
    flex-wrap: nowrap;
  }
  .seg button {
    padding: 0 8px;
    font-size: 12px;
    white-space: nowrap;
  }
  .vibe-select {
    flex: 1 1 0;
    min-width: 0;
    font-size: 12px;
  }
}
@media (max-height: 640px) {
  .fireside {
    width: min(100%, 460px);
  }
}
@media (max-height: 640px) {
  .fireside {
    --k: 0.66;
  }
}
@media (max-width: 520px) {
  .blank {
    grid-template-columns: 1fr;
  }
  .pc-left {
    padding-right: 0;
    border-right: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .face {
    transition: none;
  }
}
</style>
