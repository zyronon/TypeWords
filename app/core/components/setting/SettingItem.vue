<script setup lang="ts">
defineProps<{
  mainTitle?: string
  title?: string
  desc?: string
}>()
</script>

<template>
  <div class="setting-item" v-bind="$attrs">
    <div class="setting-item__main">
      <div class="setting-item__label">
        <span v-if="mainTitle" class="setting-item__main-title">{{ mainTitle }}</span>
        <span v-else-if="title" class="setting-item__title">{{ title }}</span>
      </div>
      <div class="setting-item__control">
        <slot></slot>
      </div>
    </div>
    <div v-if="desc" class="setting-item__desc">{{ desc }}</div>
  </div>
</template>

<style scoped lang="scss">
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
  width: 100%;
}

.setting-item__main {
  display: flex;
  align-items: center;
  gap: 2rem;
  width: 100%;
}

.setting-item__label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 12rem;
  max-width: 18rem;
  line-height: 1.4;
  color: var(--color-font-1);
}

.setting-item__main-title {
  font-size: 1.2rem;
  font-weight: 600;
}

.setting-item__title {
  font-size: 1rem;
  font-weight: 500;
}

.setting-item__control {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space);
  flex-wrap: wrap;
}

.setting-item__desc {
  font-size: 0.9rem;
  color: var(--color-font-3);
  line-height: 1.6;
}

@media (max-width: 1024px) {
  .setting-item__label {
    min-width: 10rem;
  }
}

@media (max-width: 768px) {
  .setting-item {
    margin: 0.75rem 0;
    gap: 0.4rem;
  }

  .setting-item__main {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }

  .setting-item__label {
    min-width: auto;
    max-width: 100%;
    width: 100%;
  }

  .setting-item__control {
    width: 100%;
    justify-content: flex-start;
    gap: 0.6rem;
  }

  .setting-item__control > * {
    max-width: 100%;
  }

  .setting-item__desc {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .setting-item__main-title,
  .setting-item__title {
    font-size: 1rem;
  }

  .setting-item__desc {
    font-size: 0.8rem;
  }
}
</style>
