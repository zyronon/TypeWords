<script setup lang="ts"></script>

<template>
    <div class="relative group pb-2">
        <slot></slot>
        <div class="btn-no-margin left-1/2 -translate-x-1/2 pt-2 absolute z-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
            <slot name="options"></slot>
        </div>
    </div>
</template>

<style scoped lang="scss"></style>