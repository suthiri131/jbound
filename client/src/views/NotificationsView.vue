<script setup>
import NotificationsList from '@/components/common/NotificationsList.vue';
</script>

<template>
  <main class="pouch pouch-paper">
    <div class="container page sheet">
      <NotificationsList heading-tag="h1" />
    </div>
  </main>
</template>

<style scoped>
.pouch {
  flex: 1 0 auto;
}
.sheet {
  max-width: 620px;
}
</style>
