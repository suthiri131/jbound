<script setup>
import { SignUp } from '@clerk/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AuthShell from '@/components/auth/AuthShell.vue';
import { clerkAppearance } from '@/components/auth/clerkAppearance';
import { safeRedirect } from '@/utils/safeRedirect';

const route = useRoute();
const next = computed(() => safeRedirect(route.query.next));
// keep ?next when the user flips to "Sign in"
const signInUrl = computed(() => (route.query.next ? `/sign-in?next=${encodeURIComponent(next.value)}` : '/sign-in'));
</script>

<template>
  <AuthShell eyebrow="Join the crew" title="Create your account" subtitle="Free, and it takes under a minute.">
    <SignUp
      path="/sign-up"
      routing="path"
      :sign-in-url="signInUrl"
      :fallback-redirect-url="next"
      :appearance="clerkAppearance"
    />
  </AuthShell>
</template>