<script setup>
import { UserButton, useAuth } from '@clerk/vue';
import { RouterLink, useRoute } from 'vue-router';

const { isLoaded, isSignedIn } = useAuth();
const route = useRoute();
</script>

<template>
  <div class="nav-auth">
    <template v-if="isLoaded">
      <UserButton v-if="isSignedIn" after-sign-out-url="/" />
      <template v-else>
        <RouterLink class="btn btn-sm btn-ghost" :to="{ name: 'sign-in', query: { next: route.fullPath } }">Sign in</RouterLink>
        <RouterLink class="btn btn-sm btn-primary" :to="{ name: 'sign-up', query: { next: route.fullPath } }">Sign up</RouterLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.nav-auth { display: flex; align-items: center; gap: 10px; min-height: 38px; }
</style>