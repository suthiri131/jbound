<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, assetUrl, errorMessage } from '@/lib/api';
import PlaceTalesFeed from '@/components/tales/PlaceTalesFeed.vue';

// For tales with no Google place page: typed-in names and our own curated places.
const route = useRoute();

const feed = ref(null);
const posts = ref([]);
const place = ref(null);
const googlePhotos = ref([]);
const currentPlacePhoto = ref(0);
const error = ref('');

const isCustomPlace = computed(() => route.params.name !== undefined);

const placePhotos = computed(() => {
  if (!isCustomPlace.value) return googlePhotos.value;
  const topPostWithImages = posts.value.find((post) => post.images?.length > 0);
  return topPostWithImages?.images.slice(0, 3) ?? [];
});

// the feed replaces the list on every load and delete, which may remove the photo on show
watch(posts, () => {
  currentPlacePhoto.value = 0;
});

async function loadPlace() {
  if (!route.params.placeId && route.params.name === undefined) return; // on the way to another page
  error.value = '';
  place.value = null;
  googlePhotos.value = [];
  currentPlacePhoto.value = 0;

  if (isCustomPlace.value) {
    place.value = { name: route.params.name };
    return;
  }

  try {
    const { data } = await api.get(`/places/${route.params.placeId}`);
    place.value = data;

    if (data.photos?.length) {
      googlePhotos.value = data.photos.slice(0, 4);
    } else if (data.name) {
      try {
        const { data: results } = await api.get('/places/google/search', { params: { q: data.name } });
        const matchingPlace = results.find((p) => p.name.toLowerCase() === data.name.toLowerCase());
        googlePhotos.value = matchingPlace?.photos?.slice(0, 4) ?? [];
      } catch (err) {
        console.error('Failed to load Google photos:', err);
      }
    }
  } catch (err) {
    error.value = errorMessage(err);
  }
}

watch(() => [route.params.placeId, route.params.name], loadPlace, { immediate: true });

// carousel functions
function nextPlacePhoto() {
  currentPlacePhoto.value = (currentPlacePhoto.value + 1) % placePhotos.value.length;
}

function previousPlacePhoto() {
  currentPlacePhoto.value = (currentPlacePhoto.value - 1 + placePhotos.value.length) % placePhotos.value.length;
}
</script>

<template>
  <div>

    <section class="place-header">

        <div v-if="placePhotos.length" class="place-carousel">

            <img
                :src="assetUrl(placePhotos[currentPlacePhoto])"
                :alt="`${place?.name} photo ${currentPlacePhoto + 1}`"
                class="place-hero"
                role="button"
                tabindex="0"
                @click="feed?.openPhotoViewer(
                    placePhotos.map(assetUrl),
                    currentPlacePhoto
                )"
                @keydown.enter="feed?.openPhotoViewer(
                    placePhotos.map(assetUrl),
                    currentPlacePhoto
                )"
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

    <p v-if="error" class="error-text">{{ error }}</p>

    <PlaceTalesFeed
      ref="feed"
      v-model:posts="posts"
      :place-id="route.params.placeId"
      :custom-name="route.params.name"
    />
  </div>
</template>

<style scoped>
.place-header { margin-top: 24px; }
.place-hero { display: block; width: 100%; height: 500px; object-fit: contain; background: black; border: 2px solid var(--ink); border-radius: 12px; margin-top: 20px; }
.place-hero { cursor: zoom-in; }
.place-placeholder { display: flex; align-items: center; justify-content: center; height: 220px; background: var(--sand); border: 2px dashed var(--ink); border-radius: 12px; color: var(--muted); }
@media (max-width: 600px) { .place-hero { height: 220px; } }

.place-carousel { position: relative; margin-top: 20px; }
.place-carousel .place-hero { margin-top: 0; }
.carousel-prev, .carousel-next { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.5); color: white; border: none; border-radius: 50%; width: 44px; height: 44px; font-size: 24px; cursor: pointer; }
.carousel-prev { left: 16px; }
.carousel-next { right: 16px; }
.carousel-counter { position: absolute; bottom: 16px; right: 16px; background: rgba(0, 0, 0, 0.6); color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
</style>
