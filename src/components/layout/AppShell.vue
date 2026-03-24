<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import GlobalTopBar from './GlobalTopBar.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <Sidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <GlobalTopBar />
      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
