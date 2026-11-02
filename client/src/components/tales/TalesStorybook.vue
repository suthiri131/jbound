<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  posts: { type: Array, default: () => [] },
  currentUserId: { type: [String, Number], default: null },
  openCommentIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['like', 'comment', 'delete', 'filter-change', 'load-more', 'open-photo'])
const filters = [
  { label: 'Everyone', value: 'everyone' },
  { label: 'My Crews', value: 'friends' },
  { label: 'My Tales', value: 'mine' }
]
const activeFilter = ref('everyone')
const myPostsOnly = ref(false)
const currentPage = ref(0)
const isBookOpen = ref(false)
const isOpening = ref(false)
const isFlipping = ref(false)
const flipDirection = ref('next')
const showComposerPage = ref(false)
const photoIndexes = ref({})

const visiblePosts = computed(() => {
  if (!myPostsOnly.value) return props.posts
  if (props.currentUserId == null) return []
  return props.posts.filter(p => String(p.author?.id ?? p.author_id) === String(props.currentUserId))
})
const isSinglePage = ref(false)
const postsPerPage = computed(() => isSinglePage.value ? 1 : 2)
const totalPages = computed(() => Math.ceil(visiblePosts.value.length / postsPerPage.value))
const leftPost = computed(() => visiblePosts.value[currentPage.value * postsPerPage.value] ?? null)
const rightPost = computed(() => isSinglePage.value ? null : visiblePosts.value[currentPage.value * 2 + 1] ?? null)

function updateBookLayout() {
  isSinglePage.value = window.innerWidth <= 1100
}

onMounted(() => {
  updateBookLayout()
  window.addEventListener('resize', updateBookLayout)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateBookLayout)
})

watch(isSinglePage, () => {
  currentPage.value = 0
})
const anyCommentsOpen = computed(() => {
  const start = currentPage.value * postsPerPage.value
  return visiblePosts.value.slice(start, start + postsPerPage.value).some(isCommentsOpen)
})

watch(totalPages, pages => {
  currentPage.value = Math.min(currentPage.value, Math.max(0, pages - 1))
})

function isCommentsOpen(post) {
  return props.openCommentIds.some(id => String(id) === String(post.id))
}

function changeFilter(value) {
  activeFilter.value = value
  currentPage.value = 0
  emit('filter-change', value)
}

function toggleMyPosts() {
  myPostsOnly.value = !myPostsOnly.value
  currentPage.value = 0
}

function animateTurn(direction, callback) {
  if (isFlipping.value || isOpening.value) return
  flipDirection.value = direction
  isFlipping.value = true
  setTimeout(() => {
    callback()
    isFlipping.value = false
  }, 320)
}

function turnPage(direction) {
  if (showComposerPage.value) {
    if (direction === 'prev') returnToTales()
    return
  }
  const next = currentPage.value + (direction === 'next' ? 1 : -1)
  if (next < 0 || next >= totalPages.value) return
  animateTurn(direction, () => {
    currentPage.value = next
    if (direction === 'next' && next >= totalPages.value - 1) emit('load-more')
  })
}

function openBook() {
  if (isOpening.value || isBookOpen.value) return
  isOpening.value = true
  setTimeout(() => {
    isBookOpen.value = true
    isOpening.value = false
  }, 800)
}

function goToComposer() {
  if (isOpening.value || isFlipping.value || showComposerPage.value) return
  if (!isBookOpen.value) {
    isOpening.value = true
    setTimeout(() => {
      isBookOpen.value = true
      showComposerPage.value = true
      isOpening.value = false
    }, 800)
  } else {
    animateTurn('next', () => {
      showComposerPage.value = true
    })
  }
}

function returnToTales() {
  if (!showComposerPage.value) return
  animateTurn('prev', () => {
    showComposerPage.value = false
  })
}

function finishComposing() {
  showComposerPage.value = false
  currentPage.value = 0
  isBookOpen.value = true
}

defineExpose({ finishComposing })
function closeBook() {
  if (isOpening.value || isFlipping.value) return
  isBookOpen.value = false
  showComposerPage.value = false
  currentPage.value = 0
}

function authorName(post) {
  return post.author?.name ?? post.author?.username ?? 'JB Traveller'
}

function authorAvatar(post) {
  return post.author?.avatar_url ?? post.author?.image_url ?? null
}

function postBody(post) {
  return post.caption ?? post.content ?? post.body ?? ''
}

function postDate(post) {
  const value = post.created_at ?? post.createdAt
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function canDelete(post) {
  const authorId = post.author?.id ?? post.author_id
  return props.currentUserId != null && authorId != null && String(authorId) === String(props.currentUserId)
}

function currentPhotoIndex(post) {
  return Math.min(photoIndexes.value[post.id] ?? 0, Math.max(0, (post.images?.length ?? 1) - 1))
}

function currentPhoto(post) {
  const image = post.images?.[currentPhotoIndex(post)]
  return typeof image === 'string' ? image : image?.url ?? null
}

function nextPostPhoto(post) {
  if (!post.images?.length) return
  photoIndexes.value[post.id] = (currentPhotoIndex(post) + 1) % post.images.length
}

function previousPostPhoto(post) {
  if (!post.images?.length) return
  photoIndexes.value[post.id] = (currentPhotoIndex(post) - 1 + post.images.length) % post.images.length
}
</script>
<template>
  <section class="storybook-section">
    <header class="storybook-header">
      <div>
        <h1 class="display display-lg">Community Tales <span>✦</span></h1>
        <p>Real stories, tips, and finds from fellow JB travellers.</p>
      </div>
    </header>
    <div class="storybook-toolbar">
      <div class="filter-tabs">
        <button v-for="filter in filters" :key="filter.value" type="button" :class="{ active: activeFilter === filter.value }" @click="changeFilter(filter.value)">
          {{ filter.label }}
        </button>
      </div>
      <label class="my-posts-toggle">
        <input type="checkbox" :checked="myPostsOnly" @change="toggleMyPosts" />
        <span>My posts only</span>
      </label>
    </div>
    <div class="journal-stage">
      <div v-if="!isBookOpen" class="closed-book-wrapper" :class="{ 'book-opening': isOpening }">
        <button type="button" class="closed-book" :disabled="isOpening" @click="openBook">
          <span class="notebook-spiral" aria-hidden="true">
            <span v-for="n in 9" :key="n" class="spiral-ring"></span>
          </span>
          <span class="notebook-label">
            <span class="notebook-edition">THE JB TRAVEL JOURNAL</span>
            <span class="closed-book-title">JBound Tales</span>
            <span class="notebook-divider">✦ ───── ✦</span>
            <span class="closed-book-subtitle">Stories from the other side</span>
            <span class="notebook-stamp">EST. 2026 · JOHOR BAHRU</span>
          </span>
          <span class="closed-book-prompt">✧ Click to open the notebook ✧</span>
        </button>
      </div>
      <div v-else class="book-layout" :class="{ 'notes-visible': anyCommentsOpen && !showComposerPage }">
        <button type="button" class="page-arrow" aria-label="Previous pages" :disabled="(!showComposerPage && currentPage === 0) || isFlipping" @click="showComposerPage ? returnToTales() : turnPage('prev')">‹</button>
        <div class="book-cover">
          <div v-if="showComposerPage" class="composer-book-spread" :class="{ 'flipping-next': isFlipping && flipDirection === 'next', 'flipping-prev': isFlipping && flipDirection === 'prev' }">
            <div class="composer-left-page">
              <div class="journal-decoration">✦ ✧ ✦</div>
              <h2>Every Journey<br>Has a Story</h2>
              <p>From hidden cafés to unforgettable adventures, every little moment deserves to be remembered.</p>
              <div class="journal-illustration">✈</div>
              <p class="journal-quote">"The best memories are the ones we share."</p>
              <span class="composer-page-number">✦ JBound Travel Journal ✦</span>
            </div>
            <div class="composer-right-page">
              <div class="composer-page-header">
                <span>THE JB TRAVEL JOURNAL</span>
                <h2>Write Your Tale ✎</h2>
                <p>Share your adventure with fellow travellers.</p>
              </div>
              <div class="composer-page-content">
                <slot name="composer"></slot>
              </div>
              <span class="composer-page-number">✦ Your story begins here ✦</span>
            </div>
          </div>
          <div v-else class="open-book" :class="{ 'single-page-book': isSinglePage, 'flipping-next': isFlipping && flipDirection === 'next', 'flipping-prev': isFlipping && flipDirection === 'prev' }">
            <div
                v-for="(post, side) in (isSinglePage ? [leftPost] : [leftPost, rightPost])"
                :key="side"
                class="book-page"
                :class="side === 0 ? 'left-page' : 'right-page'"
                >
              <template v-if="post">
                <article class="tale-card">
                  <div class="author-row">
                    <div class="avatar">
                      <img v-if="authorAvatar(post)" :src="authorAvatar(post)" alt="" />
                      <span v-else>{{ authorName(post).charAt(0) }}</span>
                    </div>
                    <div class="author-details">
                      <strong>{{ authorName(post) }}</strong>
                      <small>{{ postDate(post) }}</small>
                    </div>
                    <button v-if="canDelete(post)" type="button" class="delete-btn" title="Delete Tale" aria-label="Delete Tale" @click="emit('delete', post)">⋯</button>
                  </div>
                  <div v-if="post.images?.length" class="photo-frame">
                    <img :src="currentPhoto(post)" :alt="`Tale photo ${currentPhotoIndex(post) + 1}`" class="tale-photo" role="button" tabindex="0" @click="emit('open-photo', post.images, currentPhotoIndex(post))" @keydown.enter="emit('open-photo', post.images, currentPhotoIndex(post))" @keydown.space.prevent="emit('open-photo', post.images, currentPhotoIndex(post))" />
                    <template v-if="post.images.length > 1">
                      <button type="button" class="photo-nav photo-nav-prev" aria-label="Previous photo" @click.stop="previousPostPhoto(post)">❮</button>
                      <button type="button" class="photo-nav photo-nav-next" aria-label="Next photo" @click.stop="nextPostPhoto(post)">❯</button>
                      <span class="photo-count">{{ currentPhotoIndex(post) + 1 }} / {{ post.images.length }}</span>
                    </template>
                    <span class="tape tape-top"></span>
                    <span class="tape tape-bottom"></span>
                  </div>
                  <div v-else class="photo-placeholder">
                    <span>✈</span>
                    <p>Memories from Johor Bahru</p>
                  </div>
                  <div class="tale-content">
                    <h2 class="display display-sm">
                      <RouterLink v-if="post.place?.id" :to="`/tales/place/${post.place.id}`" class="place-link">{{ post.place.name }}</RouterLink>
                      <RouterLink v-else-if="post.custom_place_name" :to="`/tales/custom/${encodeURIComponent(post.custom_place_name)}`" class="place-link">{{ post.custom_place_name }}</RouterLink>
                      <span v-else>My JB Adventure</span>
                    </h2>
                    <p class="tale-body" tabindex="0">{{ postBody(post) }}</p>
                  </div>
                  <div class="tale-actions">
                    <button type="button" class="like-action" :aria-pressed="Boolean(post.likedByMe)" :aria-label="`Like Tale (${post.likeCount ?? 0})`" @click="emit('like', post)">
                      <span>{{ post.likedByMe ? '♥' : '♡' }}</span>
                      {{ post.likeCount ?? 0 }}
                    </button>
                    <button type="button" class="comment-action" :aria-expanded="isCommentsOpen(post)" :aria-label="`Show comments (${post.commentCount ?? 0})`" @click="emit('comment', post)">
                      <svg class="comment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5A8.5 8.5 0 1 1 20 11.5Z"/>
                        <path d="M8 11.5h.01M11.5 11.5h.01M15 11.5h.01"/>
                      </svg>
                      <span class="comment-count">{{ post.commentCount ?? 0 }}</span>
                    </button>
                  </div>
                </article>
                <div class="comments-drop" :class="{ 'comments-expanded': isCommentsOpen(post) }">
                  <button v-if="!isCommentsOpen(post)" type="button" class="closed-scroll" aria-label="Open Traveller's Notes" @click="emit('comment', post)">
                    <span class="closed-scroll-label">✦ Traveller's Notes ✦</span>
                  </button>
                  <slot name="comments" :post="post"></slot>
                </div>
              </template>
              <div v-else class="empty-book-page">
                <div class="empty-decoration">✧</div>
                <p>{{ visiblePosts.length === 0 ? 'No tales to show yet.' : 'Your next adventure is waiting...' }}</p>
              </div>
              <div class="page-decoration" aria-hidden="true">{{ side === 0 ? '✦ ✧ ✦' : '✧ ✦ ✧' }}</div>
              <span class="printed-page-number">{{ currentPage * postsPerPage + side + 1 }}</span>
            </div>
          </div>
        </div>
        <button type="button" class="page-arrow" aria-label="Next pages" :disabled="showComposerPage || currentPage >= totalPages - 1 || isFlipping" @click="turnPage('next')">›</button>
      </div>

    <button type="button" class="journal-pen" aria-label="Write a new Tale" title="Write a new Tale" :disabled="isOpening || isFlipping" @click="goToComposer">
        <span class="pen-illustration" aria-hidden="true">
            <span class="pen-cap"></span>
            <span class="pen-body">
            <span class="pen-writing">Write a Tale</span>
            </span>
            <span class="pen-band"></span>
            <span class="pen-tip"></span>
        </span>
    </button>
    </div>

    <div v-if="isBookOpen" class="close-book-container">
      <button type="button" class="close-book-btn" @click="closeBook"><span>↶</span> Close the journal</button>
    </div>
    <div v-if="isBookOpen && !showComposerPage && totalPages > 0" class="book-pagination">
      <p>{{ currentPage + 1 }} / {{ totalPages }}</p>
      <div class="page-dots">
        <button v-for="page in totalPages" :key="page" type="button" :class="{ active: currentPage === page - 1 }" :aria-label="`Go to page ${page}`" @click="currentPage = page - 1"></button>
      </div>
    </div>
  </section>
</template>


<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');
.storybook-section { min-height: 100vh; padding: 38px 24px 60px; color: #442B1D; background-color: #70462C; background-image: repeating-linear-gradient(0deg,transparent 0px,rgba(35,17,7,.10) 2px,transparent 4px,transparent 18px,rgba(255,215,153,.045) 20px,transparent 23px,transparent 55px),repeating-linear-gradient(90deg,rgba(51,27,12,.12) 0px,transparent 3px,transparent 110px,rgba(33,15,7,.10) 113px,transparent 118px,transparent 240px),linear-gradient(135deg,#926440,#75492F 35%,#613A25 65%,#805335); border-radius: 24px; overflow: visible; }
.storybook-header, .storybook-toolbar { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.storybook-header h1 { margin: 0; font-family: 'Kalam', cursive; font-size: 46px; font-weight: 700; color: #FFF1D9; }
.storybook-header h1 span { color: #F2BA67; }
.storybook-header p { margin-top: 8px; font-family: 'Kalam', cursive; font-size: 19px; color: #F5DFC0; }
.storybook-toolbar { margin-top: 28px; margin-bottom: 25px; }
.filter-tabs { display: flex; gap: 4px; padding: 4px; background: #E8D7B5; border: 3px solid #35251A; border-radius: 18px; box-shadow: 3px 4px 0 rgba(36,21,12,.35); }
.filter-tabs button { padding: 11px 22px; border: 0; border-radius: 14px; background: transparent; color: #3C291C; font-family: 'Kalam', cursive; font-size: 17px; font-weight: 700; cursor: pointer; }
.filter-tabs button.active { background: #75462D; color: #FFF5E6; }
.filter-tabs button:hover:not(.active) { background: #D5B78F; }
.my-posts-toggle { display: flex; align-items: center; gap: 9px; color: #FFF1D9; font-family: 'Kalam', cursive; font-size: 17px; font-weight: 700; cursor: pointer; }
.my-posts-toggle span { color: #FFF1D9; }
.my-posts-toggle input { width: 18px; height: 18px; accent-color: #B87333; }
.journal-stage { position: relative; max-width: 1400px; margin: 0 auto; padding-right: 84px; overflow: visible; }
.closed-book-wrapper { display: flex; justify-content: center; align-items: center; min-height: 460px; padding: 35px 45px 50px; perspective: 1400px; }
.closed-book { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; width: min(100%,720px); min-height: 390px; padding: 35px 50px 35px 65px; background: repeating-linear-gradient(0deg,rgba(92,56,27,.035) 0px,transparent 2px,transparent 5px),linear-gradient(140deg,#D7B485,#BF9160 55%,#A8794E); border: 4px solid #5C3925; border-left: 16px solid #75462D; border-radius: 12px 24px 24px 12px; box-shadow: -9px 9px 0 #F4E5CA,-13px 13px 0 #533522,22px 28px 35px rgba(25,14,7,.4); color: #4A2C20; font-family: 'Kalam', cursive; cursor: pointer; transform-origin: left center; transform: rotate(-3deg); transition: transform .3s,box-shadow .3s; }
.closed-book:hover:not(:disabled) { transform: rotate(-1deg) translateY(-6px); }
.notebook-spiral { position: absolute; top: 32px; bottom: 32px; left: -24px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; z-index: 3; }
.spiral-ring { width: 37px; height: 16px; border: 5px solid #3C342D; border-radius: 50%; background: linear-gradient(180deg,#D9D3C6,#746B60); box-shadow: 0 2px 3px rgba(0,0,0,.35); }
.notebook-label { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: min(100%,470px); padding: 25px 30px; margin: 0 auto; border: 3px double #75462D; border-radius: 12px; background: rgba(255,242,216,.42); text-align: center; }
.notebook-edition { font-size: 14px; font-weight: 700; letter-spacing: 2px; color: #75462D; }
.closed-book-title { font-size: 47px; font-weight: 700; line-height: 1.1; color: #4A2C20; text-align: center; }
.closed-book-subtitle { font-size: 20px; color: #65432C; }
.notebook-divider { font-size: 20px; letter-spacing: 5px; color: #875335; }
.notebook-stamp { font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #875335; }
.closed-book-prompt { font-size: 17px; font-weight: 700; color: #4A2C20; }
.book-opening .closed-book { animation: openingNotebook .8s ease-in-out forwards; pointer-events: none; }
.book-layout { position: relative; max-width: 1330px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 8px; perspective: 1800px; overflow: visible; padding-bottom: 0; transition: padding-bottom .3s ease; }
.book-layout.notes-visible { padding-bottom: 225px; }
.book-cover { flex: 1; min-width: 0; padding: 17px; background: #583625; border: 5px solid #875335; border-radius: 28px; box-shadow: 0 16px 0 #3B241A,0 30px 45px rgba(50,28,14,.45); transform: rotate(-2deg); transition: transform .4s ease; overflow: visible; }
.book-cover:hover { transform: rotate(-1deg); }
.open-book { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); height: 640px; min-height: 0; transform-style: preserve-3d; overflow: visible; }
.book-page { position: relative; min-width: 0; height: 640px; min-height: 0; padding: 25px 30px 36px; background: repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(145,99,48,.035) 28px),#F8EBD5; box-shadow: inset 0 0 35px #ad805d22; overflow: visible; z-index: 1; }
.book-page:has(.comments-expanded) { z-index: 5; }
.left-page { border-radius: 20px 8px 8px 20px; border-right: 2px solid #D8B896; box-shadow: inset -25px 0 28px -25px #69452d6b,inset 7px 0 15px #ffffff88; }
.right-page { border-radius: 8px 20px 20px 8px; box-shadow: inset 25px 0 28px -25px #69452d6b,inset -7px 0 15px #ffffff88; }
.tale-card { position: relative; z-index: 1; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.author-row { display: flex; flex-shrink: 0; align-items: center; gap: 10px; margin-bottom: 15px; }
.avatar { display: flex; align-items: center; justify-content: center; width: 39px; height: 39px; border-radius: 50%; background: #B87945; color: #FFF8ED; font-weight: 700; overflow: hidden; flex-shrink: 0; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.author-details { display: flex; flex-direction: column; gap: 0; transform: translateY(-4px); }
.author-details strong { font-family: 'Kalam', cursive; font-size: 16px; font-weight: 700; line-height: 1.2; color: #352216; }
.author-details small { margin-top: 2px; font-family: 'Kalam', cursive; font-size: 13px; line-height: 1.2; color: #88674C; }
.delete-btn { margin-left: auto; background: transparent; border: 0; color: #75462D; font-size: 26px; cursor: pointer; }
.delete-btn:hover { color: #B34D2B; }
.photo-frame { flex: 0 0 auto; height: 195px; padding: 7px 7px 18px; margin: 0 12px 17px; position: relative; background: #FFF9EC; border-radius: 14px; box-shadow: 0 6px 18px rgba(72,43,21,.35); transform: rotate(-1.5deg); }
.right-page .photo-frame { transform: rotate(1deg); }
.photo-frame img { width: 100%; height: 100%; object-fit: contain; border-radius: 9px; }
.tale-photo { background: #FFFAF2; cursor: zoom-in; }
.tape { position: absolute; width: 66px; height: 22px; background: #e8ca83ad; transform: rotate(-30deg); pointer-events: none; }
.tape-top { top: -8px; left: -23px; }
.tape-bottom { right: -23px; bottom: -3px; }
.photo-placeholder { flex: 0 0 auto; height: 195px; margin-bottom: 17px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #E8D1AC; border: 7px solid #FFF; border-radius: 14px; color: #9C714E; }
.photo-placeholder span { font-size: 50px; }
.photo-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: rgba(74,44,32,.85); color: #FFF5E6; font-size: 14px; cursor: pointer; }
.photo-nav-prev { left: 12px; }
.photo-nav-next { right: 12px; }
.photo-nav:hover { background: #965B34; }
.photo-count { position: absolute; bottom: 23px; left: 50%; transform: translateX(-50%); z-index: 3; padding: 3px 10px; border-radius: 20px; background: rgba(74,44,32,.85); color: #FFF5E6; font-size: 12px; }
.tale-content { display: flex; flex-direction: column; flex: 0 1 auto; min-height: 0; overflow: hidden; }
.tale-content h2 { flex-shrink: 0; margin: 0 0 8px; font-family: 'Kalam', cursive; font-size: 26px; font-weight: 700; line-height: 1.2; color: #4A2C20; }
.place-link { font-family: 'Kalam', cursive; font-weight: 700; color: #4A2C20; text-decoration: none; }
.place-link:hover { color: #A15E30; text-decoration: underline; }
.tale-content .tale-body { display: block; margin: 0; padding-right: 7px; max-height: 140px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; color: #513B2C; font-family: 'Kalam', cursive; font-size: 17px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; scrollbar-width: thin; scrollbar-color: #B88A5D transparent; }
.tale-content .tale-body::-webkit-scrollbar { width: 6px; }
.tale-content .tale-body::-webkit-scrollbar-thumb { background: #B88A5D; border-radius: 10px; }
.tale-actions { display: flex; flex-shrink: 0; align-items: center; gap: 22px; margin-top: auto; padding-top: 10px; padding-bottom: 43px; }
.tale-actions button { display: inline-flex; align-items: center; gap: 7px; border: 0; background: transparent; color: #75462D; font-family: 'Kalam', cursive; font-size: 17px; font-weight: 700; cursor: pointer; }
.tale-actions button:hover { color: #B87333; }
.tale-actions .like-action span { font-size: 25px; line-height: 1; }
.comment-action { display: inline-flex; align-items: center; gap: 7px; }
.comment-icon { width: 24px; height: 24px; flex-shrink: 0; }
.tale-actions .comment-count { font-size: 17px; line-height: 1; }
.comments-drop { position: absolute; top: calc(100% - 47px); left: 42px; right: 42px; z-index: 30; pointer-events: none; }
.comments-drop.comments-expanded { top: calc(100% - 47px); }
.comments-drop :deep(.comment-scroll) { pointer-events: auto; margin-top: 0; }
.closed-scroll { position: relative; display: flex; justify-content: center; align-items: center; width: 100%; height: 26px; padding: 0 20px; border: 3px solid #87512E; border-radius: 18px; background: linear-gradient(to bottom,#E8CAA0 0%,#F7E3BD 30%,#C99A65 70%,#8C5A36 100%); box-shadow: 0 4px 7px rgba(51,28,13,.28); color: #70432A; cursor: pointer; pointer-events: auto; }
.closed-scroll-label { position: relative; display: block; max-width: 100%; overflow: hidden; font-family: 'Kalam', cursive; font-size: 11px; font-weight: 700; line-height: 1; color: #70432A; white-space: nowrap; text-align: center; }
.closed-scroll:hover { filter: brightness(1.07); transform: translateY(2px); }
.page-decoration { position: absolute; bottom: 12px; right: 25px; color: #B68B58; opacity: .6; letter-spacing: 4px; pointer-events: none; }
.printed-page-number { position: absolute; bottom: 12px; left: 22px; color: #98734E; font-family: 'Kalam', cursive; font-size: 13px; font-weight: 700; }
.empty-book-page { height: 100%; min-height: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #967354; text-align: center; font-family: 'Kalam', cursive; font-size: 20px; font-weight: 700; }
.empty-decoration { font-size: 60px; color: #C79A64; }
.page-arrow { width: 54px; height: 54px; flex-shrink: 0; border: 3px solid #35251A; border-radius: 50%; background: #F7EDDA; color: #35251A; font-size: 42px; line-height: 1; cursor: pointer; box-shadow: 0 4px 10px rgba(60,30,15,.3); z-index: 2; }
.page-arrow:hover:not(:disabled) { background: #E8C99B; }
.page-arrow:disabled { opacity: .35; cursor: not-allowed; }
.book-pagination { margin-top: 35px; color: #FFF1D9; text-align: center; font-family: 'Kalam', cursive; font-size: 20px; font-weight: 700; }
.book-pagination p { margin: 0 0 12px; }
.page-dots { display: flex; justify-content: center; flex-wrap: wrap; gap: 9px; }
.page-dots button { width: 10px; height: 10px; border: 0; border-radius: 50%; background: #BE956A; cursor: pointer; }
.page-dots button.active { background: #75462D; transform: scale(1.25); }
.flipping-next { animation: flipNext .32s ease-in-out; }
.flipping-prev { animation: flipPrev .32s ease-in-out; }
.journal-pen { position: absolute; right: 8px; top: 310px; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 90px; padding: 8px 4px; background: transparent; border: 0; cursor: pointer; transform: translateY(-50%) rotate(-8deg); transition: transform .2s ease; }
.journal-pen:hover:not(:disabled) { transform: translateY(-54%) rotate(-5deg) scale(1.04); }
.journal-pen:disabled { opacity: .5; cursor: not-allowed; }
.pen-illustration { position: relative; display: block; width: 28px; height: 210px; }
.pen-cap { position: absolute; top: 0; left: 3px; width: 22px; height: 30px; background: linear-gradient(180deg,#2A1A14,#4B3128); border: 2px solid #22140F; border-bottom: 0; border-radius: 8px 8px 3px 3px; }
.pen-body { position: absolute; top: 28px; left: 4px; width: 20px; height: 137px; display: flex; align-items: center; justify-content: center; background: linear-gradient(90deg,#6C4128,#C78A52 35%,#E2B27B 55%,#6C4128); border-left: 2px solid rgba(255,255,255,.18); border-right: 2px solid rgba(60,35,20,.28); border-radius: 8px; }
.pen-writing { position: absolute; width: 120px; text-align: center; white-space: nowrap; font-family: 'Kalam', cursive; font-size: 11px; font-weight: 700; line-height: 1; color: #3C2417; transform: rotate(-90deg); pointer-events: none; }
.pen-band { position: absolute; top: 161px; left: 3px; width: 22px; height: 12px; background: linear-gradient(180deg,#D6C7A1,#8A7859); border: 1px solid #6A5A40; border-radius: 3px; }
.pen-tip { position: absolute; top: 171px; left: 7px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 37px solid #2D2019; filter: drop-shadow(0 2px 1px rgba(0,0,0,.25)); }
.pen-label { font-family: 'Kalam', cursive; font-size: 15px; font-weight: 700; color: #FFF1D9; text-shadow: 1px 2px 2px #35251A; white-space: nowrap; transform: rotate(-18deg); }
.composer-book-spread { display: grid; grid-template-columns: 1fr 1fr; min-height: 620px; transform-style: preserve-3d; }
.composer-left-page, .composer-right-page { min-width: 0; position: relative; background: repeating-linear-gradient(0deg,transparent,transparent 31px,rgba(145,99,48,.045) 32px),#F8EBD5; }
.composer-left-page { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 45px; border-radius: 20px 8px 8px 20px; border-right: 2px solid #D8B896; box-shadow: inset -25px 0 28px -25px #69452D6B; text-align: center; }
.composer-left-page h2 { margin: 20px 0; font-family: 'Kalam', cursive; font-size: 42px; line-height: 1.3; color: #583625; }
.composer-left-page p { max-width: 330px; font-family: 'Kalam', cursive; font-size: 20px; line-height: 1.7; color: #79593E; }
.journal-decoration { font-size: 30px; letter-spacing: 12px; color: #B9854E; }
.journal-illustration { font-size: 85px; color: #B9854E; margin: 20px 0; transform: rotate(-15deg); }
.journal-quote { font-style: italic; color: #98734E; }
.composer-right-page { display: flex; flex-direction: column; padding: 30px 35px 45px; border-radius: 8px 20px 20px 8px; box-shadow: inset 25px 0 28px -25px #69452D6B; }
.composer-page-header { margin-bottom: 20px; text-align: center; font-family: 'Kalam', cursive; }
.composer-page-header span { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #9A6C43; }
.composer-page-header h2 { margin: 8px 0 0; font-family: 'Kalam', cursive; font-size: 30px; font-weight: 700; color: #4A2C20; }
.composer-page-header p { margin: 0; font-size: 15px; color: #79593E; }
.composer-page-content { width: 100%; flex: 1; }
.composer-page-number { position: absolute; bottom: 13px; left: 0; right: 0; text-align: center; font-family: 'Kalam', cursive; font-size: 13px; color: #A57D57; }
.close-book-container { display: flex; justify-content: center; align-items: center; width: 100%; margin: 50px auto 12px; position: relative; z-index: 2; }
.close-book-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 24px; background: #F7EDDA; border: 3px solid #35251A; border-radius: 16px; box-shadow: 3px 4px 0 #3A2418; color: #35251A; font-family: 'Kalam', cursive; font-size: 19px; font-weight: 700; cursor: pointer; }
.close-book-btn span { font-size: 26px; line-height: 1; }
.close-book-btn:hover { background: #E8C99B; }
@keyframes openingNotebook {
  0% { transform: rotate(-3deg) rotateY(0deg); opacity: 1; }
  50% { transform: rotate(-3deg) rotateY(-55deg) scale(1.04); opacity: 1; }
  100% { transform: rotate(-3deg) rotateY(-85deg) scale(1.04); opacity: 0; }
}
@keyframes flipNext {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(-9deg) scale(.985); }
  100% { transform: rotateY(0deg); }
}
@keyframes flipPrev {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(9deg) scale(.985); }
  100% { transform: rotateY(0deg); }
}
@media (max-width: 1100px) {
  .journal-stage { padding-right: 75px; }
  .book-layout { max-width: 700px; }
  .book-cover { padding: 12px; }
  .open-book { grid-template-columns: minmax(0,1fr); }
  .book-page { padding: 30px 38px 42px; }
  .left-page { border-right: 0; border-radius: 20px; box-shadow: inset 0 0 28px rgba(105,69,45,.12); }
  .right-page { display: none; }
  .photo-frame, .photo-placeholder { height: 210px; }
  .tale-content h2 { font-size: 27px; }
  .tale-content .tale-body { max-height: 170px; }
  .comments-drop { left: 44px; right: 44px; }
  .page-arrow { width: 42px; height: 42px; font-size: 32px; }
}
@media (max-width: 850px) {
  .book-page { padding: 22px 18px 36px; }
  .storybook-header, .storybook-toolbar { flex-wrap: wrap; }
  .page-arrow { width: 36px; height: 36px; font-size: 30px; }
  .journal-stage { padding-right: 70px; }
  .journal-pen { width: 70px; }
  .pen-illustration { height: 120px; }
  .pen-label { font-size: 12px; }
  .composer-left-page { padding: 25px; }
  .composer-right-page { padding: 25px 20px 45px; }
  .composer-left-page h2 { font-size: 32px; }
  .composer-left-page p { font-size: 17px; }
  .open-book, .book-page { height: 660px; }
  .photo-frame, .photo-placeholder { height: 165px; margin-left: 3px; margin-right: 3px; }
  .comments-drop { left: 42px; right: 42px; }
  .closed-scroll { height: 25px; padding: 0 14px; }
  .closed-scroll-label { font-size: 10px; }
}
@media (max-width: 600px) {
  .storybook-section { padding: 22px 10px 45px; }
  .storybook-header h1 { font-size: 32px; }
  .storybook-header p { font-size: 16px; }
  .filter-tabs { width: 100%; }
  .filter-tabs button { flex: 1; padding: 10px 5px; font-size: 12px; }
  .journal-stage { padding-right: 0; }
  .book-layout { gap: 4px; }
  .book-cover { padding: 8px; border-width: 3px; }
  .open-book { grid-template-columns: 1fr; height: 670px; }
  .book-page { height: 670px; padding: 22px 18px 40px; }
  .left-page { border-radius: 9px; }
  .photo-frame, .photo-placeholder { height: 170px; margin-left: 3px; margin-right: 3px; }
  .tale-content h2 { font-size: 23px; }
  .tale-content .tale-body { font-size: 16px; max-height: 175px; }
  .comments-drop { left: 38px; right: 38px; }
  .closed-scroll { height: 24px; padding: 0 10px; }
  .closed-scroll-label { font-size: 9px; letter-spacing: -0.3px; }
  .page-arrow { width: 30px; height: 38px; font-size: 28px; }
  .journal-pen { position: relative; top: auto; right: auto; width: 100%; flex-direction: row; justify-content: center; transform: none; margin-top: 22px; }
  .journal-pen:hover:not(:disabled) { transform: translateY(-3px); }
  .pen-illustration { width: 22px; height: 150px; transform: rotate(65deg) scale(.7); transform-origin: center; margin-right: 14px; }
  .pen-label { font-size: 18px; transform: none; }
  .closed-book-wrapper { min-height: 300px; padding: 20px 25px; }
  .closed-book { width: 100%; min-height: 255px; padding: 20px 18px 20px 35px; gap: 12px; }
  .notebook-label { width: 100%; padding: 15px 10px; gap: 6px; }
  .closed-book-title { font-size: 30px; }
  .closed-book-subtitle { font-size: 15px; }
  .notebook-edition, .notebook-stamp { font-size: 10px; }
  .notebook-divider { font-size: 14px; }
  .closed-book-prompt { font-size: 13px; }
  .notebook-spiral { top: 20px; bottom: 20px; }
  .spiral-ring { width: 30px; height: 12px; border-width: 4px; }
  .composer-book-spread { grid-template-columns: 1fr; }
  .composer-left-page { display: none; }
  .composer-right-page { min-height: 550px; padding: 25px 18px 45px; border-radius: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .book-opening .closed-book, .flipping-next, .flipping-prev { animation: none; }
}
</style>

