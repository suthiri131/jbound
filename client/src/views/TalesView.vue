<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage, uploadImage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { VIBES, VIBE_LABEL, VIBE_TINT } from '@/utils/constants';
import { timeAgo, initials } from '@/utils/format';

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
        limit: 20,
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
    } catch {
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
  try {
  const { data } = await api.post(`/posts/${p.id}/like`);
  p.likedByMe = data.liked;
  p.likeCount = data.likeCount;
  } catch (error) {
    console.log(error)
  }
}

async function toggleComments(p) {
  if (openComments[p.id]) return delete openComments[p.id];
  const { data } = await api.get(`/posts/${p.id}/comments`);
  openComments[p.id] = data;
}

async function comment(p) {
  const text = (commentDraft[p.id] || '').trim();
  if (!text) return;
  const { data } = await api.post(`/posts/${p.id}/comments`, { text });
  (openComments[p.id] ||= []).push(data);
  p.commentCount++;
  commentDraft[p.id] = '';
}

async function removePost(p) {
  if (!window.confirm('Delete this tale?')) return;
  await api.delete(`/posts/${p.id}`);
  feed.items = feed.items.filter((x) => x.id !== p.id);
}
</script>

<template>
  <main class="container page">
    <span class="tag-stamp" style="color: var(--ember)">Tales</span>
    <h1 class="display display-lg" style="margin-top: 16px">Stories from the other side.</h1>
    <p class="lead">Honest reviews from people who made the crossing. Share yours and tag the place so it shows up in the Explorer.</p>

    <div class="layout">
      <section class="card card-pad composer" aria-label="Share a tale">
        <h2 class="display display-sm">Tell a tale</h2>
        <form class="stack" style="gap: 12px; margin-top: 12px" @submit.prevent="post">
          <label class="field">
            What happened?
            <textarea v-model="draft.caption" class="textarea" required maxlength="2000" placeholder="The banana cake at Hiap Joo is gone by 11am. Worth the early start." data-cy="tale-caption" />
          </label>
          <div class="field ac">
            <label for="tale-place">Tag a place</label>
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
            <input type="file" accept="image/*" multiple class="input" style="padding-top: 8px" :disabled="uploading || draft.images.length >= 6" @change="addImages($event.target.files); $event.target.value = ''" />
          </label>
          <div v-if="draft.images.length" class="thumbs">
            <img v-for="(u, i) in draft.images" :key="u" :src="u" :alt="`Upload ${i + 1}`" />
          </div>
          <p v-if="composeError" class="error-text" role="alert">{{ composeError }}</p>
          <button type="submit" class="btn btn-ember" :disabled="posting || uploading" data-cy="tale-post">{{ uploading ? 'Uploading…' : posting ? 'Posting…' : 'Share by the fire' }}</button>
        </form>
      </section>

      <section aria-label="Feed">
        <div class="row">
          <div class="segmented" role="group" aria-label="Whose tales">
            <button type="button" :aria-pressed="scope === 'everyone'" @click="scope = 'everyone'">Everyone</button>
            <button type="button" :aria-pressed="scope === 'friends'" @click="scope = 'friends'">My crews</button>
          </div>
          <select v-model="vibe" class="select" style="width: auto" aria-label="Filter by vibe">
            <option value="">All vibes</option>
            <option v-for="v in VIBES" :key="v.id" :value="v.id">{{ v.label }}</option>
          </select>
          <button v-if="placeFilter" type="button" class="chip" aria-pressed="true" @click="clearPlaceFilter">One place only ✕</button>
        </div>

        <p v-if="feed.error" class="error-text" role="alert">{{ feed.error }}</p>

        <article v-for="p in feed.items" :key="p.id" class="card tale" data-cy="tale">
          <header class="row" style="gap: 10px">
            <span class="avatar" aria-hidden="true">{{ initials(p.author?.name) }}</span>
            <div style="flex: 1">
              <strong>{{ p.author?.name }}</strong>
              <span class="muted" style="font-size: 13px"> · {{ timeAgo(p.created_at) }}</span>
              <p v-if="p.place" style="margin: 0; font-size: 13px">at <RouterLink :to="`/tales?placeId=${p.place.id}`" @click="placeFilter = p.place.id">{{ p.place.name }}</RouterLink></p>
            </div>
            <span v-if="p.vibe" class="pill" :style="{ background: VIBE_TINT[p.vibe] }">{{ VIBE_LABEL[p.vibe] }}</span>
          </header>
          <p class="caption">{{ p.caption }}</p>
          <div v-if="p.images?.length" class="photos">
            <img v-for="u in p.images" :key="u" :src="u" alt="" loading="lazy" />
          </div>
          <footer class="row" style="gap: 8px; margin-top: 12px">
            <button type="button" class="btn btn-sm" :aria-pressed="p.likedByMe" :class="{ liked: p.likedByMe }" @click="like(p)">♥ {{ p.likeCount }}</button>
            <button type="button" class="btn btn-sm btn-ghost" :aria-expanded="Boolean(openComments[p.id])" @click="toggleComments(p)">Comments {{ p.commentCount }}</button>
            <span class="spacer" />
            <button v-if="p.author?.id === auth.user?.id" type="button" class="btn btn-sm btn-ghost" @click="removePost(p)">Delete</button>
          </footer>
          <div v-if="openComments[p.id]" class="comments">
            <p v-for="c in openComments[p.id]" :key="c.id"><strong>{{ c.author?.name }}</strong> {{ c.text }}</p>
            <form class="row" style="gap: 8px; flex-wrap: nowrap" @submit.prevent="comment(p)">
              <input v-model="commentDraft[p.id]" class="input" maxlength="1000" placeholder="Add a comment…" :aria-label="`Comment on ${p.author?.name}'s tale`" />
              <button type="submit" class="btn btn-sm btn-dark">Post</button>
            </form>
          </div>
        </article>

        <p v-if="!feed.loading && !feed.items.length" class="hand muted">No tales yet. Be the first by the fire.</p>
        <button v-if="feed.nextCursor" type="button" class="btn btn-ghost" style="margin-top: 16px" :disabled="feed.loading" @click="load(true)">Older tales</button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(280px, 380px) 1fr; gap: 28px; align-items: start; margin-top: 28px; }
.composer { position: sticky; top: 96px; }
.ac { position: relative; }
.ac-list { position: absolute; z-index: 5; top: 100%; left: 0; right: 0; list-style: none; margin: 4px 0 0; padding: 4px; background: var(--card); border: 2px solid var(--ink); border-radius: 8px; }
.ac-list button { width: 100%; min-height: 40px; text-align: left; border: 0; background: none; padding: 0 10px; cursor: pointer; border-radius: 6px; }
.ac-list button:hover { background: var(--sand); }
.thumbs { display: flex; flex-wrap: wrap; gap: 6px; }
.thumbs img { width: 64px; height: 64px; object-fit: cover; border: 2px solid var(--ink); border-radius: 6px; }
.tale { margin-top: 18px; padding: 18px 20px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 2px solid var(--ink); border-radius: 50%; background: var(--sand); font-weight: 800; font-size: 14px; }
.caption { margin: 12px 0 0; white-space: pre-line; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 12px; }
.photos img { width: 100%; height: 140px; object-fit: cover; border: 2px solid var(--ink); border-radius: 8px; }
.liked { background: var(--clay); }
.comments { margin-top: 12px; padding-top: 12px; border-top: 1.5px dashed var(--line); font-size: 14px; }
.comments p { margin: 0 0 8px; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } .composer { position: static; } }
</style>
