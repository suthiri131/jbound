<script setup>
    import { ref, reactive, computed, watch, nextTick } from 'vue';
    import { useRoute } from 'vue-router';
    import { api, errorMessage } from '@/lib/api';
    import { useAuthStore } from '@/stores/auth';
    import { VIBE_LABEL, VIBE_TINT } from '@/utils/constants';
    import { timeAgo, initials } from '@/utils/format';

    const route = useRoute();

    const auth = useAuthStore();
    const openComments = reactive({});
    const commentDraft = reactive({});

    const posts = ref([]);
    const place = ref(null);
    const googlePhotos = ref([]);
    const currentPlacePhoto = ref(0);

    const isCustomPlace = computed(() => route.params.name !== undefined);

    const placePhotos = computed(() => {
        if (!isCustomPlace.value) {
            return googlePhotos.value;
        }

        const topPostWithImages = posts.value.find(
            post => post.images?.length > 0
        );

        return topPostWithImages?.images.slice(0, 3) ?? [];
    });

    const placeName = computed(() =>
        posts.value.find(p => p.place?.name)?.place.name ?? 'Place Tales'
    );

    const placeImage = computed(() =>
        posts.value.find(p => p.images?.length)?.images[0] ?? null
    );

    const loading = ref(false);
    const error = ref('');

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

    async function loadPlaceTales() {
        loading.value = true;
        error.value = '';
        place.value = null;
        posts.value = [];
        googlePhotos.value = [];
        currentPlacePhoto.value = 0;

        try {
            if (isCustomPlace.value) {
                const name = route.params.name;

                const { data } = await api.get('/posts', {
                    params: { customPlaceName: name, limit: 50 }
                });

                posts.value = data.items ?? [];
                place.value = { name };

            } else {
                const [postsResponse, placeResponse] = await Promise.all([
                    api.get('/posts', {
                        params: { placeId: route.params.placeId }
                    }),
                    api.get(`/places/${route.params.placeId}`)
                ]);

                posts.value = postsResponse.data.items ?? [];
                place.value = placeResponse.data;

                if (place.value?.photos?.length) {
                    googlePhotos.value = place.value.photos.slice(0, 4);
                } else if (place.value?.name) {
                    try {
                        const { data } = await api.get('/places/google/search', {
                            params: { q: place.value.name }
                        });

                        const matchingPlace = data.find(
                            p => p.name.toLowerCase() === place.value.name.toLowerCase()
                        );

                        googlePhotos.value = matchingPlace?.photos?.slice(0, 4) ?? [];
                    } catch (err) {
                        console.error('Failed to load Google photos:', err);
                    }
                }
            }

        } catch (err) {
            error.value = errorMessage(err);
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => [route.params.placeId, route.params.name],
        loadPlaceTales,
        { immediate: true }
    );

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
            openComments[p.id] = data;
        } catch (err) {
            alert(errorMessage(err));
        }
        }

    async function comment(p) {
        const text = (commentDraft[p.id] || '').trim();
        if (!text) return;

        try {
            const { data } = await api.post(`/posts/${p.id}/comments`, { text });
            (openComments[p.id] ||= []).push(data);
            p.commentCount++;
            commentDraft[p.id] = '';
        } catch (err) {
            alert(errorMessage(err));
        }
        }

    async function removePost(p) {
        if (!window.confirm('Delete this tale?')) return;

        try {
            await api.delete(`/posts/${p.id}`);
            posts.value = posts.value.filter(x => x.id !== p.id);
            // prevents carousel from pulling the image that was deleted
            currentPlacePhoto.value = 0;
        } catch (err) {
            alert(errorMessage(err));
        }
        }

    // carousel functions
    function nextPlacePhoto() {
    currentPlacePhoto.value =
        (currentPlacePhoto.value + 1) % placePhotos.value.length;
    }

    function previousPlacePhoto(){
        currentPlacePhoto.value =
            (currentPlacePhoto.value - 1 + placePhotos.value.length)
            % placePhotos.value.length;
    }
</script>

<template>
  <main class="container page">
    <RouterLink to="/tales">← Back to Tales</RouterLink>

    <section class="place-header">

        <div v-if="placePhotos.length" class="place-carousel">

            <img
                :src="placePhotos[currentPlacePhoto]?.startsWith('/api/')
                    ? `http://localhost:3001${placePhotos[currentPlacePhoto]}`
                    : placePhotos[currentPlacePhoto]"
                :alt="`${place?.name} photo ${currentPlacePhoto + 1}`"
                class="place-hero"
            />

            <button
                v-if="placePhotos.length > 1"
                class="carousel-prev"
                @click="previousPlacePhoto"
            >❮</button>

            <button
                v-if="placePhotos.length > 1"
                class="carousel-next"
                @click="nextPlacePhoto"
            >❯</button>

            <div class="carousel-counter">
                {{ currentPlacePhoto + 1 }} / {{ placePhotos.length }}
            </div>

        </div>

        <div v-else class="place-placeholder">No location photo available</div>


        <h1 class="display display-lg" style="margin-top: 20px">{{ place?.name ?? 'Place Tales' }}</h1>

        <p class="lead">Community experiences and photos from this location.</p>

    </section>

    <p v-if="loading">Loading Tales...</p>
    <p v-else-if="error" class="error-text">{{ error }}</p>

    <template v-else>
    <div class="place-feed">
      <p>{{ posts.length }} Tales about this place</p>

      <div v-if="posts.length === 0" class="card card-pad">
        No Tales have been shared about this place yet.
      </div>

    <article v-for="post in posts" :key="post.id" class="card tale">
        <header class="row" style="gap: 10px">
            <span class="avatar" aria-hidden="true">
            {{ initials(post.author?.name) }}
            </span>

            <div style="flex: 1">
            <strong>{{ post.author?.name }}</strong>
            <span class="muted" style="font-size: 13px">
                · {{ timeAgo(post.created_at) }}
            </span>

            <p v-if="post.place || post.custom_place_name" style="margin: 0; font-size: 13px">
                at
                <RouterLink
                    v-if="post.place"
                    :to="`/tales/place/${post.place.id}`"
                >
                    {{ post.place.name }}
                </RouterLink>

                <RouterLink
                    v-else
                    :to="`/tales/custom/${encodeURIComponent(post.custom_place_name)}`"
                >
                    {{ post.custom_place_name }}
                </RouterLink>
            </p>
            
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
            <p v-for="c in openComments[post.id]" :key="c.id">
            <strong>{{ c.author?.name }}</strong> {{ c.text }}
            </p>

            <form class="row" style="gap: 8px; flex-wrap: nowrap" @submit.prevent="comment(post)">
            <input
                v-model="commentDraft[post.id]"
                class="input"
                maxlength="1000"
                placeholder="Add a comment…"
            />
            <button type="submit" class="btn btn-sm btn-dark">Post</button>
            </form>
        </div>

        </article>
        </div>
    </template>

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

  </main>
</template>

<style scoped>
.tale { margin-top: 18px; padding: 18px 20px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 2px solid var(--ink); border-radius: 50%; background: var(--sand); font-weight: 800; font-size: 14px; }
.caption { margin: 12px 0 0; white-space: pre-line; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 12px; }
.photos img { width: 100%; height: 140px; object-fit: contain; border: 2px solid var(--ink); border-radius: 8px; cursor: zoom-in; }
.liked { background: var(--clay); }
.comments { margin-top: 12px; padding-top: 12px; border-top: 1.5px dashed var(--line); font-size: 14px; }
.comments p { margin: 0 0 8px; }

.photo-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0, 0, 0, 0.92); display: flex; align-items: center; justify-content: center; padding: 55px 50px; }
.photo-enlarged { max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px; }
.photo-close { position: absolute; top: 18px; right: 22px; background: none; border: none; color: white; font-size: 30px; cursor: pointer; }
.photo-prev, .photo-next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255, 255, 255, 0.15); border: none; border-radius: 50%; color: white; font-size: 26px; width: 44px; height: 44px; cursor: pointer; }
.photo-prev { left: 12px; }
.photo-next { right: 12px; }
.photo-counter { position: absolute; bottom: 20px; color: white; font-size: 14px; }
.place-feed { width: 100%; max-width: none; margin: 16px 0 0; }
@media (max-width: 600px) { .photo-overlay { padding: 60px 12px; } .photo-prev, .photo-next { width: 36px; height: 36px; font-size: 20px; } }

.place-header { margin-top: 24px; }
.place-hero { display: block; width: 100%; height: 350px; object-fit: cover; border: 2px solid var(--ink); border-radius: 12px; margin-top: 20px; }
.place-placeholder { display: flex; align-items: center; justify-content: center; height: 220px; background: var(--sand); border: 2px dashed var(--ink); border-radius: 12px; color: var(--muted); }
@media (max-width: 600px) { .place-hero { height: 220px; } }

.place-carousel { position: relative; margin-top: 20px; }
.place-carousel .place-hero { margin-top: 0; }
.carousel-prev, .carousel-next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.5); color: white; border: none; border-radius: 50%; width: 44px; height: 44px; font-size: 24px; cursor: pointer; }
.carousel-prev { left: 16px; }
.carousel-next { right: 16px; }
.carousel-counter { position: absolute; bottom: 16px; right: 16px; background: rgba(0, 0, 0, 0.6); color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
</style>