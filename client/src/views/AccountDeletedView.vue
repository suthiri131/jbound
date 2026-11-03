<script setup>
import { onMounted, ref } from 'vue';

const heading = ref(null);
onMounted(() => heading.value?.focus({ preventScroll: true })); // announce the new page to screen readers
</script>

<template>
  <main class="container page done">
    <section class="card-flat card-pad" aria-labelledby="deleted-title">
      <h1 id="deleted-title" ref="heading" class="display display-lg" tabindex="-1">Your account has been deleted</h1>
      <p class="lead">Your profile, tales and trip memberships have been removed. Thanks for travelling with JBound.</p>
      <div class="row actions">
        <RouterLink to="/" class="btn btn-primary">Back to home</RouterLink>
        <RouterLink to="/sign-up" class="btn">Create a new account</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* The global focus ring (mustard) is only ~2:1 against the paper background; WCAG wants 3:1 for focus indicators. */
:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.done { max-width: 760px; }
.actions { margin-top: 24px; }
</style>
