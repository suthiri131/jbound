<script setup>
import { SignIn } from '@clerk/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AuthShell from '@/components/auth/AuthShell.vue';
import { clerkAppearance } from '@/components/auth/clerkAppearance';
import { safeRedirect } from '@/utils/safeRedirect';

const route = useRoute();
const next = computed(() => safeRedirect(route.query.next));
const signUpUrl = computed(() => (route.query.next ? `/sign-up?next=${encodeURIComponent(next.value)}` : '/sign-up'));
</script>

<template>
  <AuthShell eyebrow="Welcome back" title="Sign in" subtitle="Pick up your trips where you left off.">
    <SignIn
      path="/sign-in"
      routing="path"
      :sign-up-url="signUpUrl"
      :fallback-redirect-url="next"
      :appearance="clerkAppearance"
    />
  </AuthShell>
</template>